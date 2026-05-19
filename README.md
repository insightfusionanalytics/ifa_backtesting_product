# IFA Backtest Product

Client portal for strategy submission, backtest delivery, and reporting.

**Stack:** Vite + React + TypeScript · FastAPI · Supabase Postgres · Firebase Auth · DO Mumbai

See `../CODE_DESIGN.md` and `../IMPLEMENTATION_PLAN.md` for the full design.

## Local dev

```bash
# 1. Copy env
cp .env.example .env
# (fill in keys, or use the provided .env if already set up)

# 2. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Frontend at http://localhost:5173 · Backend at http://localhost:8000

## Project structure

```
backend/   FastAPI + SQLAlchemy + Alembic
frontend/  Vite + React + TS + Tailwind
secrets/   Firebase service account JSON (gitignored)
```

## Deploy
Day 4 — single DO droplet in Mumbai, Nginx + docker-compose.
