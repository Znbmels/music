from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.contrib.auth.base_user import BaseUserManager
from django.utils.text import slugify

class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

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
        # This might need to be updated to use UserTrackInteraction later
        return Track.objects.filter(
            playlist__user=self
        ).values_list('genre', flat=True).distinct()

class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="Название тега")
    slug = models.SlugField(max_length=50, unique=True, blank=True, null=True, verbose_name="Slug")

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Тег"
        verbose_name_plural = "Теги"

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
        # Add more genres as needed
    ]

    TIME_OF_DAY_CHOICES = [
        ('morning', 'Утро'),
        ('day', 'День'),
        ('evening', 'Вечер'),
        ('any', 'Любое время'),
    ]

    musician = models.ForeignKey(CustomUser, on_delete=models.CASCADE, limit_choices_to={'is_musician': True}, related_name='tracks_by_musician')
    title = models.CharField(max_length=100, verbose_name="Название")
    description = models.TextField(verbose_name="Описание", blank=True, null=True)
    audio_file = models.FileField(upload_to='tracks/', verbose_name="Аудиофайл")
    cover_image = models.ImageField(upload_to='covers/', null=True, blank=True, verbose_name="Обложка")
    plays = models.IntegerField(default=0, verbose_name="Количество прослушиваний (глобальное)") # Global plays, can be deprecated later
    likes = models.IntegerField(default=0, verbose_name="Количество лайков (глобальное)")   # Global likes, can be deprecated later
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")
    genre = models.CharField(max_length=50, choices=GENRE_CHOICES, verbose_name="Жанр")
    is_active = models.BooleanField(default=True, verbose_name="Активен")  # For moderation

    # New fields for advanced recommendations
    bpm = models.PositiveIntegerField(null=True, blank=True, verbose_name="BPM (темп)")
    mood = models.CharField(max_length=50, null=True, blank=True, verbose_name="Настроение") # Example: "Happy", "Sad", "Energetic"
    suitable_for_time = models.CharField(
        max_length=20,
        choices=TIME_OF_DAY_CHOICES,
        default='any',
        null=True, blank=True,
        verbose_name="Подходит для времени суток"
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name='tracks', verbose_name="Теги")

    class Meta:
        ordering = ['-plays', '-created_at']
        verbose_name = "Трек"
        verbose_name_plural = "Треки"

    def __str__(self):
        return self.title

    def increment_plays(self):
        """Increment global play count"""
        self.plays += 1
        self.save(update_fields=['plays'])

    def increment_likes(self):
        """Increment global like count"""
        self.likes += 1
        self.save(update_fields=['likes'])

class UserTrackInteraction(models.Model):
    class InteractionTypes(models.TextChoices):
        LIKE = 'LIKE', 'Лайк'
        UNLIKE = 'UNLIKE', 'Дизлайк' # Or remove like
        PLAY_SESSION_START = 'PLAY_START', 'Начало прослушивания'
        PLAY_FULLY_COMPLETED = 'PLAY_FULL', 'Полное прослушивание'
        SKIP_EARLY = 'SKIP_EARLY', 'Пропуск в начале' # e.g. within first 30s
        SKIP_MIDDLE = 'SKIP_MIDDLE', 'Пропуск в середине'
        ADD_TO_PLAYLIST = 'ADD_PLAYLIST', 'Добавление в плейлист'
        REMOVE_FROM_PLAYLIST = 'REMOVE_PLAYLIST', 'Удаление из плейлиста'

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='track_interactions', verbose_name="Пользователь")
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name='user_interactions', verbose_name="Трек")
    interaction_type = models.CharField(
        max_length=20,
        choices=InteractionTypes.choices,
        verbose_name="Тип взаимодействия"
    )
    timestamp = models.DateTimeField(default=timezone.now, verbose_name="Время взаимодействия")
    # Optional: value, e.g. for rating, or duration for play
    # value = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Взаимодействие пользователя с треком"
        verbose_name_plural = "Взаимодействия пользователей с треками"
        # A user might interact multiple times in different ways or same way (e.g. multiple plays)
        # If specific interactions should be unique (e.g., one "LIKE" state per user/track),
        # that logic would be handled in the view or by having separate models like UserLikedTrack.
        # For now, this model logs each interaction event.

    def __str__(self):
        return f"{self.user.email} - {self.track.title} - {self.get_interaction_type_display()}"

class Playlist(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='playlists')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    tracks = models.ManyToManyField(Track, through='PlaylistTrack', related_name='playlists')

    def __str__(self):
        return self.name

    def add_track(self, track):
        PlaylistTrack.objects.create(playlist=self, track=track)
        # Log interaction
        UserTrackInteraction.objects.create(
            user=self.user,
            track=track,
            interaction_type=UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
        )

    def remove_track(self, track):
        PlaylistTrack.objects.filter(playlist=self, track=track).delete()
        # Log interaction
        UserTrackInteraction.objects.create(
            user=self.user,
            track=track,
            interaction_type=UserTrackInteraction.InteractionTypes.REMOVE_FROM_PLAYLIST
        )

class PlaylistTrack(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    track = models.ForeignKey(Track, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0) # Order of track in playlist
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        unique_together = ('playlist', 'track') # Track can only be once in a playlist

    def __str__(self):
        return f"{self.playlist.name} - {self.track.title}"