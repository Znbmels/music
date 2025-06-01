import google.generativeai as genai
import logging
from django.conf import settings
from .models import Track, UserTrackInteraction, CustomUser

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)

# For safety settings, you can refer to:
# https://ai.google.dev/gemini-api/docs/safety-settings
generation_config = {
    "temperature": 0.7,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

safety_settings = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
]

model = genai.GenerativeModel(model_name="gemini-1.0-pro",
                              generation_config=generation_config,
                              safety_settings=safety_settings)

def generate_recommendations_with_gemini(user: CustomUser, current_track: Track = None, count: int = 10):
    """
    Generates music recommendations for a user using Gemini API.
    """
    if not settings.GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not configured.")
        return []

    try:
        # 1. Gather user data
        logger.debug(f"Fetching interaction data for user {user.id} ({user.username})")
        user_listened_tracks = UserTrackInteraction.objects.filter(
            user=user,
            interaction_type__in=[
                UserTrackInteraction.InteractionTypes.PLAY_FULLY_COMPLETED,
                UserTrackInteraction.InteractionTypes.ADD_TO_PLAYLIST
            ]
        ).select_related('track', 'track__musician').order_by('-timestamp')[:20]

        liked_tracks = UserTrackInteraction.objects.filter(
            user=user,
            interaction_type=UserTrackInteraction.InteractionTypes.LIKE
        ).select_related('track', 'track__musician').order_by('-timestamp')[:10]

        logger.debug(f"User {user.id}: Found {len(user_listened_tracks)} listened/playlist tracks and {len(liked_tracks)} liked tracks.")

        # 2. Construct the prompt
        prompt_parts = [
            "Ты — продвинутый AI-ассистент для музыкального сервиса VibeTunes.",
            f"Мне нужны музыкальные рекомендации для пользователя: {user.username}.",
            "Вот немного информации о его предпочтениях:",
        ]

        if user_listened_tracks:
            prompt_parts.append("\nНедавно прослушанные или добавленные в плейлисты треки:")
            for interaction in user_listened_tracks:
                track = interaction.track
                prompt_parts.append(f"- '{track.title}' исполнителя {track.musician.username if track.musician else 'Unknown Artist'} (Жанр: {track.genre or 'N/A'})")

        if liked_tracks:
            prompt_parts.append("\nЛайкнутые треки:")
            for interaction in liked_tracks:
                track = interaction.track
                prompt_parts.append(f"- '{track.title}' исполнителя {track.musician.username if track.musician else 'Unknown Artist'} (Жанр: {track.genre or 'N/A'})")

        if current_track:
            prompt_parts.append(f"\nСейчас пользователь слушает трек: '{current_track.title}' исполнителя {current_track.musician.username if current_track.musician else 'Unknown Artist'} (Жанр: {current_track.genre or 'N/A'}). Попробуй подобрать что-то похожее или дополняющее этот трек.")

        if not user_listened_tracks and not liked_tracks and not current_track:
            prompt_parts.append("\nУ пользователя пока нет истории прослушиваний или лайков. Порекомендуй популярные или разнообразные треки, чтобы помочь ему найти что-то интересное.")

        prompt_parts.append(f"\nПожалуйста, порекомендуй {count} треков. Названия треков должны быть точными, как они хранятся в базе данных, если это возможно. Если ты придумываешь треки, укажи это.")
        prompt_parts.append("Ответ дай в формате списка названий треков, каждое название на новой строке. Например:")
        prompt_parts.append("Название трека 1\nНазвание трека 2\nНазвание трека 3")
        prompt_parts.append("\nВажно: НЕ добавляй нумерацию или маркеры списка (типа -, *, 1.) к названиям треков в ответе. Только названия, каждое на новой строке.")

        full_prompt = "\n".join(prompt_parts)
        logger.debug(f"Gemini Prompt for user {user.id} ({user.username}):\n{full_prompt}")

        response = model.generate_content(full_prompt)

        logger.debug(f"Raw Gemini response for user {user.id}: {response.text if response and response.text else 'No text in response'}")

        if not response.candidates or not response.candidates[0].content.parts:
            logger.warning(f"Gemini API returned no candidates or empty content for user {user.id}")
            return []

        raw_recommendations = response.text.strip().split('\n')
        logger.debug(f"Raw Gemini recommendations (split by newline) for user {user.id}: {raw_recommendations}")

        recommended_track_titles = [title.strip() for title in raw_recommendations if title.strip()]
        logger.debug(f"Processed recommended track titles from Gemini for user {user.id}: {recommended_track_titles}")

        # 3. Fetch Track objects from database based on titles
        # This is a simple approach. Gemini might hallucinate titles or give slight variations.
        # A more robust solution might involve fuzzy matching or searching by artist + title.
        recommended_tracks = []
        if recommended_track_titles:
            # We try to find exact matches.
            # For a more robust system, you might need to implement fuzzy search
            # or ask Gemini to return IDs if it had access to your track database details.
            tracks_from_db = Track.objects.filter(title__in=recommended_track_titles, is_active=True)
            logger.debug(f"Found {tracks_from_db.count()} tracks in DB matching titles: {list(tracks_from_db.values_list('title', flat=True))}")
            
            # Create a dictionary for quick lookups
            tracks_map = {track.title: track for track in tracks_from_db}
            
            # Preserve order from Gemini if possible, and filter out non-existent tracks
            for title in recommended_track_titles:
                if title in tracks_map and tracks_map[title] not in recommended_tracks:
                    recommended_tracks.append(tracks_map[title])
            
            # If Gemini returns fewer valid tracks than requested, we might need a fallback.
            # For now, we just return what we found.
            
        logger.info(f"Retrieved {len(recommended_tracks)} final tracks from DB based on Gemini recommendations for user {user.id} ({user.username})")
        return recommended_tracks

    except Exception as e:
        logger.error(f"Error generating recommendations with Gemini for user {user.id}: {e}", exc_info=True)
        return []

def get_recommendations_for_visual_update(user: CustomUser, current_track_id: int = None, count: int = 5):
    """
    Specific function to get fewer recommendations, potentially focused on the current track,
    suitable for quick visual updates on the frontend.
    """
    current_track_obj = None
    if current_track_id:
        try:
            current_track_obj = Track.objects.get(id=current_track_id, is_active=True)
        except Track.DoesNotExist:
            logger.warning(f"Track with id {current_track_id} not found for visual update recommendations.")
            pass # Continue without current track if not found

    # Call the main Gemini recommendation function
    return generate_recommendations_with_gemini(user, current_track=current_track_obj, count=count) 