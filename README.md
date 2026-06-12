# 🚗 Traffic Highway — Real-time Visitor Dashboard

A real-time network traffic highway that visualizes your website visitors as vehicles.
Each vehicle type represents a different traffic source from Google Analytics 4.

## Vehicle → Traffic Source Map

| Vehicle      | Traffic Source     |
|--------------|--------------------|
| 🔵 City Bus   | Direct traffic     |
| 🔴 Sports Car | Google / Organic   |
| 🟠 Box Truck  | Social media       |
| 🟡 Motorcycle | Paid / CPC         |
| 🟢 Taxi       | Email campaigns    |
| 🩵 Sedan      | Mobile visitors    |
| 🟣 Panel Van  | Referral links     |
| ⚪ Police Car | 404 error pages   |
| ⬛ Hatchback  | Other / Unknown   |

---

## Setup Guide

### Step 1 — Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "traffic-highway")
3. Enable the **Google Analytics Data API**:
   - In the sidebar → APIs & Services → Library
   - Search "Google Analytics Data API" → Enable
4. Create a Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Name it anything (e.g. "highway-reader")
   - Role: leave as default → Done
5. Download the JSON key:
   - Click the service account → Keys tab → Add Key → JSON
   - Save the downloaded file

### Step 2 — Add Service Account to GA4

1. Open [analytics.google.com](https://analytics.google.com)
2. Admin → Property Access Management
3. Click + → Add Users
4. Paste the `client_email` from your JSON key file
5. Role: **Viewer** → Add

### Step 3 — Get your GA4 Property ID

1. GA4 → Admin → Property Settings
2. Copy the **Property ID** (e.g. `123456789`)

### Step 4 — Configure environment variables

Copy `.env.local` and fill in your values:

```bash
# Your GA4 Property ID (numbers only)
GA4_PROPERTY_ID=123456789

# Paste your entire service account JSON as one line
GA4_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Your site name
NEXT_PUBLIC_SITE_NAME=My Website
```

**How to get the JSON as one line:**
```bash
# Mac/Linux
cat your-key-file.json | tr -d '\n'

# Then paste the output as the value of GA4_SERVICE_ACCOUNT_KEY
```

### Step 5 — Run locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

> **Demo mode:** If you don't set GA4 credentials yet, the dashboard runs with realistic mock data automatically.

---

## Deploy to Vercel

### Option A — Vercel CLI (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add GA4_PROPERTY_ID
vercel env add GA4_SERVICE_ACCOUNT_KEY
vercel env add NEXT_PUBLIC_SITE_NAME

# Redeploy with env vars
vercel --prod
```

### Option B — Vercel Dashboard

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In project settings → Environment Variables, add:
   - `GA4_PROPERTY_ID` = your property ID
   - `GA4_SERVICE_ACCOUNT_KEY` = your JSON key (entire content, one line)
   - `NEXT_PUBLIC_SITE_NAME` = your site name
4. Deploy

---

## Optional: Password Protection

Set `DASHBOARD_PASSWORD` in your env vars. Then the dashboard will require a password header.

For a simple login page, add your own auth or use [Vercel Password Protection](https://vercel.com/docs/security/deployment-protection).

---

## Project Structure

```
traffic-highway/
├── app/
│   ├── layout.js          # Root layout + fonts
│   ├── page.js            # Highway dashboard (main UI)
│   └── api/
│       └── realtime/
│           └── route.js   # SSE endpoint → GA4 API
├── lib/
│   └── ga4.js             # GA4 Data API client + mock data
├── .env.local             # Your credentials (never commit this!)
├── next.config.js
├── package.json
└── README.md
```

---

## Notes

- GA4 Realtime API updates every ~5 seconds (Google's limit)
- The dashboard works in demo mode without any GA4 setup
- HTTPS traffic details (URLs, headers) are not available without server-side capture
- Free tier: Vercel hobby plan + GA4 free tier = ₹0/month
