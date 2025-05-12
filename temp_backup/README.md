# VibeTunes Music Platform

A modern music streaming platform with an AI-powered recommendation engine using OpenAI's GPT API.

## System Components

### Backend (Django)
- User authentication and profiles
- Music catalog management
- GPT-powered recommendation service
- REST API endpoints

### Frontend (React + Vite)
- Responsive music player interface
- Personalized recommendation display
- Genre and mood filtering
- User feedback mechanisms

## Getting Started

### Prerequisites
- Python 3.8+ with virtual environment
- Node.js 16+ and npm
- OpenAI API key (for recommendations)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/vibetunes.git
cd vibetunes
```

2. Set up Python virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
cd backend
pip install -r requirements.txt
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

### Running the Application

#### Option 1: Using the convenience script (recommended)
```bash
./start_vibetunes.sh
```

#### Option 2: Manual startup
Start the backend:
```bash
cd backend
source ../venv/bin/activate  # On Windows: ..\venv\Scripts\activate
python manage.py runserver 127.0.0.1:8001
```

Start the frontend (in a separate terminal):
```bash
cd frontend
npm run dev
```

### Authentication for Development

The application automatically attempts to set up test authentication tokens in your browser's localStorage. If you see an authentication error:

1. Open browser developer tools (F12)
2. Go to Console tab
3. Type: `setupTestTokens()`
4. Refresh the page

## Using the Recommendation System

The recommendation system combines several data sources to provide personalized music suggestions:

1. **User Profile Analysis**
   - Listening history
   - Genre preferences
   - Favorite artists

2. **Contextual Information**
   - Time of day
   - Day of week
   - Recent activity patterns

3. **Interactive Filters**
   - Mood selection (Energetic, Relaxing, Neutral)
   - Genre selection (Pop, Rock, Hip-Hop, etc.)
   - Custom search queries

4. **Feedback Mechanisms**
   - Like/dislike buttons influence future recommendations
   - Listening duration and skipping behavior

### Troubleshooting

#### Connection Issues
If you see "Network Error" in the browser console:
- Make sure both backend and frontend servers are running
- Check that the backend port in `frontend/vite.config.ts` matches the running backend port
- Verify the OpenAI API key is valid and set in the environment variables

#### API Key Setup
For security reasons, the OpenAI API key is not hardcoded in the application. You need to:
1. Create a `.env` file in the `backend` directory with: `OPENAI_API_KEY=your_api_key_here`
2. Or set it directly in the `start_vibetunes.sh` script
3. Or set it as an environment variable before running the application: `export OPENAI_API_KEY=your_api_key_here`

#### No Recommendations Appearing
If the recommendation panel is empty:
- Check backend logs for GPT API response parsing issues
- Verify your OpenAI API key is valid and has sufficient credits
- Try different mood/genre filter combinations
- Use the test data fallback option

## Development Notes

- The recommendation service is located at `backend/core/services/recommendation_service.py`
- Frontend recommendation component is at `frontend/src/components/tracks/Recommendations.tsx`
- Authentication tokens are automatically set up via the localStorage utility

## License

This project is licensed under the MIT License - see the LICENSE file for details.
