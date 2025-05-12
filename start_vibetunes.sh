#!/bin/bash

# Stop any existing processes
echo "Stopping any existing VibeTunes processes..."
pkill -f "python.*manage.py runserver" || true
pkill -f "npm run dev" || true

# Make sure the script exits if any command fails
set -e

# Setup environment variables
export OPENAI_API_KEY=""  # Leave empty by default, should be set from .env file

# Define the project directories
BACKEND_DIR="$(pwd)/backend"
FRONTEND_DIR="$(pwd)/frontend"
VENV_DIR="$(pwd)/backend/venv"
PYTHON_PATH="$VENV_DIR/bin/python"

# Activate the virtual environment and start the backend
echo "Starting Django backend on port 8001..."
cd "$BACKEND_DIR"
source "$VENV_DIR/bin/activate"

# Start the frontend
echo "Starting React frontend..."
cd "$FRONTEND_DIR"

echo "VibeTunes is starting..."

# Run both services in the background
cd "$BACKEND_DIR"
"$PYTHON_PATH" manage.py runserver 127.0.0.1:8001 &
BACKEND_PID=$!
echo "Backend running (PID: $BACKEND_PID)"

cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo "Frontend running (PID: $FRONTEND_PID)"

echo "Press Ctrl+C to stop all services"

# Keep the script running and handle interrupts
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait 