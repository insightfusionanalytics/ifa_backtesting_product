# Deployment guide — Render (backend) + Vercel (frontend)

This is the cloud-hosted path. The droplet-based plan in `DEPLOY.md` is the
original V1 target; this doc is the parallel "deploy fast, iterate" path.

> Postgres (Supabase) and Firebase Auth stay where they are — no changes to those.

## Architecture after deploy

```
            ┌────────────────────┐         ┌───────────────────────┐
            │  Vercel (frontend) │  HTTPS  │  Render (backend)     │
 user  ───▶ │  ifa-backtest      │ ──────▶ │  ifa-backtest-backend │
            │  *.vercel.app      │         │  *.onrender.com       │
            └────────────────────┘         └──────────┬────────────┘
                                                      │
                            ┌─────────────────────────┼─────────────────────────┐
                            ▼                         ▼                         ▼
                     Supabase Postgres      Supabase Storage           Firebase Auth
                     (DATABASE_URL_SYNC)    (signed URLs, PDFs)        (ID-token verify)
```

## Step 1 — Backend on Render

1. **Push the repo to GitHub** (private repo is fine; Render reads it via OAuth).
2. **Render dashboard** → New → **Blueprint** → pick this repo → Render auto-detects `render.yaml`.
3. Render starts the build using `backend/Dockerfile`. First build takes ~3-5 min.
4. **Fill in the env vars Render marked as "sync: false"** (the Blueprint asks for these on first deploy):
   - `ALLOWED_ORIGINS` — leave blank for now; you'll set this after the Vercel URL is known.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL_SYNC` — the `postgresql+psycopg2://...` connection string from Supabase
   - `FIREBASE_PROJECT_ID`
   - `MAIN_ADMIN_EMAIL`, `MAIN_ADMIN_INITIAL_PASSWORD` (only used if seed runs)
   - `SENTRY_DSN_BACKEND` — optional
5. **Upload the Firebase service-account JSON** as a Secret File:
   - Service → Environment → Secret Files → Add → path `/etc/secrets/firebase-admin.json`, paste JSON contents.
   - This path matches `FIREBASE_CREDENTIALS_PATH` set in `render.yaml`.
6. Render's **pre-deploy command** runs `alembic upgrade head` against the live DB. If migrations fail the deploy aborts and the previous version stays live.
7. Once green: visit `https://<service-name>.onrender.com/healthz` → expect `{"ok": true, ...}`.

### Free vs Starter plan

- **Free**: $0/mo. Service spins down after 15 min idle → first hit takes 30-60s. Fine for demos.
- **Starter**: $7/mo. Always-on. Worth it once real users hit it.

Edit `render.yaml` → `plan: starter` and redeploy.

## Step 2 — Frontend on Vercel

1. **Vercel dashboard** → Add New → Project → import the same GitHub repo.
2. **Root Directory**: set to `frontend`. This makes Vercel run the build inside `frontend/` so `npm run build` resolves correctly.
3. **Framework Preset**: Vite (auto-detected).
4. **Environment Variables** (Project Settings → Environment Variables → add to Production + Preview + Development):
   - `VITE_API_BASE_URL` = `https://<your-render-service>.onrender.com/api/v1`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - (optional) `VITE_SENTRY_DSN_FRONTEND`
5. Click **Deploy**. First build takes ~1-2 min.
6. You'll get a URL like `https://ifa-backtest-<hash>.vercel.app`.

## Step 3 — Close the loop (CORS + Firebase)

1. **Backend CORS**: in Render → Service → Environment → set
   `ALLOWED_ORIGINS=https://<your-vercel-domain>.vercel.app`
   (comma-separate if you have a custom domain + preview domain too).
   Render auto-redeploys on env change.
2. **Firebase Authorized Domains**: Firebase Console → Authentication → Settings → Authorized domains → add the Vercel domain. Without this, Firebase rejects sign-in attempts from the new host.

## Step 4 — Verify

Hit the Vercel URL:
1. Log in as the main admin → admin pulse loads (proves backend reachable + auth working).
2. Open a second browser → sign in as a test client → upload a strategy PDF.
3. Admin reloads → bell badge shows the new strategy → admin uploads a backtest result.
4. Client reloads → backtest row appears in Backtests page within 15s (polling).

## Things to watch

- **Cold starts on free tier**: the first request after idle takes 30-60s. Login may time out. Hit `/healthz` once to warm it up if demoing.
- **Render's ephemeral filesystem**: nothing written to disk survives a deploy. All artefacts go to Supabase Storage — we already do this.
- **Migrations**: Alembic runs on every deploy via `preDeployCommand`. If a migration is slow or risky, take it out of the pre-deploy step and run it manually as a Render Job.
- **Secret rotation**: when the Firebase service-account JSON was pasted in chat earlier, rotate it in the Firebase console first, then update the Secret File in Render.
