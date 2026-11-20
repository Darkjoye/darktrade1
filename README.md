# DarkTrade demo trading platform

A small multi-user web app starter. Every account receives a separate 10,000 USDT virtual wallet. Users can register, sign in, view a simulated market, buy/sell demo assets, and view their holdings and trade history. An admin account can view registered users.

## Requirements
- Node.js 20 or newer
- npm

## Run locally
1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Set `SESSION_SECRET` to a long random value (at least 32 characters).
4. Set `ADMIN_EMAIL` to the email address you will use for your admin account.
5. Install and start:

   ```bash
   npm install
   npm start
   ```

6. Visit http://localhost:3000 and register using the admin email. That account receives the admin role.

## Important
- This is a starter/demo project, not a production-ready financial service.
- Prices are fixed illustrative values, not live market data.
- All trades are simulated; there are no deposits, withdrawals, payments, or real exchange connections.
- Use HTTPS in deployment. Set `NODE_ENV=production`, use a strong secret, and keep the database files private.
- Before a public launch, add CSRF protection, email verification, password reset, backups, monitoring, stricter security headers, and a proper production database/hosting setup. Have the app security-reviewed.
- Do not collect real financial deposits or present simulated prices as live prices.
