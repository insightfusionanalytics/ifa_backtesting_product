# Deployment Guide — IFA Backtest Product

**Target:** existing IFA DigitalOcean droplet (Mumbai)
**Domain (prod):** `backtestingengine.insightfusionanalytics.com`
**Domain (staging):** `staging.backtestingengine.insightfusionanalytics.com`

There are two stacks on one droplet: **prod** and **staging**, each a separate clone with its own `.env.production` and `docker-compose.prod.yml`. They share Nginx (host-level) which routes by `server_name` + bind to different localhost ports.

| Stack | Backend port (localhost) | Frontend port (localhost) | Path |
|---|---|---|---|
| Prod | 8000 | 5173 | `/opt/ifa-backtest-product` |
| Staging | 8100 | 5273 | `/opt/ifa-backtest-product-staging` |

---

## 0. Rotate the credentials that leaked in chat (do first)

| Where | What |
|---|---|
| Firebase console → Project Settings → Service accounts | Revoke the old admin SDK key, generate new JSON |
| Supabase → Project Settings → API | Reset service-role key |
| Supabase → Project Settings → Database | Change DB password |
| Firebase → Authentication → Users → `insightfusionanalytics@gmail.com` | Reset password |

Keep new values ready — they go into `.env.production` and `backend/secrets/firebase-admin.json` on the droplet.

---

## 1. Buy + point the domain

1. In your domain registrar, add an A record:
   - `backtestingengine.insightfusionanalytics.com` → droplet IP
   - `staging.backtestingengine.insightfusionanalytics.com` → droplet IP (same IP, different subdomain)
2. Wait ~5–15 min for DNS propagation. Check with `dig backtestingengine.insightfusionanalytics.com`.

---

## 2. One-time droplet setup

SSH into the droplet, then:

```bash
# Install Docker + Docker Compose (if not already)
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin nginx certbot python3-certbot-nginx git

# Create app directories
sudo mkdir -p /opt/ifa-backtest-product /opt/ifa-backtest-product-staging
sudo chown $USER:$USER /opt/ifa-backtest-product /opt/ifa-backtest-product-staging

# Clone the repo into each
cd /opt/ifa-backtest-product            && git clone https://github.com/insightfusionanalytics/ifa_backtesting_product.git .
cd /opt/ifa-backtest-product-staging    && git clone https://github.com/insightfusionanalytics/ifa_backtesting_product.git .
```

---

## 3. Place secrets on the droplet (DO NOT commit)

For **prod** stack at `/opt/ifa-backtest-product/`:

```bash
# .env.production — copy template, edit values
cp .env.production.example .env.production
nano .env.production    # paste rotated keys + new main admin password

# Firebase service account JSON — copy from your local machine via scp:
#   scp ~/path/to/firebase-admin.json root@<droplet-ip>:/opt/ifa-backtest-product/backend/secrets/
mkdir -p backend/secrets
# (now scp the JSON in)
```

For **staging** stack at `/opt/ifa-backtest-product-staging/`:

```bash
cp .env.production.example .env.production
nano .env.production    # same values OR a separate Supabase/Firebase project for true isolation
```

In staging's `.env.production`, change the ports so they don't collide with prod's docker-compose:

```diff
- VITE_API_BASE_URL=https://backtestingengine.insightfusionanalytics.com/api/v1
+ VITE_API_BASE_URL=https://staging.backtestingengine.insightfusionanalytics.com/api/v1
```

And in `docker-compose.prod.yml` for staging, change ports:

```diff
- - "127.0.0.1:8000:8000"
+ - "127.0.0.1:8100:8000"
- - "127.0.0.1:5173:80"
+ - "127.0.0.1:5273:80"
```

---

## 4. Configure host Nginx

Copy `nginx/site.conf.template` into `/etc/nginx/sites-available/ifa-prod` (replace `${DOMAIN}` with the real domain and the ports if staging). One file per stack.

Example for prod at `/etc/nginx/sites-available/ifa-prod`:

```nginx
server {
    listen 80;
    server_name backtestingengine.insightfusionanalytics.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_read_timeout 120s;
        client_max_body_size 25M;
    }
}
```

Same again for staging at `/etc/nginx/sites-available/ifa-staging` with `5273` and `8100`, and `staging.backtestingengine...` as the server_name.

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/ifa-prod    /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ifa-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Get SSL certs (Let's Encrypt via certbot):

```bash
sudo certbot --nginx -d backtestingengine.insightfusionanalytics.com
sudo certbot --nginx -d staging.backtestingengine.insightfusionanalytics.com
```

---

## 5. First deploy

```bash
cd /opt/ifa-backtest-product
./deploy.sh
```

`deploy.sh` will:
- `git pull` latest main
- Verify `.env.production` and `firebase-admin.json` exist
- Build the backend + frontend Docker images
- Run `alembic upgrade head`
- Boot both containers
- Health-check the backend

Repeat for staging at `/opt/ifa-backtest-product-staging/`.

---

## 6. Seed the production database

Once containers are up, run the seed (creates main_admin in prod Firebase + the demo client). Skip the demo client if you don't want it in prod.

```bash
docker compose -f docker-compose.prod.yml exec backend python -m app.seed
```

Verify:

```bash
curl -fsS https://backtestingengine.insightfusionanalytics.com/healthz
# {"ok": true, ...}
```

Open the URL in a browser, log in as the main admin, confirm `/admin` loads.

---

## 7. GitHub Actions setup (one-time)

In the GitHub repo: **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|---|---|
| `DROPLET_HOST` | droplet public IP |
| `DROPLET_USER` | the username deploys run as (probably `root` or `deploy`) |
| `DROPLET_SSH_KEY` | private SSH key whose public half is in `~/.ssh/authorized_keys` on the droplet |
| `DROPLET_PORT` | (optional, default 22) |

Set up the environments under **Settings → Environments**:
- `staging` — no protection rules
- `production` — **add "Required reviewers"** with your GitHub account so prod deploys require manual approval

### How CI/CD works after that

- **Every push to `main`** → CI runs (lint/typecheck/build) → if green, **auto-deploys to staging**.
- **Prod deploys**: go to **Actions → Deploy → production → Run workflow** → enter `main` (or any commit SHA) → confirm. GitHub waits for your reviewer approval, then SSHes in and runs `deploy.sh` against the prod stack.

---

## 8. Onboard pilot clients

Once prod is up:

1. Log in to https://backtestingengine.insightfusionanalytics.com as the main admin.
2. `/admin/clients` → "New client" — fill in Michael's name, email, password, tier1.
3. Repeat for Sam and Ravi.
4. Share each set of credentials via WhatsApp / signed email.
5. They log in → walk the T&C → see their dashboard.
6. Upload one real backtest result JSON via `/admin/backtests/upload`.

---

## 9. Day-to-day ops

**Deploy a fix to staging:**
- Just push to `main`. CI passes. Staging auto-updates.

**Deploy to prod:**
- GitHub → Actions → "Deploy → production" → "Run workflow" → confirm.

**Roll back prod:**
- Same flow, just enter a previous commit SHA as the ref.

**Tail logs:**
```bash
ssh root@<droplet>
docker compose -f /opt/ifa-backtest-product/docker-compose.prod.yml logs -f backend
```

**Restart everything:**
```bash
cd /opt/ifa-backtest-product
docker compose -f docker-compose.prod.yml restart
```

**Run an ad-hoc DB query / script:**
```bash
docker compose -f docker-compose.prod.yml exec backend python -c "..."
```
