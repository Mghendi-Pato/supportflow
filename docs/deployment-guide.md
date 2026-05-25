# SupportFlow — Deployment Guide
## Hosting on `support.nubiannetworks.com`
> Ubuntu + Nginx server · DNS on Cloudflare · SSL via Let's Encrypt

---

## Architecture overview

```
Browser
  │
  ▼
Cloudflare (DNS + proxy)
  │
  ▼
Nginx on your server
  ├── /          → Next.js  frontend  (localhost:3000)
  ├── /api/v1/*  → NestJS   backend   (localhost:3001)
  └── /graphql   → NestJS   GraphQL   (localhost:3001)  ← WebSocket upgrade
```

Both apps run as background processes managed by **PM2**.

---

## Step 1 — Add the DNS record in Cloudflare

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) and select **nubiannetworks.com**.
2. Go to **DNS → Records → Add record**.
3. Fill in:

   | Field   | Value                          |
   |---------|-------------------------------|
   | Type    | `A`                            |
   | Name    | `support`                      |
   | IPv4    | `<your server's public IP>`    |
   | Proxy   | **Proxied** (orange cloud) ✅  |
   | TTL     | Auto                           |

4. Click **Save**.

> **Why proxied?** Cloudflare will handle HTTPS termination and DDoS protection in front of your server. You still need an SSL cert on Nginx (Step 4) so Cloudflare can talk to your server over HTTPS ("Full (strict)" mode).

---

## Step 2 — Prepare the server

SSH into your server and install the tools you need (skip any already installed):

```bash
# Node.js 20 LTS (skip if already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 — production process manager
sudo npm install -g pm2

# Certbot — for the SSL certificate
sudo apt install -y certbot python3-certbot-nginx

# Verify
node -v   # should print v20.x.x
pm2 -v
nginx -v
```

---

## Step 3 — Upload and build the app

### 3a. Copy the project to the server

From your **local machine**:

```bash
# Option A — rsync (fastest, skips node_modules and .next)
rsync -avz --exclude='node_modules' --exclude='.next' \
  /path/to/nubian_support/ \
  user@YOUR_SERVER_IP:/var/www/supportflow/

# Option B — git clone (if you push to a repo)
# ssh into server first, then:
# git clone https://github.com/yourname/supportflow.git /var/www/supportflow
```

### 3b. Create production environment files

**Backend** — `/var/www/supportflow/backend/.env`

```bash
sudo nano /var/www/supportflow/backend/.env
```

```env
NODE_ENV=production
PORT=3001

# PostgreSQL
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASS@127.0.0.1:5432/supportflow_db

# JWT — generate strong secrets: openssl rand -hex 64
JWT_SECRET=REPLACE_WITH_STRONG_SECRET
JWT_REFRESH_SECRET=REPLACE_WITH_ANOTHER_STRONG_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Resend (for emails)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=support@nubiannetworks.com

# App URL — used in email links
APP_URL=https://support.nubiannetworks.com
CLIENT_PORTAL_URL=https://support.nubiannetworks.com/portal
```

**Frontend** — `/var/www/supportflow/frontend/.env.production`

```bash
sudo nano /var/www/supportflow/frontend/.env.production
```

```env
NEXT_PUBLIC_API_URL=https://support.nubiannetworks.com/api/v1
```

> The Apollo GraphQL client derives the WebSocket URL automatically from `NEXT_PUBLIC_API_URL` by stripping `/api/v1`, so no separate WS variable is needed.

### 3c. Install dependencies and build

```bash
# ── Backend ──────────────────────────────────────────────────
cd /var/www/supportflow/backend
npm ci --omit=dev

# Run the pending migration (adds assigned_at column)
npx prisma migrate deploy

# Compile TypeScript
npm run build


# ── Frontend ─────────────────────────────────────────────────
cd /var/www/supportflow/frontend
npm ci

npm run build
```

> `prisma migrate deploy` applies any pending migrations without prompting — safe for CI/production.

---

## Step 4 — SSL certificate

Before issuing the cert, create a **temporary bare-bones Nginx config** so Certbot can complete the HTTP-01 challenge:

```bash
sudo nano /etc/nginx/sites-available/support.nubiannetworks.com
```

Paste:

