from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Track, Playlist, PlaylistTrack

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'is_musician', 'is_staff', 'date_joined')
    list_filter = ('is_musician', 'is_staff', 'is_active')
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
    list_display = ('title', 'musician', 'genre', 'plays', 'likes', 'created_at', 'is_active')
    list_filter = ('genre', 'is_active', 'created_at')
    search_fields = ('title', 'description', 'musician__email')
    ordering = ('-plays', '-created_at')
    readonly_fields = ('plays', 'likes', 'created_at')

class PlaylistTrackInline(admin.TabularInline):
    model = PlaylistTrack
    extra = 1

@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'is_public')
    list_filter = ('is_public', 'created_at')
    search_fields = ('name', 'user__email')
    ordering = ('-created_at',)
    inlines = [PlaylistTrackInline]
