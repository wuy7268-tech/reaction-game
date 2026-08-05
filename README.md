# Reaction & Stroop Lab

A small web app for measuring reaction time and trying a Stroop colour test. Scores are saved on a FastAPI backend with SQLite, and the UI shows stats plus a progress chart over time.

## Tech stack

- **Frontend:** React + Vite
- **Backend:** FastAPI + Uvicorn
- **Database:** SQLite (`backend/scores.db`)
- **Charts:** Recharts
- **Tests:** pytest

## Features

- Reaction game: wait for green, click as fast as you can
- Stroop test: pick the ink colour, not the word
- Scores stored with a timestamp and game label (`reaction` / `stroop`)
- `GET /stats` for best time, average time, and attempts per game
- Progress line chart with one line per game
- Clear “couldn't reach the server” message if the backend is down

## How to run

You need two terminals, both from the project root.

### 1. Install dependencies (first time)

```bash
# Frontend
npm install

# Backend
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

### 2. Start the backend

```bash
npm run api
```

API docs: http://localhost:8000/docs

### 3. Start the frontend

```bash
npm run dev
```

App: http://localhost:5173/

## Tests

```bash
cd backend
../.venv/bin/pytest -q
```

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/scores` | Save a score |
| GET | `/scores` | List recent scores (`?game=reaction\|stroop`) |
| GET | `/stats` | Best / average / attempts per game |
| DELETE | `/scores` | Clear all scores |
