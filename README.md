# VibeTunes

Полнофункциональная музыкальная платформа с веб-интерфейсом на React и бэкендом на Django.

## Структура проекта

Проект состоит из двух основных частей:

### Backend (Django)

Серверная часть приложения, реализованная на Django с использованием Django REST Framework. Обеспечивает API для управления пользователями, музыкальными треками, плейлистами и другим контентом.

[Подробная документация по бэкенду](backend/README.md)

### Frontend (React + TypeScript)

Клиентская часть приложения, разработанная с использованием React, TypeScript и Tailwind CSS. Предоставляет пользовательский интерфейс для взаимодействия с API.

[Подробная документация по фронтенду](frontend/README.md)

## Быстрый старт

### Запуск бэкенда:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Запуск фронтенда:

```bash
cd frontend
npm install
npm run dev
```

После этого бэкенд будет доступен по адресу `http://localhost:8000/api/`, а фронтенд по адресу `http://localhost:5173/`.

## Разработка

При разработке рекомендуется запускать и бэкенд, и фронтенд одновременно в разных терминалах.

## Лицензия

Этот проект распространяется под лицензией MIT.
