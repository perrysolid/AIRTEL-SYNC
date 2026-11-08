# Accel Business: staff portal

A separate front end for managers, field sales and channel partners. It holds no data of its own: every `/api/*` call is proxied to the backend (`web/` on Render), which owns leads, orders and staff accounts and sends the WhatsApp and Telegram updates.

| Who | Sees |
| --- | --- |
| Manager | Every lead, order and conversation; reassigns leads; team board; last quarter's funnel |
| Field sales | Own region's leads, call list, advisor chats to pick up, their orders |
| Channel partner | Leads and orders under their partner code |

Pages refresh on their own every few seconds. When staff send a message or mark installation work done on an order, the owner gets it on the tracker, WhatsApp and Telegram straight away.

## Run locally

```bash
cd web && npm run dev            # backend on :3000
cd staff && npm install
BACKEND_URL=http://localhost:3000 npm run dev   # portal on :3200
```

Demo accounts (synthetic data, password `Accel@2026` unless `STAFF_DEMO_PASSWORD` is set on the backend): `manager@accel.demo`, `priya@accel.demo`, `metro@partner.demo`.

## Deploy on Vercel

New project from this repo, **Root Directory `staff`**, framework Next.js, env `BACKEND_URL=https://airtel-sync.onrender.com`. Nothing else is needed: the sign-in cookie is set on the portal's own domain through the proxy.