```nginx
server {
    listen 80;
    server_name support.nubiannetworks.com;
    root /var/www/html;
    location / { return 200 'ok'; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/support.nubiannetworks.com \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Issue the certificate
sudo certbot --nginx -d support.nubiannetworks.com
```

Follow the Certbot prompts. When it asks about redirects, choose **No redirect** (Cloudflare handles that).

---

## Step 5 — Final Nginx configuration

Now replace the temp config with the full reverse-proxy setup:

```bash
sudo nano /etc/nginx/sites-available/support.nubiannetworks.com
```

Paste the entire block below:

```nginx
# ── HTTP → HTTPS redirect ────────────────────────────────────────────────────
server {
    listen 80;
    server_name support.nubiannetworks.com;
    return 301 https://$host$request_uri;
}

# ── HTTPS — main server block ────────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name support.nubiannetworks.com;

    ssl_certificate     /etc/letsencrypt/live/support.nubiannetworks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/support.nubiannetworks.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # ── NestJS REST API ──────────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # ── GraphQL endpoint + WebSocket subscriptions ───────────────────────────
    location /graphql {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # WebSocket upgrade (required for Apollo subscriptions)
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";

        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Keep WebSocket connections alive
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # ── Next.js frontend (catch-all) ─────────────────────────────────────────
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Test and reload:

```bash
sudo nginx -t        # must print "syntax is ok"
sudo systemctl reload nginx
```

---

## Step 6 — Start the apps with PM2

```bash
# ── Backend ──────────────────────────────────────────────────
cd /var/www/supportflow/backend
pm2 start dist/main.js --name "supportflow-api" --env production

# ── Frontend ─────────────────────────────────────────────────
cd /var/www/supportflow/frontend
pm2 start npm --name "supportflow-web" -- start

# Save the PM2 process list so it survives reboots
pm2 save

# Register PM2 to start on server boot
pm2 startup
# ↑ It prints a command — copy and run it (looks like: sudo env PATH=... pm2 startup ...)
```

Check that both are running:

```bash
pm2 list
pm2 logs supportflow-api --lines 30
pm2 logs supportflow-web --lines 30
```

---

## Step 7 — Cloudflare SSL mode

In Cloudflare dashboard → **SSL/TLS → Overview**, set the mode to **Full (strict)**.

This ensures Cloudflare validates your Let's Encrypt cert when connecting to your origin.

---

## Step 8 — Verify everything works

```bash
# Should return JSON with API info
curl https://support.nubiannetworks.com/api/v1/

# Should return the GraphQL playground (or 400 if playground is disabled in prod)
curl https://support.nubiannetworks.com/graphql

# Should return HTML (Next.js login page)
curl -I https://support.nubiannetworks.com
```

Then open `https://support.nubiannetworks.com` in your browser — you should see the SupportFlow login page.

---

## Ongoing — Deploying updates

After pushing code changes, run this on the server:

```bash
cd /var/www/supportflow

# Pull latest code (if using git)
git pull

# Backend — rebuild and restart
cd backend && npm ci --omit=dev && npm run build
pm2 restart supportflow-api

# Frontend — rebuild and restart
cd ../frontend && npm ci && npm run build
pm2 restart supportflow-web
```

---

## Quick troubleshooting reference

| Symptom | What to check |
|---|---|
| 502 Bad Gateway | `pm2 list` — is the app running? Check `pm2 logs` |
| SSL error in browser | Cloudflare mode set to Full (strict)? Cert not expired? |
| API calls fail (CORS) | Check `NEXT_PUBLIC_API_URL` in frontend `.env.production` |
| WebSocket disconnects | Nginx `proxy_read_timeout` set to 3600s? (see Step 5) |
| Chat not working | Check `/graphql` location block has Upgrade headers |
| Migration errors | Run `npx prisma migrate deploy` in `/backend` |
| Changes not showing | Did you rebuild + restart PM2? `pm2 restart all` |

---

## Certificate auto-renewal

Certbot installs a cron job automatically. Verify it:

```bash
sudo systemctl status certbot.timer
# or check: sudo crontab -l
```

If missing, add it manually:

```bash
sudo crontab -e
# Add this line:
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

*Generated for SupportFlow · support.nubiannetworks.com*
