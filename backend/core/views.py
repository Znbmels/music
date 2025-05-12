from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from .models import Track, Playlist, PlaylistTrack
from .serializers import (
    TrackSerializer, TrackCreateSerializer,
    PlaylistSerializer, CustomUserSerializer
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.utils import timezone

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
        
        # Filter by genre
        genre = self.request.query_params.get('genre', None)
        if genre:
            queryset = queryset.filter(genre=genre)
        
        # Filter by musician
        musician_id = self.request.query_params.get('musician', None)
        if musician_id:
            queryset = queryset.filter(musician_id=musician_id)
        
        # Search by title or description
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(description__icontains=search)
            )
        
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
        track.increment_likes()
        return Response({'status': 'track liked'})

    @action(detail=True, methods=['post'])
    def play(self, request, pk=None):
        track = self.get_object()
        track.increment_plays()
        return Response({
            'status': 'play count updated',
            'audio_url': request.build_absolute_uri(track.audio_file.url)
        })

    @action(detail=False, methods=['get'])
    def recommendations(self, request):
        user = request.user
        
        # Get user's preferred genres from playlists
        user_genres = user.get_listened_genres()
        
        # Get top tracks by plays
        top_tracks = Track.objects.filter(
            is_active=True
        ).order_by('-plays')[:10]
        
        # If user has genres, get recommendations based on them
        if user_genres:
            genre_recommendations = Track.objects.filter(
                is_active=True,
                genre__in=user_genres
            ).order_by('-plays')[:5]
            top_tracks = list(top_tracks) + list(genre_recommendations)
        
        serializer = self.get_serializer(top_tracks, many=True)
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
            playlist.add_track(track)
            return Response({'status': 'track added to playlist'})
        except Exception as e:
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
            playlist.remove_track(track)
            return Response({'status': 'track removed from playlist'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def reorder_tracks(self, request, pk=None):
        playlist = self.get_object()
        track_orders = request.data.get('track_orders', [])
        
        try:
            for order_data in track_orders:
                PlaylistTrack.objects.filter(
                    playlist=playlist,
                    track_id=order_data['track_id']
                ).update(order=order_data['order'])
            
            return Response({'status': 'tracks reordered'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
