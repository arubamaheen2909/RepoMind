# RepoMind — Understand Any Codebase. Instantly.
WT EXPO 2026 · Stanley Women's Engineering College, Osmania University · B.E. CSE
Team: Arsheen Syeda (160624733069), Aruba Maheen (160624733070), Rida Fatima (160624733116) · Mentor: Ms. Bazila Wahaj

## Run locally
**Backend**: `cd backend && python -m venv .venv`, activate it (Windows: `.venv\Scripts\activate`; Mac/Linux: `source .venv/bin/activate`), `pip install -r requirements.txt`, copy `.env.example` to `.env`, set `GROQ_API_KEY`, run `uvicorn main:app --reload`.
**Frontend**: `cd frontend && npm install`, copy `.env.example` to `.env`, `npm run dev`.

## Endpoints (all `POST`, body `{"url": "https://github.com/owner/repo"}`)
`/analyze`, `/docs`, `/impact`, `/firstpr`, `/drift`, plus `GET /health`. Swagger UI is at `/swagger`.

## Deploy
GitHub: `git init && git add . && git commit -m "RepoMind" && git remote add origin <url> && git push -u origin main`.
Backend (Render/Railway): root `backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`; set `GROQ_API_KEY`, optional `GITHUB_TOKEN`, and `ALLOWED_ORIGINS` to your Vercel URL.
Frontend (Vercel): root `frontend`, framework Vite, set `VITE_API_URL` to the backend URL.
