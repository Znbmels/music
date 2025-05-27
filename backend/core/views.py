from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q, Exists, OuterRef, Subquery
from django.contrib.auth import get_user_model
from .models import Track, Playlist, PlaylistTrack, UserTrackInteraction, Tag
from .serializers import (
    TrackSerializer, TrackCreateSerializer,
    PlaylistSerializer, CustomUserSerializer
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.utils import timezone
from datetime import datetime
from collections import Counter
from django.db.models import F
from django.db import transaction

CustomUser = get_user_model()

# Create your views here.

class UserRegistrationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CustomUserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'user': CustomUserSerializer(user).data,
                'message': 'User registered successfully'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CustomUserSerializer(request.user)
        return Response(serializer.data)

# --- Helper functions for recommendations ---

def get_user_listened_track_ids(user):
    """Returns a set of track IDs the user has fully listened to or added to a playlist."""
    listened_ids = UserTrackInteraction.objects.filter(
        user=user,
        interaction_type__in=[
            UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
            UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
        ]
    ).values_list('track_id', flat=True)
    return set(listened_ids)

def get_top_artists_by_user(user, limit=3, listened_track_ids=None):
    """Identifies user's top artists based on play counts and playlist additions."""
    if listened_track_ids is None:
        listened_track_ids = get_user_listened_track_ids(user)

    if not listened_track_ids:
        return []

    artist_counts = Counter()
    # Consider tracks fully played or added to playlists
    interactions = UserTrackInteraction.objects.filter(
        user=user,
        track_id__in=listened_track_ids,
        interaction_type__in=[
            UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
            UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
        ]
    ).select_related('track__musician')

    for interaction in interactions:
        if interaction.track.musician:
            artist_counts[interaction.track.musician] += 1
            # Could add more weight for playlist additions if desired
            # if interaction.interaction_type == UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST:
            #     artist_counts[interaction.track.musician] += 2 # Extra weight

    return [artist for artist, count in artist_counts.most_common(limit)]


def get_users_with_similar_interaction_history(user, threshold=0.3, min_common_tracks=3):
    """
    Finds users with similar listening history (full plays or playlist adds).
    A simple Jaccard index like approach on track sets.
    """
    user_tracks = get_user_listened_track_ids(user)
    if not user_tracks:
        return []

    similar_users = []
    other_users = CustomUser.objects.exclude(id=user.id)

    for other_user in other_users:
        other_user_tracks = get_user_listened_track_ids(other_user)
        if not other_user_tracks:
            continue

        common_tracks = user_tracks.intersection(other_user_tracks)
        if len(common_tracks) < min_common_tracks:
            continue

        union_tracks = user_tracks.union(other_user_tracks)
        similarity = len(common_tracks) / len(union_tracks) if union_tracks else 0

        if similarity >= threshold:
            similar_users.append(other_user)
    return similar_users

def get_track_score(user, track, user_interactions=None):
    """Calculates a score for a track based on user interactions."""
    score = 0
    # Pre-fetch interactions for the user if not provided
    if user_interactions is None:
        interactions = UserTrackInteraction.objects.filter(user=user, track=track)
    else:
        interactions = [i for i in user_interactions if i.track_id == track.id]

    for interaction in interactions:
        if interaction.interaction_type == UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST:
            score += 5
        elif interaction.interaction_type == UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED:
            score += 3
        # Assuming repeat plays are logged as multiple PLAY_FULLY_COMPLETED or similar
        # To implement "repeat" bonus, we'd need to count PLAY_FULLY_COMPLETED for this track.
        elif interaction.interaction_type == UserTrackInteraction.InteractionTypes.LIKE:
            score += 2 # Added LIKE for scoring
        elif interaction.interaction_type in [
            UserTrackInteraction.InteractionTypes.SKIP_EARLY,
            UserTrackInteraction.InteractionTypes.SKIP_MIDDLE
        ]:
            score -= 2
    return score


class TrackViewSet(viewsets.ModelViewSet):
    queryset = Track.objects.filter(is_active=True)
    serializer_class = TrackSerializer
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return TrackCreateSerializer
        return TrackSerializer

    def get_queryset(self):
        queryset = Track.objects.filter(is_active=True)
        user = self.request.user

        # Annotate with user-specific interaction data if needed for sorting or filtering
        # Example: Annotate with 'liked_by_user'
        if user.is_authenticated:
            liked_subquery = UserTrackInteraction.objects.filter(
                track=OuterRef('pk'),
                user=user,
                interaction_type=UserTrackInteraction.InteractionTypes.LIKE
            )
            queryset = queryset.annotate(liked_by_user=Exists(liked_subquery))


        # Filter by genre
        genre = self.request.query_params.get('genre', None)
        if genre:
            queryset = queryset.filter(genre=genre)

        # Filter by musician
        musician_id = self.request.query_params.get('musician', None)
        if musician_id:
            queryset = queryset.filter(musician_id=musician_id)

        # Filter by tag
        tag_slug = self.request.query_params.get('tag', None)
        if tag_slug:
            try:
                tag = Tag.objects.get(slug=tag_slug)
                queryset = queryset.filter(tags=tag)
            except Tag.DoesNotExist:
                # Optionally handle tag not found, e.g., return empty or ignore
                queryset = queryset.none()


        # Search by title or description
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search)
            )

        # Default ordering, can be overridden by recommendation logic
        return queryset.order_by('-plays', '-created_at')


    def perform_create(self, serializer):
        if not self.request.user.is_musician:
            return Response(
                {'error': 'Only musicians can upload tracks'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer.save(musician=self.request.user)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        track = self.get_object()
        user = request.user
        # track.increment_likes() # Deprecate global likes or keep for general stats

        # Log interaction
        interaction, created = UserTrackInteraction.objects.get_or_create(
            user=user,
            track=track,
            interaction_type=UserTrackInteraction.InteractionTypes.LIKE,
            defaults={'timestamp': timezone.now()}
        )

        if created:
            track.likes = F('likes') + 1 # If still using global counter
            track.save(update_fields=['likes'])
            return Response({'status': 'track liked', 'interaction_logged': True})
        else:
            # User already liked, perhaps implement unlike? For now, just acknowledge.
            # Or, if you want to allow multiple "like" events, remove get_or_create and just create.
            # For an "unlike" feature, you'd delete the interaction.
            return Response({'status': 'track already liked', 'interaction_logged': False}, status=status.HTTP_200_OK)

    # Example of an unlike action
    @action(detail=True, methods=['post'], url_path='unlike')
    def unlike(self, request, pk=None):
        track = self.get_object()
        user = request.user

        deleted_count, _ = UserTrackInteraction.objects.filter(
            user=user,
            track=track,
            interaction_type=UserTrackInteraction.InteractionTypes.LIKE
        ).delete()

        if deleted_count > 0:
            track.likes = F('likes') - 1
            track.save(update_fields=['likes'])
            return Response({'status': 'track unliked', 'interaction_removed': True})
        else:
            return Response({'status': 'track was not liked by user', 'interaction_removed': False}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'])
    def play(self, request, pk=None):
        track = self.get_object()
        user = request.user
        # track.increment_plays() # Deprecate global plays or keep for general stats

        # For simplicity, we log PLAY_FULLY_COMPLETED here.
        # In a real scenario, you'd have client-side reporting for:
        # PLAY_SESSION_START, PLAY_FULLY_COMPLETED (e.g., if >90% played), SKIP_EARLY, SKIP_MIDDLE
        UserTrackInteraction.objects.create(
            user=user,
            track=track,
            interaction_type=UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
            timestamp=timezone.now()
        )
        track.plays = F('plays') + 1 # If still using global counter
        track.save(update_fields=['plays'])

        return Response({
            'status': 'play count updated and interaction logged',
            'audio_url': request.build_absolute_uri(track.audio_file.url)
        })

    @action(detail=False, methods=['get'])
    def recommendations(self, request):
        user = request.user
        final_recommendations = []
        recommended_track_ids = set() # To avoid duplicates

        # --- 0. Get tracks user has already interacted with significantly (listened/added to playlist) ---
        user_listened_ids = get_user_listened_track_ids(user)

        # --- 1. Globally Popular Tracks (fallback / general) ---
        # Exclude tracks user already listened to
        global_top_tracks = Track.objects.filter(is_active=True) \
                                .exclude(id__in=user_listened_ids) \
                                .order_by('-plays', '-likes')[:10] # A bit more for initial pool
        for track in global_top_tracks[:5]: # Take top 5 for this category
            if track.id not in recommended_track_ids:
                final_recommendations.append(track)
                recommended_track_ids.add(track.id)


        # --- 2. Artist-based recommendations ---
        top_user_artists = get_top_artists_by_user(user, limit=3, listened_track_ids=user_listened_ids)
        if top_user_artists:
            artist_tracks_queryset = Track.objects.filter(
                is_active=True,
                musician__in=top_user_artists
            ).exclude(id__in=recommended_track_ids).exclude(id__in=user_listened_ids) \
             .order_by('-plays', '-likes') # Could also order by other metrics like newness

            # To make it more diverse, get a few tracks from each top artist
            artist_recs_limit_per_artist = 2
            for artist in top_user_artists:
                artist_specific_tracks = artist_tracks_queryset.filter(musician=artist)[:artist_recs_limit_per_artist]
                for track in artist_specific_tracks:
                    if track.id not in recommended_track_ids and len(final_recommendations) < 20: # Overall limit
                        final_recommendations.append(track)
                        recommended_track_ids.add(track.id)

        # --- 3. Genre-based recommendations (based on listened genres) ---
        user_listened_genres = UserTrackInteraction.objects.filter(
            user=user,
            interaction_type__in=[
                UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
                UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
            ]
        ).select_related('track').values_list('track__genre', flat=True).distinct()

        if user_listened_genres:
            genre_tracks = Track.objects.filter(
                is_active=True,
                genre__in=list(user_listened_genres)
            ).exclude(id__in=recommended_track_ids).exclude(id__in=user_listened_ids) \
             .order_by('-plays', '-likes')[:5] # Get top 5 for this category

            for track in genre_tracks:
                if track.id not in recommended_track_ids and len(final_recommendations) < 25: # Overall limit
                    final_recommendations.append(track)
                    recommended_track_ids.add(track.id)

        # --- 4. Collaborative Filtering (Simple: tracks from similar users) ---
        # This can be computationally expensive, use with caution or optimize (e.g., run periodically)
        # For now, let's make it simpler or skip if too slow
        similar_users = get_users_with_similar_interaction_history(user, threshold=0.2, min_common_tracks=2)
        if similar_users:
            collab_track_ids = UserTrackInteraction.objects.filter(
                user__in=similar_users,
                interaction_type__in=[
                    UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
                    UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
                ]
            ).exclude(track_id__in=recommended_track_ids).exclude(track_id__in=user_listened_ids) \
             .values_list('track_id', flat=True).distinct()

            collab_tracks = Track.objects.filter(id__in=list(collab_track_ids)[:10]) # Limit to 10 potential tracks
            for track in collab_tracks[:5]: # Take top 5 for this category
                 if track.id not in recommended_track_ids and len(final_recommendations) < 30: # Overall limit
                    final_recommendations.append(track)
                    recommended_track_ids.add(track.id)


        # --- 5. Content-based (tracks similar to liked/frequently played by user) ---
        # This requires more detailed track features (mood, BPM) and user history analysis.
        user_positive_interactions = UserTrackInteraction.objects.filter(
            user=user,
            interaction_type__in=[
                UserTrackInteraction.InteractionTypes.LIKE,
                UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
                UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
            ]
        ).select_related('track')

        # Get features from these positively interacted tracks
        liked_genres = set()
        liked_moods = set()
        # approx_bpm_sum = 0
        # bpm_count = 0

        for interaction in user_positive_interactions:
            if interaction.track.genre:
                liked_genres.add(interaction.track.genre)
            if interaction.track.mood:
                liked_moods.add(interaction.track.mood)
            # if interaction.track.bpm:
            #     approx_bpm_sum += interaction.track.bpm
            #     bpm_count +=1
        # avg_bpm = approx_bpm_sum / bpm_count if bpm_count > 0 else None

        if liked_genres or liked_moods: # or avg_bpm
            content_query = Q(is_active=True)
            if liked_genres:
                content_query &= Q(genre__in=list(liked_genres))
            if liked_moods:
                content_query &= Q(mood__in=list(liked_moods))
            # if avg_bpm:
            #     bpm_range_width = 15 # Tracks with BPM +/- 15 of average
            #     content_query &= Q(bpm__range=(avg_bpm - bpm_range_width, avg_bpm + bpm_range_width))

            content_based_tracks = Track.objects.filter(content_query) \
                                       .exclude(id__in=recommended_track_ids) \
                                       .exclude(id__in=user_listened_ids) \
                                       .order_by('?')[:10] # Randomize to get variety, then pick top

            for track in content_based_tracks[:5]: # Take top 5 for this category
                if track.id not in recommended_track_ids and len(final_recommendations) < 35: # Overall limit
                    final_recommendations.append(track)
                    recommended_track_ids.add(track.id)


        # --- 6. Time of Day Recommendations (Contextual) ---
        now = timezone.now() # timezone.now() returns an aware datetime object, usually in UTC
        current_time_slot = 'any'
        if now.hour < 12: # Assuming UTC for now, adjust if server/user timezone differs
            current_time_slot = 'morning'
        elif now.hour < 18:
            current_time_slot = 'day'
        else:
            current_time_slot = 'evening'

        if current_time_slot != 'any':
            time_based_tracks = Track.objects.filter(
                is_active=True,
                suitable_for_time__in=[current_time_slot, 'any'] # Tracks for current slot or 'any'
            ).exclude(id__in=recommended_track_ids).exclude(id__in=user_listened_ids) \
             .order_by('?')[:5] # Randomize to get variety, then pick top

            for track in time_based_tracks[:3]: # Take top 3 for this category
                 if track.id not in recommended_track_ids and len(final_recommendations) < 40: # Overall limit
                    final_recommendations.append(track)
                    recommended_track_ids.add(track.id)

        # --- 7. Recommendations by Tag (if user has interacted with tagged tracks) ---
        # This can be further enhanced by looking at tags of tracks user liked/played
        # For now, let's get some popular tracks from tags user has interacted with
        user_interacted_tags = Tag.objects.filter(
            tracks__user_interactions__user=user,
            tracks__user_interactions__interaction_type__in=[
                UserTrackInteraction.InteractionTypes.LIKE,
                UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
                UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
            ]
        ).distinct()

        if user_interacted_tags:
            tag_based_tracks = Track.objects.filter(
                is_active=True,
                tags__in=user_interacted_tags
            ).exclude(id__in=recommended_track_ids).exclude(id__in=user_listened_ids) \
            .distinct().order_by('?')[:5] # Randomize and take a few

            for track in tag_based_tracks:
                 if track.id not in recommended_track_ids and len(final_recommendations) < 40: # Overall limit
                    final_recommendations.append(track)
                    recommended_track_ids.add(track.id)


        # --- Scoring and Final Selection (Optional for now, can be complex) ---
        # For now, we are just concatenating. A more advanced approach would be:
        # 1. Gather a larger pool of candidates from all strategies.
        # 2. Score each candidate track using get_track_score(user, track, all_user_interactions).
        # 3. Sort by score and take top N.
        # This requires fetching all_user_interactions once.
        # all_user_interactions = UserTrackInteraction.objects.filter(user=user)
        # final_recommendations.sort(key=lambda t: get_track_score(user, t, all_user_interactions), reverse=True)

        # Remove duplicates again (if any introduced by different queries fetching same track)
        # and ensure final list has unique tracks
        unique_final_recs = []
        seen_ids = set()
        for track in final_recommendations:
            if track.id not in seen_ids:
                unique_final_recs.append(track)
                seen_ids.add(track.id)

        # Limit the total number of recommendations
        final_recommendations_limited = unique_final_recs[:20] # Max 20 recommendations

        serializer = self.get_serializer(final_recommendations_limited, many=True)
        return Response(serializer.data)


    @action(detail=False, methods=['get'])
    def charts(self, request):
        """Get top tracks by plays and likes"""
        top_by_plays = Track.objects.filter(
            is_active=True
        ).order_by('-plays')[:10]

        top_by_likes = Track.objects.filter(
            is_active=True
        ).order_by('-likes')[:10]

        return Response({
            'by_plays': self.get_serializer(top_by_plays, many=True).data,
            'by_likes': self.get_serializer(top_by_likes, many=True).data
        })

class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Playlist.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_track(self, request, pk=None):
        playlist = self.get_object()
        track_id = request.data.get('track_id')
        track = get_object_or_404(Track, id=track_id, is_active=True)

        try:
            playlist.add_track(track) # This already logs ADD_TO_PLAYLIST
            return Response({'status': 'track added to playlist'})
        except Exception as e: # Catch potential IntegrityError if track already in playlist via PlaylistTrack unique_together
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def remove_track(self, request, pk=None):
        playlist = self.get_object()
        track_id = request.data.get('track_id')
        track = get_object_or_404(Track, id=track_id)

        try:
            playlist.remove_track(track) # This already logs REMOVE_FROM_PLAYLIST
            return Response({'status': 'track removed from playlist'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def reorder_tracks(self, request, pk=None):
        playlist = self.get_object()
        track_orders = request.data.get('track_orders', []) # Expects a list of {'track_id': X, 'order': Y}

        try:
            with transaction.atomic(): # Ensure all or nothing
                for order_data in track_orders:
                    track_id = order_data.get('track_id')
                    new_order = order_data.get('order')
                    if track_id is not None and new_order is not None:
                        PlaylistTrack.objects.filter(
                            playlist=playlist,
                            track_id=track_id
                        ).update(order=new_order)

            return Response({'status': 'tracks reordered'})
        except Exception as e:
            return Response(
                {'error': f'Error reordering tracks: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

# It's good practice to have a dedicated Tag viewset if you plan to manage tags via API
class TagViewSet(viewsets.ReadOnlyModelViewSet): # ReadOnly for now
    queryset = Tag.objects.all().order_by('name')
    # serializer_class = TagSerializer # You'd need to create this serializer
    permission_classes = [IsAuthenticated] # Or AllowAny if tags are public
    lookup_field = 'slug'

    @action(detail=True, methods=['get'])
    def tracks(self, request, slug=None):
        """Returns tracks associated with a specific tag."""
        tag = self.get_object()
        tracks = Track.objects.filter(is_active=True, tags=tag).order_by('-plays')[:20] # Get top 20 tracks for a tag
        serializer = TrackSerializer(tracks, many=True, context={'request': request})
        return Response(serializer.data)
