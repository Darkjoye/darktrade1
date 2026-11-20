# DarkTrade — Supabase PostgreSQL edition

## GitHub
Upload all files and folders in this project to the root of your existing `darktrade1` repository, replacing the old versions. The `public` folder must contain `index.html`, `styles.css`, and `app.js`.

## Supabase database
In Supabase, open Project Settings → Database → Connection string. Choose URI. Copy the connection string and replace its password placeholder with your database password. If direct connection fails on a hosting provider, use Supabase's Session Pooler URI. Keep this string secret.

## Render deployment
Create a Render Web Service from the GitHub repository:
- Build command: `npm install`
- Start command: `npm start`

Set environment variables in Render:
- `NODE_ENV` = `production`
- `SESSION_SECRET` = a random secret at least 32 characters long
- `DATABASE_URL` = Supabase PostgreSQL connection string
- `ADMIN_EMAIL` = your own email address

The server creates its database tables on first startup. Register on DarkTrade with the exact `ADMIN_EMAIL` to receive the admin role.

## Safety
This is an educational demo starter only. Prices are fixed illustrative values; trades use virtual funds. No deposits, withdrawals, payments or real exchange integration. Before public use, add CSRF protection, email verification, password reset, account lockout, audit logs, backups, monitoring, stricter security headers and an independent security review. Never put database credentials in GitHub or send them in chat.
