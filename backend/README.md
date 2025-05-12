# VibeTunes Backend

REST API на основе Django для музыкальной платформы VibeTunes.

## Функционал

- Аутентификация пользователей с JWT токенами
- Управление музыкальными треками
- Управление артистами и альбомами
- Создание и управление плейлистами
- Роли пользователей и разрешения

## Требования

- Python 3.9+
- PostgreSQL (рекомендуется) или SQLite

## Установка

1. Клонировать репозиторий
```bash
git clone https://github.com/Znbmels/music.git
cd music/backend
```

2. Создать и активировать виртуальное окружение
```bash
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
```

3. Установить зависимости
```bash
pip install -r requirements.txt
```

4. Настроить переменные окружения (создать файл .env в директории backend)
```
DEBUG=True
SECRET_KEY=your_secret_key
DATABASE_URL=your_database_url  # Опционально для PostgreSQL
```

5. Выполнить миграции
```bash
python manage.py migrate
```

6. Создать суперпользователя
```bash
python manage.py createsuperuser
```

7. Загрузить начальные данные (если доступны)
```bash
python manage.py loaddata fixtures/*.json
```

## Запуск сервера

Запустить сервер разработки:
```bash
python manage.py runserver
```

API будет доступно по адресу `http://localhost:8000/api/`.

## Документация API

Основные эндпоинты API включают:

- Аутентификация: `/api/auth/`
  - Вход: `/api/auth/login/`
  - Регистрация: `/api/auth/register/`
  - Обновление токена: `/api/auth/token/refresh/`

- Музыка: `/api/music/`
  - Треки: `/api/music/tracks/`
  - Альбомы: `/api/music/albums/`
  - Артисты: `/api/music/artists/`
  - Плейлисты: `/api/music/playlists/`

- Пользователи: `/api/users/`
  - Профиль: `/api/users/profile/`


``` 
