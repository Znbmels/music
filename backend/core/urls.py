from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    TrackViewSet, PlaylistViewSet,
    UserRegistrationView, UserProfileView
)

router = DefaultRouter()
router.register(r'tracks', TrackViewSet, basename='track')
router.register(r'playlists', PlaylistViewSet, basename='playlist')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/me/', UserProfileView.as_view(), name='user-profile'),
] 