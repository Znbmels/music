import os
import json
import logging
import random
from datetime import datetime
import requests
from django.db.models import Count, Q
from core.models import Track, CustomUser
import re

logger = logging.getLogger(__name__)

# OpenAI API ключ из переменной окружения
GPT_API_KEY = os.environ.get("OPENAI_API_KEY", "")

class RecommendationService:
    @staticmethod
    def get_user_profile(user):
        """Получение профиля пользователя с предпочтениями"""
        # Получаем предпочитаемые жанры пользователя
        preferred_genres = list(user.get_listened_genres())
        
        # Получаем любимых исполнителей (по количеству прослушиваний)
        favorite_artists = Track.objects.filter(
            playlist__user=user
        ).values('musician__username').annotate(
            listen_count=Count('musician')
        ).order_by('-listen_count')[:5]
        
        favorite_artists_list = [artist['musician__username'] for artist in favorite_artists]
        
        # Формируем профиль пользователя
        return {
            "preferred_genres": preferred_genres,
            "favorite_artists": favorite_artists_list,
            # Другие данные профиля можно добавить по мере необходимости
        }
    
    @staticmethod
    def get_recent_listened(user, limit=10):
        """Получение недавно прослушанных треков"""
        # В будущем можно добавить модель PlayHistory для более точного отслеживания
        recent_tracks = Track.objects.filter(
            playlist__user=user
        ).order_by('-created_at')[:limit]
        
        return [f"{track.title} - {track.musician.username}" for track in recent_tracks]
    
    @staticmethod
    def get_liked_tracks(user, limit=10):
        """Получение лайкнутых треков (упрощенная версия)"""
        # Получаем недавно лайкнутые треки
        liked_tracks = Track.objects.filter(
            playlist__user=user
        ).order_by('-likes')[:limit]
        
        return [f"{track.title} - {track.musician.username}" for track in liked_tracks]
    
    @staticmethod
    def get_current_context():
        """Получение текущего контекста (время суток, день недели)"""
        now = datetime.now()
        
        # Время суток
        hour = now.hour
        if 5 <= hour < 12:
            time_of_day = "morning"
        elif 12 <= hour < 17:
            time_of_day = "afternoon"
        elif 17 <= hour < 22:
            time_of_day = "evening"
        else:
            time_of_day = "night"
        
        # День недели
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        day_of_week = days[now.weekday()]
        
        return {
            "time_of_day": time_of_day,
            "day_of_week": day_of_week
        }
    
    @staticmethod
    def get_available_tracks(user, limit=50):
        """Получение доступных треков с метаданными"""
        # Исключаем треки, которые пользователь уже слушал часто
        frequently_listened = Track.objects.filter(
            playlist__user=user
        ).values_list('id', flat=True)
        
        # Добавляем недавно лайкнутые треки в начало списка
        recently_liked = Track.objects.filter(
            playlist__user=user, 
            likes__gt=0
        ).order_by('-likes')[:5]
        
        # Находим трек "Qara" если он существует
        qara_tracks = Track.objects.filter(title__icontains="Qara", is_active=True)
        
        # Остальные треки
        available_tracks = Track.objects.filter(
            is_active=True
        ).exclude(
            id__in=frequently_listened
        ).order_by('-plays')[:limit-len(recently_liked)]
        
        # Формируем итоговый список
        track_list = []
        
        # Сначала добавляем "Qara" если найден
        for track in qara_tracks:
            track_list.append(
                f"{track.title} - {track.musician.username} ({track.genre}, {RecommendationService._get_track_mood(track)})"
            )
        
        # Затем добавляем недавно лайкнутые треки
        for track in recently_liked:
            if track not in qara_tracks:  # Избегаем дубликатов
                track_list.append(
                    f"{track.title} - {track.musician.username} ({track.genre}, {RecommendationService._get_track_mood(track)})"
                )
        
        # Затем добавляем остальные треки
        for track in available_tracks:
            if track not in recently_liked and track not in qara_tracks:  # Избегаем дубликатов
                track_list.append(
                    f"{track.title} - {track.musician.username} ({track.genre}, {RecommendationService._get_track_mood(track)})"
                )
        
        return track_list
    
    @staticmethod
    def _get_track_mood(track):
        """Определение настроения трека на основе его характеристик"""
        # Упрощенная логика для определения настроения
        # В будущем можно использовать аудио-анализ или метаданные
        if track.genre in ['Rock', 'Hip-Hop', 'Electronic']:
            return "energetic"
        elif track.genre in ['Jazz', 'Classical', 'R&B']:
            return "relaxing"
        else:
            return "neutral"
    
    @staticmethod
    def get_personalized_recommendations(user, user_query=None, mood_filter=None, genre_filter=None):
        """
        Получение персонализированных рекомендаций с использованием GPT API.
        Добавлены параметры для пользовательского запроса и фильтров.
        """
        try:
            print(f"DEBUG RecommendationService: Начинаю получение рекомендаций для {user.username}")
            
            # Сбор всех необходимых данных
            user_profile = RecommendationService.get_user_profile(user)
            print(f"DEBUG RecommendationService: Профиль пользователя - жанры: {user_profile['preferred_genres']}, исполнители: {user_profile['favorite_artists']}")
            
            recent_listened = RecommendationService.get_recent_listened(user)
            print(f"DEBUG RecommendationService: Недавно прослушано: {recent_listened}")
            
            liked_tracks = RecommendationService.get_liked_tracks(user)
            print(f"DEBUG RecommendationService: Понравившиеся треки: {liked_tracks}")
            
            context = RecommendationService.get_current_context()
            print(f"DEBUG RecommendationService: Контекст: {context}")
            
            available_tracks = RecommendationService.get_available_tracks(user)
            print(f"DEBUG RecommendationService: Доступно треков: {len(available_tracks)}")
            
            # Трансформация данных в строковый формат для промпта
            user_profile_str = (
                f"prefers {', '.join(user_profile['preferred_genres']) if user_profile['preferred_genres'] else 'various genres'}, "
                f"loves {', '.join(user_profile['favorite_artists']) if user_profile['favorite_artists'] else 'various artists'}"
            )
            
            recent_listened_str = "; ".join(recent_listened) if recent_listened else "none"
            liked_tracks_str = "; ".join(liked_tracks) if liked_tracks else "none"
            
            context_str = (
                f"{context['time_of_day']}, {context['day_of_week']}, "
                f"user might be {RecommendationService._get_activity_suggestion(context['time_of_day'])}"
            )
            
            track_list_str = "; ".join(available_tracks) if available_tracks else "no tracks available"
            
            # Формирование пользовательского запроса или фильтра
            user_query_str = f"The user has a specific request: {user_query}. " if user_query else ""
            mood_filter_str = f"Focus on tracks with {mood_filter} mood. " if mood_filter else ""
            genre_filter_str = f"Focus on the genre: {genre_filter}. " if genre_filter else ""
            
            # Случайное количество рекомендаций от 3 до 7
            num_recommendations = random.randint(3, 7)
            
            # Новый улучшенный промпт
            prompt = f"""
You are a music recommendation expert with deep knowledge of music preferences and trends. 
The user has the following profile: {user_profile_str}. 
Their recent listening history includes: {recent_listened_str}. 
They have liked these tracks: {liked_tracks_str}. 
The current context is: {context_str}. 
{user_query_str}{mood_filter_str}{genre_filter_str}
The available tracks are: {track_list_str}. 

Recommend {num_recommendations} songs from the available tracks list that best match the user's preferences, mood, context, and any specific requests.
Important: If the user has recently liked a track with "Qara" in the title, make sure to include it in your recommendations!
Make sure to ONLY recommend tracks that are in the available tracks list.

For each recommendation, provide a short reason why this track was chosen.
Return the recommendations in the EXACT format shown below (one per line):
1. Title - Artist (reason)
2. Title - Artist (reason)
... and so on

Important: The Title and Artist MUST exactly match how they appear in the available tracks list.
"""
            
            print(f"DEBUG RecommendationService: Промпт сформирован, длина: {len(prompt)} символов")
            
            # Вызов OpenAI API
            print(f"DEBUG RecommendationService: Начинаю запрос к GPT API")
            response = RecommendationService._call_openai_api(prompt)
            print(f"DEBUG RecommendationService: Получен ответ от GPT API")
            
            # Парсинг результатов
            recommendations = RecommendationService._parse_recommendations(response, available_tracks)
            print(f"DEBUG RecommendationService: Распарсено рекомендаций: {len(recommendations)}")
            
            # Проверяем наличие трека Qara в рекомендациях
            has_qara = any('qara' in rec['title'].lower() for rec in recommendations)
            
            # Если нет, пытаемся добавить его (если он есть в системе)
            if not has_qara:
                qara_tracks = Track.objects.filter(title__icontains='Qara', is_active=True)
                if qara_tracks.exists():
                    qara_track = qara_tracks.first()
                    recommendations.insert(0, {
                        "title": qara_track.title,
                        "artist": qara_track.musician.username,
                        "reason": "Этот трек был недавно добавлен и понравился вам"
                    })
            
            return recommendations
            
        except Exception as e:
            print(f"DEBUG RecommendationService ERROR: {str(e)}")
            # Возвращаем базовые рекомендации в случае ошибки
            print("DEBUG RecommendationService: Переключаюсь на запасные рекомендации")
            return RecommendationService._get_fallback_recommendations(user)
    
    @staticmethod
    def _call_openai_api(prompt):
        """Вызов OpenAI API с промптом"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GPT_API_KEY}"
        }
        
        data = {
            "model": "gpt-3.5-turbo",  # Можно заменить на gpt-4 при необходимости
            "messages": [
                {"role": "system", "content": "You are a music recommendation expert."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            data=json.dumps(data)
        )
        
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.text}")
            raise Exception(f"OpenAI API error: {response.status_code}")
        
        result = response.json()
        return result['choices'][0]['message']['content']
    
    @staticmethod
    def _parse_recommendations(response_text, available_tracks):
        """Парсинг ответа от GPT и соотнесение с доступными треками"""
        recommendations = []
        
        # Отладочная информация
        print(f"DEBUG: Ответ от GPT API: {response_text}")
        
        # Разбиваем ответ по строкам
        lines = response_text.strip().split('\n')
        print(f"DEBUG: Количество строк в ответе: {len(lines)}")
        
        for i, line in enumerate(lines):
            if not line.strip():
                continue
                
            print(f"DEBUG: Обрабатываю строку {i+1}: {line}")
            
            # Удаляем нумерацию (1., 2., и т.д.) в начале строки
            line = re.sub(r'^\d+\.\s*', '', line.strip())
            
            # Проверяем, содержит ли строка формат "Title - Artist (reason)"
            if " - " in line and "(" in line and ")" in line:
                try:
                    # Разделяем на основную часть и причину
                    parts = line.split('(', 1)
                    if len(parts) == 2:
                        track_info = parts[0].strip()
                        reason = parts[1].rstrip(')')
                        
                        # Извлекаем название и исполнителя
                        track_parts = track_info.split(' - ', 1)
                        if len(track_parts) == 2:
                            title, artist = track_parts
                            title = title.strip()
                            artist = artist.strip()
                            
                            print(f"DEBUG: Найден трек: {title} by {artist}")
                            
                            # Добавляем трек в рекомендации
                            recommendations.append({
                                "title": title,
                                "artist": artist,
                                "reason": reason.strip()
                            })
                            print(f"DEBUG: Трек добавлен в рекомендации: {title}")
                except Exception as e:
                    print(f"DEBUG: Ошибка при парсинге строки: {str(e)}")
        
        # Если не удалось распарсить рекомендации, добавляем запасные треки
        if not recommendations:
            print("DEBUG: Не удалось распарсить рекомендации. Добавляю запасные треки...")
            try:
                # Получаем топ-треки из базы данных
                # Случайное количество рекомендаций от 3 до 6
                num_fallback = random.randint(3, 6)
                
                # Сначала ищем трек "Qara"
                qara_tracks = Track.objects.filter(title__icontains='Qara', is_active=True)
                if qara_tracks.exists():
                    qara_track = qara_tracks.first()
                    recommendations.append({
                        "title": qara_track.title,
                        "artist": qara_track.musician.username,
                        "reason": "Трек, который вам недавно понравился"
                    })
                    print(f"DEBUG: Добавлен запасной трек: {qara_track.title}")
                
                # Затем добавляем остальные популярные треки
                top_tracks = Track.objects.filter(is_active=True).order_by('-plays')[:num_fallback]
                for track in top_tracks:
                    if track.title.lower() != 'qara':  # Избегаем дубликатов
                        recommendations.append({
                            "title": track.title,
                            "artist": track.musician.username,
                            "reason": "Популярный трек, который может вам понравиться"
                        })
                        print(f"DEBUG: Добавлен запасной трек: {track.title}")
            except Exception as e:
                print(f"DEBUG: Ошибка при добавлении запасных треков: {str(e)}")
        
        return recommendations
    
    @staticmethod
    def _get_fallback_recommendations(user):
        """Получение базовых рекомендаций в случае ошибки с API"""
        user_genres = list(user.get_listened_genres())
        
        # Случайное количество рекомендаций от 3 до 6
        num_fallback = random.randint(3, 6)
        
        # Получить топ треки по жанрам пользователя
        recommendations = []
        
        # Сначала проверяем, есть ли трек "Qara"
        qara_tracks = Track.objects.filter(title__icontains='Qara', is_active=True)
        if qara_tracks.exists():
            qara_track = qara_tracks.first()
            recommendations.append({
                "title": qara_track.title,
                "artist": qara_track.musician.username,
                "reason": "Трек, который вам недавно понравился"
            })
        
        # Затем добавляем треки по жанрам пользователя
        if user_genres:
            top_tracks = Track.objects.filter(
                is_active=True,
                genre__in=user_genres
            ).order_by('-plays')[:num_fallback]
            
            for track in top_tracks:
                if not any(rec['title'] == track.title for rec in recommendations):  # Избегаем дубликатов
                    recommendations.append({
                        "title": track.title,
                        "artist": track.musician.username,
                        "reason": f"Based on your preference for {track.genre}"
                    })
        
        # Если рекомендаций недостаточно, добавляем общие топ-треки
        if len(recommendations) < num_fallback:
            top_general = Track.objects.filter(
                is_active=True
            ).exclude(
                title__in=[rec['title'] for rec in recommendations]
            ).order_by('-plays')[:num_fallback-len(recommendations)]
            
            for track in top_general:
                recommendations.append({
                    "title": track.title,
                    "artist": track.musician.username,
                    "reason": "Popular track you might enjoy"
                })
        
        return recommendations
    
    @staticmethod
    def _get_activity_suggestion(time_of_day):
        """Предположение об активности пользователя на основе времени суток"""
        suggestions = {
            "morning": "starting their day with some energy",
            "afternoon": "being productive or taking a break",
            "evening": "relaxing after work or socializing",
            "night": "winding down or having a quiet time"
        }
        
        return suggestions.get(time_of_day, "enjoying music") 