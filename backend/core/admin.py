from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Track, Playlist, PlaylistTrack, Tag, UserTrackInteraction

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'is_musician', 'is_staff', 'date_joined', 'last_login')
    list_filter = ('is_musician', 'is_staff', 'date_joined')
    search_fields = ('email', 'username')
    ordering = ('-date_joined',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('username', 'is_musician')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'is_musician'),
        }),
    )

@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'musician', 'genre', 'plays', 'likes',
        'bpm', 'mood', 'suitable_for_time',
        'created_at', 'is_active'
    )
    list_filter = ('genre', 'is_active', 'created_at', 'suitable_for_time', 'mood')
    search_fields = ('title', 'description', 'musician__email', 'genre', 'mood', 'tags__name')
    ordering = ('-plays', '-created_at')
    readonly_fields = ('plays', 'likes', 'created_at')
    autocomplete_fields = ['musician', 'tags']
    fieldsets = (
        (None, {
            'fields': ('title', 'musician', 'description', 'audio_file', 'cover_image')
        }),
        ('Categorization', {
            'fields': ('genre', 'tags', 'mood', 'bpm', 'suitable_for_time')
        }),
        ('Stats & Status', {
            'fields': ('plays', 'likes', 'is_active', 'created_at')
        }),
    )

class PlaylistTrackInline(admin.TabularInline):
    model = PlaylistTrack
    extra = 1

@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at')
    search_fields = ('name', 'user__email')
    list_filter = ('created_at',)
    autocomplete_fields = ['user']
    inlines = [PlaylistTrackInline]

@admin.register(PlaylistTrack)
class PlaylistTrackAdmin(admin.ModelAdmin):
    list_display = ('playlist', 'track', 'order', 'added_at')
    search_fields = ('playlist__name', 'track__title')
    list_filter = ('added_at',)
    autocomplete_fields = ['playlist', 'track']

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}

@admin.register(UserTrackInteraction)
class UserTrackInteractionAdmin(admin.ModelAdmin):
    list_display = ('user', 'track', 'interaction_type', 'timestamp')
    search_fields = ('user__email', 'track__title', 'interaction_type')
    list_filter = ('interaction_type', 'timestamp')
    autocomplete_fields = ['user', 'track']
