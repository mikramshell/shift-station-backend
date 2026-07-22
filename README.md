# Shift Station — Backend

Express + Prisma + Postgres API for schedule management, time-off requests,
and SMS/email/push notifications.

## 1. Local setup

```bash
npm install
cp .env.example .env   # fill in the values (see below)
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

API runs at `http://localhost:4000`. Check `GET /health`.

## 2. Get each service key

**Database** — easiest is [Supabase](https://supabase.com) (free tier): create a
project, copy the connection string from Project Settings → Database into
`DATABASE_URL`.

**Twilio (texts)** — [console.twilio.com](https://console.twilio.com): sign up,
buy a phone number (~$1.15/mo), copy Account SID + Auth Token into `.env`.
Trial accounts can only text verified numbers — upgrade the account ($20 min
top-up) before sending to your real team.

**SendGrid (email)** — [app.sendgrid.com](https://app.sendgrid.com): free tier
covers 100 emails/day. Create an API key with "Mail Send" permission. Verify
a sender email/domain before it will deliver.

**Firebase (Android + web push)** — [console.firebase.google.com](https://console.firebase.google.com):
create a project → Project Settings → Service Accounts → Generate new private
key. Paste the whole JSON file contents as one line into
`FIREBASE_SERVICE_ACCOUNT_JSON`.

**Apple Push (iOS native app, later)** — needs an Apple Developer account
($99/yr): Certificates → Keys → create an APNs key, download the `.p8` file.

## 3. Deploy

Cheapest reliable path for a business this size:

1. Push this folder to a GitHub repo.
2. [Railway](https://railway.app) or [Render](https://render.com) → New →
   deploy from GitHub. Add a Postgres database (or keep using Supabase).
3. Paste all the `.env` values into the platform's environment variables UI.
4. Set the start command to `npm start` and run `npx prisma migrate deploy`
   once via the platform's shell/console.
5. Note the live URL (e.g. `https://shift-station-api.up.railway.app`) —
   the frontend points at this.

Expect roughly $10–25/month total (hosting + database), plus pay-as-you-go
Twilio texting (~$0.0079 each) and SendGrid free tier.

## 4. API summary

| Method | Route | Who | Purpose |
|---|---|---|---|
| POST | /auth/login | anyone | phone + password → JWT |
| POST | /auth/employees | manager | create an employee account |
| POST | /auth/change-password | signed in | update your own password |
| GET | /employees | signed in | roster + locations |
| PATCH | /employees/:id | manager | edit an employee |
| GET | /employees/locations | signed in | list stations |
| POST | /employees/push-token | signed in | register device for push |
| GET | /schedules?locationId&weekStart | signed in | week's shifts |
| PUT | /schedules | manager | save week + optionally notify |
| GET | /timeoff | signed in | your requests, or all (manager) |
| POST | /timeoff | signed in | submit a request |
| PATCH | /timeoff/:id | manager | approve / deny |
| GET | /notifications | signed in | your alert history |

All routes except `/auth/login` and `/health` require
`Authorization: Bearer <token>`.

## 5. Wiring the frontend to this API

In the React app, replace the `window.storage` calls with `fetch` calls to
these routes, and store the JWT from `/auth/login` in React state (memory
only — no localStorage in the Claude artifact, but a normal deployed app can
use a secure httpOnly cookie or the mobile app's secure storage). Example:

```js
const res = await fetch(`${API_URL}/schedules?locationId=${id}&weekStart=${week}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const rows = await res.json();
```
