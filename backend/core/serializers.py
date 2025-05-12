from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Track, Playlist

CustomUser = get_user_model()

class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('id', 'email', 'username', 'is_musician', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            is_musician=validated_data.get('is_musician', False)
        )
        return user

class TrackSerializer(serializers.ModelSerializer):
    musician = CustomUserSerializer(read_only=True)
    audio_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = ('id', 'musician', 'title', 'description', 'audio_file', 
                 'audio_url', 'cover_image', 'cover_url', 'plays', 'likes', 
                 'created_at', 'genre')
        read_only_fields = ('plays', 'likes', 'created_at')

    def get_audio_url(self, obj):
        if obj.audio_file:
            return self.context['request'].build_absolute_uri(obj.audio_file.url)
        return None

    def get_cover_url(self, obj):
        if obj.cover_image:
            return self.context['request'].build_absolute_uri(obj.cover_image.url)
        return None

class PlaylistSerializer(serializers.ModelSerializer):
    user = CustomUserSerializer(read_only=True)
    tracks = TrackSerializer(many=True, read_only=True)

    class Meta:
        model = Playlist
        fields = ('id', 'user', 'name', 'tracks', 'created_at')
        read_only_fields = ('created_at',)

class TrackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Track
        fields = ('title', 'description', 'audio_file', 'cover_image', 'genre')

    def validate_audio_file(self, value):
        # Validate audio file size (max 50MB)
        if value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError("Audio file size must be less than 50MB")
        return value

    def validate_cover_image(self, value):
        if value:
            # Validate cover image size (max 5MB)
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Cover image size must be less than 5MB")
        return value 