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
from .services.recommendation_service import RecommendationService

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
        """Получение персонализированных рекомендаций"""
        user = request.user
        print(f"DEBUG: Пользователь запросил рекомендации: {user.username}")
        
        # Параметры для фильтрации рекомендаций
        mood = request.query_params.get('mood', None)
        genre = request.query_params.get('genre', None)
        user_query = request.query_params.get('query', None)
        print(f"DEBUG: Запрошены фильтры - настроение: {mood}, жанр: {genre}, запрос: {user_query}")
        
        try:
            # Получаем рекомендации с помощью нового сервиса, передавая параметры фильтров
            recommendations = RecommendationService.get_personalized_recommendations(
                user, 
                user_query=user_query,
                mood_filter=mood, 
                genre_filter=genre
            )
            print(f"DEBUG: Получено рекомендаций: {len(recommendations)}")
            
            # Получаем объекты треков для рекомендаций
            recommended_tracks = []
            for rec in recommendations:
                try:
                    # Сначала ищем точное совпадение
                    try:
                        track = Track.objects.get(
                            title__iexact=rec['title'],
                            musician__username__iexact=rec['artist'],
                            is_active=True
                        )
                    except Track.DoesNotExist:
                        # Затем используем более гибкий поиск
                        track = Track.find_similar(rec['title'], rec['artist'])
                    
                    # Особая обработка для трека "Qara"
                    if track is None and 'qara' in rec['title'].lower():
                        qara_tracks = Track.objects.filter(title__icontains='Qara', is_active=True)
                        if qara_tracks.exists():
                            track = qara_tracks.first()
                    
                    if track:
                        track.recommendation_reason = rec['reason']  # Добавляем причину рекомендации
                        recommended_tracks.append(track)
                        print(f"DEBUG: Добавлен трек в рекомендации: {track.title}")
                    else:
                        print(f"DEBUG: Не удалось найти трек {rec['title']} by {rec['artist']}")
                except Exception as e:
                    print(f"DEBUG: Ошибка при поиске трека: {str(e)}")
                    continue
            
            print(f"DEBUG: Итого рекомендовано треков: {len(recommended_tracks)}")
            
            # Сериализуем результаты
            serializer = self.get_serializer(recommended_tracks, many=True)
            
            # Добавляем причины рекомендаций в результат
            data = serializer.data
            for i, track_data in enumerate(data):
                if i < len(recommended_tracks):
                    track_data['recommendation_reason'] = getattr(recommended_tracks[i], 'recommendation_reason', '')
            
            return Response(data)
            
        except Exception as e:
            print(f"DEBUG: Ошибка при получении рекомендаций: {str(e)}")
            return Response([], status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=False, methods=['post'])
    def custom_recommendations(self, request):
        """Получение рекомендаций на основе пользовательского запроса"""
        user = request.user
        custom_prompt = request.data.get('prompt', '')
        
        if not custom_prompt:
            return Response(
                {'error': 'Запрос не может быть пустым'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Получаем базовые данные для персонализации
            user_profile = RecommendationService.get_user_profile(user)
            context = RecommendationService.get_current_context()
            available_tracks = RecommendationService.get_available_tracks(user)
            
            # Формируем расширенный промпт с пользовательским запросом
            user_profile_str = f"prefers {', '.join(user_profile['preferred_genres']) if user_profile['preferred_genres'] else 'various genres'}, " \
                             f"loves {', '.join(user_profile['favorite_artists']) if user_profile['favorite_artists'] else 'various artists'}"
            
            context_str = f"{context['time_of_day']}, {context['day_of_week']}"
            track_list_str = "; ".join(available_tracks)
            
            # Создаем промпт с учетом пользовательского запроса
            prompt = f"""
You are a music recommendation expert with deep knowledge of music preferences and trends. 
The user has the following profile: {user_profile_str}.
The current context is: {context_str}.
The user is specifically looking for: "{custom_prompt}".
The available tracks are: {track_list_str}.
Recommend up to 5 songs from this list that best match the user's specific request, considering their profile and context.
For each recommendation, provide a short reason why this track was chosen.
Return the recommendations in the format: "Title - Artist (reason)" (one per line).
"""
            
            # Вызов OpenAI API
            response = RecommendationService._call_openai_api(prompt)
            
            # Парсинг и обработка результатов
            recommendations = RecommendationService._parse_recommendations(response, available_tracks)
            
            # Получаем объекты треков
            recommended_tracks = []
            for rec in recommendations:
                try:
                    track = Track.objects.get(
                        title=rec['title'], 
                        musician__username=rec['artist'],
                        is_active=True
                    )
                    track.recommendation_reason = rec['reason']
                    recommended_tracks.append(track)
                except Track.DoesNotExist:
                    continue
            
            # Сериализуем результаты
            serializer = self.get_serializer(recommended_tracks, many=True)
            
            # Добавляем причины рекомендаций
            data = serializer.data
            for i, track_data in enumerate(data):
                if i < len(recommended_tracks):
                    track_data['recommendation_reason'] = getattr(recommended_tracks[i], 'recommendation_reason', '')
            
            return Response(data)
            
        except Exception as e:
            return Response(
                {'error': f'Ошибка при получении рекомендаций: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
