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
from .services import generate_recommendations_with_gemini, get_recommendations_for_visual_update
import logging

CustomUser = get_user_model()
logger = logging.getLogger(__name__)

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
        target_recommendation_count = 20
        final_recommendations = []
        seen_track_ids = set()

        # 1. Добавляем треки из плейлистов пользователя
        user_playlists = Playlist.objects.filter(user=user).prefetch_related('tracks_through_playlisttrack__track')
        playlist_tracks = []
        for pl in user_playlists:
            # Сортируем треки в плейлисте по их порядку, если он есть
            sorted_playlist_tracks = sorted(pl.tracks_through_playlisttrack.all(), key=lambda pt: pt.order)
            for pt_entry in sorted_playlist_tracks:
                playlist_tracks.append(pt_entry.track)

        for track in playlist_tracks:
            if track.id not in seen_track_ids:
                final_recommendations.append(track)
                seen_track_ids.add(track.id)
                if len(final_recommendations) >= target_recommendation_count:
                    break
            if len(final_recommendations) >= target_recommendation_count:
                break

        logger.info(f"User {user.id} ({user.username}): Added {len(final_recommendations)} tracks from their playlists to recommendations.")

        # 2. Добавляем рекомендации от Gemini или из fallback, если место еще есть
        if len(final_recommendations) < target_recommendation_count:
            # Запрашиваем у Gemini/fallback чуть больше, чтобы было из чего выбрать после удаления дубликатов
            num_needed_from_ai = target_recommendation_count - len(final_recommendations)
            # Мы запросим полный count у Gemini, а потом отфильтруем

            ai_or_fallback_recs = []
            gemini_recs = generate_recommendations_with_gemini(user, count=target_recommendation_count) # Просим стандартное количество

            if gemini_recs:
                logger.info(f"User {user.id}: Got {len(gemini_recs)} recommendations from Gemini.")
                ai_or_fallback_recs = gemini_recs
            else:
                logger.info(f"Gemini returned no recommendations for user {user.id} ({user.username}). Falling back to globally popular tracks.")
                user_listened_ids = get_user_listened_track_ids(user) # Включает треки из плейлистов

                fallback_tracks = Track.objects.filter(is_active=True) \
                                        .exclude(id__in=seen_track_ids) \
                                        .exclude(id__in=user_listened_ids) \
                                        .order_by('-plays', '-likes')[:target_recommendation_count] # Просим побольше для запаса
                ai_or_fallback_recs = list(fallback_tracks)

                if not ai_or_fallback_recs:
                    logger.info(f"Fallback (globally popular) also returned no new tracks for user {user.id}. Getting very new tracks.")
                    fallback_tracks_newest = Track.objects.filter(is_active=True) \
                                        .exclude(id__in=seen_track_ids) \
                                        .exclude(id__in=user_listened_ids) \
                                        .order_by('-created_at')[:target_recommendation_count]
                    ai_or_fallback_recs = list(fallback_tracks_newest)

            for track in ai_or_fallback_recs:
                if track.id not in seen_track_ids:
                    final_recommendations.append(track)
                    seen_track_ids.add(track.id)
                if len(final_recommendations) >= target_recommendation_count:
                    break

        serializer = self.get_serializer(final_recommendations[:target_recommendation_count], many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='live-recommendations')
    def live_recommendations(self, request):
        user = request.user
        target_recommendation_count = 5 # Меньше для live
        final_recommendations = []
        seen_track_ids = set()

        current_track_id_str = request.query_params.get('current_track_id', None)
        current_track_id = int(current_track_id_str) if current_track_id_str and current_track_id_str.isdigit() else None

        # 1. Добавляем треки из плейлистов пользователя (можно взять несколько, например, последние добавленные или случайные)
        # Для простоты, пока возьмем до 2 треков из плейлистов, если они есть
        user_playlists = Playlist.objects.filter(user=user).prefetch_related('tracks_through_playlisttrack__track')
        playlist_tracks_for_live = []
        temp_playlist_tracks = []
        for pl in user_playlists:
            sorted_playlist_tracks = sorted(pl.tracks_through_playlisttrack.all(), key=lambda pt: pt.order, reverse=True) # Последние добавленные/измененные могут быть интереснее
            for pt_entry in sorted_playlist_tracks:
                temp_playlist_tracks.append(pt_entry.track)

        for track in temp_playlist_tracks:
            if track.id not in seen_track_ids:
                playlist_tracks_for_live.append(track)
                seen_track_ids.add(track.id)
            if len(playlist_tracks_for_live) >= 2: # Ограничим 2 треками из плейлистов для live-рекомендаций
                break

        final_recommendations.extend(playlist_tracks_for_live)
        logger.info(f"User {user.id} ({user.username}): Added {len(playlist_tracks_for_live)} tracks from their playlists to live recommendations.")

        # 2. Добавляем рекомендации от Gemini (с учетом текущего трека), если место еще есть
        if len(final_recommendations) < target_recommendation_count:
            num_needed_from_ai = target_recommendation_count - len(final_recommendations)

            ai_recs = get_recommendations_for_visual_update(
                user,
                current_track_id=current_track_id,
                count=target_recommendation_count # Просим у Gemini общее желаемое количество, фильтруем потом
            )

            for track in ai_recs:
                if track.id not in seen_track_ids:
                    final_recommendations.append(track)
                    seen_track_ids.add(track.id)
                if len(final_recommendations) >= target_recommendation_count:
                    break

        # Если после Gemini все еще мало, можно добавить из общего fallback, но для live это менее критично
        if len(final_recommendations) < target_recommendation_count:
            logger.info(f"User {user.id}: Not enough live recommendations from Gemini + playlists. Adding popular as fallback.")
            user_listened_ids = get_user_listened_track_ids(user)
            fallback_tracks = Track.objects.filter(is_active=True) \
                                    .exclude(id__in=seen_track_ids) \
                                    .exclude(id__in=user_listened_ids) \
                                    .order_by('-plays', '-likes')[:target_recommendation_count - len(final_recommendations)]
            for track in fallback_tracks:
                 if track.id not in seen_track_ids:
                    final_recommendations.append(track)
                    seen_track_ids.add(track.id)
                 if len(final_recommendations) >= target_recommendation_count:
                    break

        serializer = self.get_serializer(final_recommendations[:target_recommendation_count], many=True, context={'request': request})
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
