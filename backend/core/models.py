from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.contrib.auth.base_user import BaseUserManager
from django.db.models import Q

class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractUser):
    is_musician = models.BooleanField(default=False)
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = CustomUserManager()

    # Добавляем related_name для избежания конфликтов
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='customuser_set',  # Уникальное имя для обратной связи
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='customuser_permissions_set',  # Уникальное имя для обратной связи
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )

    def get_listened_genres(self):
        """Get genres of tracks in user's playlists"""
        return Track.objects.filter(
            playlist__user=self
        ).values_list('genre', flat=True).distinct()
    
    def get_favorite_mood(self):
        """Определение предпочитаемого настроения пользователя на основе прослушиваний"""
        from .services.recommendation_service import RecommendationService
        
        # Получаем треки, которые пользователь слушал
        listened_tracks = Track.objects.filter(playlist__user=self)
        
        # Определяем настроение для каждого трека
        mood_counts = {
            "energetic": 0,
            "relaxing": 0,
            "neutral": 0
        }
        
        for track in listened_tracks:
            mood = RecommendationService._get_track_mood(track)
            if mood in mood_counts:
                mood_counts[mood] += 1
        
        # Находим наиболее предпочитаемое настроение
        favorite_mood = max(mood_counts.items(), key=lambda x: x[1])[0] if mood_counts else "neutral"
        
        return favorite_mood
    
    def get_listening_time_distribution(self):
        """Анализ распределения прослушиваний по времени суток"""
        # В реальном приложении нужно отслеживать время каждого прослушивания
        # Здесь возвращаем заглушку для демонстрации
        return {
            "morning": 25,  # процент прослушиваний утром
            "afternoon": 30,
            "evening": 35,
            "night": 10
        }

class Track(models.Model):
    GENRE_CHOICES = [
        ('Pop', 'Pop'),
        ('Rock', 'Rock'),
        ('Hip-Hop', 'Hip-Hop'),
        ('Electronic', 'Electronic'),
        ('Jazz', 'Jazz'),
        ('Classical', 'Classical'),
        ('R&B', 'R&B'),
        ('Country', 'Country'),
    ]

    musician = models.ForeignKey(CustomUser, on_delete=models.CASCADE, limit_choices_to={'is_musician': True})
    title = models.CharField(max_length=100)
    description = models.TextField()
    audio_file = models.FileField(upload_to='tracks/')
    cover_image = models.ImageField(upload_to='covers/', null=True, blank=True)
    plays = models.IntegerField(default=0)
    likes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    genre = models.CharField(max_length=50, choices=GENRE_CHOICES)
    is_active = models.BooleanField(default=True)  # For moderation

    class Meta:
        ordering = ['-plays', '-created_at']

    def __str__(self):
        return self.title

    def increment_plays(self):
        """Increment play count"""
        self.plays += 1
        self.save(update_fields=['plays'])

    def increment_likes(self):
        """Increment like count"""
        self.likes += 1
        self.save(update_fields=['likes'])

    @staticmethod
    def find_similar(title, artist=None):
        """Находит трек по частичному совпадению названия и исполнителя"""
        query = Q(title__icontains=title) & Q(is_active=True)
        
        # Особая обработка для трека "Qara"
        if 'qara' in title.lower():
            qara_tracks = Track.objects.filter(title__icontains='Qara', is_active=True)
            if qara_tracks.exists():
                return qara_tracks.first()
        
        if artist:
            # Пробуем найти по точному совпадению исполнителя
            artist_match = Track.objects.filter(
                query & Q(musician__username__iexact=artist)
            )
            
            if artist_match.exists():
                return artist_match.first()
        
        # Если не нашли по исполнителю или исполнитель не указан, 
        # ищем только по названию
        title_match = Track.objects.filter(query)
        if title_match.exists():
            return title_match.first()
            
        return None

class Playlist(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    tracks = models.ManyToManyField(Track, through='PlaylistTrack')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_public = models.BooleanField(default=False)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name

    def add_track(self, track):
        """Add track to playlist with order"""
        PlaylistTrack.objects.create(
            playlist=self,
            track=track,
            order=self.tracks.count() + 1
        )

    def remove_track(self, track):
        """Remove track from playlist"""
        PlaylistTrack.objects.filter(playlist=self, track=track).delete()

class PlaylistTrack(models.Model):
    """Through model for Playlist-Track relationship with ordering"""
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    track = models.ForeignKey(Track, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        unique_together = ['playlist', 'track']

class UserTrackInteraction(models.Model):
    """Модель для отслеживания взаимодействий пользователя с треками"""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="track_interactions")
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="user_interactions")
    listened_at = models.DateTimeField(auto_now_add=True)
    listen_duration = models.PositiveIntegerField(default=0)  # в секундах
    skipped = models.BooleanField(default=False)
    liked = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-listened_at']
        unique_together = ['user', 'track', 'listened_at']
    
    def __str__(self):
        interaction_type = "liked" if self.liked else "skipped" if self.skipped else "listened"
        return f"{self.user.username} {interaction_type} {self.track.title} at {self.listened_at}"