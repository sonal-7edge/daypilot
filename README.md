# Daypilot

Personal productivity hub — Google Calendar planning, Jira card tracking, and Tempo time logging in one place. Includes a KDE Plasma desktop widget for quick event creation.

## What it does

| Feature | How |
|---|---|
| View today's schedule + free slots | `/api/planner/day` |
| Add meeting (with optional Jira card) | Widget or `/api/calendar/event` |
| Block focus time | Widget or `/api/calendar/focus` |
| List/book meeting rooms | `/api/calendar/rooms` |
| View my Jira issues this sprint | `/api/jira/my-issues` |
| Lookup a Jira card | `/api/jira/issue/:key` |
| Log time in Tempo | `/api/tempo/log` |
| View/edit worklogs | `/api/tempo/worklogs` |
| Submit timesheet + email summary | `/api/tempo/submit` |

---

## Stack

- **Server**: Node.js + Express, hosted on Render
- **Desktop widget**: KDE Plasma (QML)
- **APIs**: Google Calendar, Atlassian Jira, Tempo Timesheets, Gmail SMTP

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/daypilot.git
cd daypilot
```

### 2. Google Cloud Console setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project → **Daypilot**
3. Enable these APIs:
   - Google Calendar API
   - Admin SDK API (for meeting rooms)
4. Go to **Credentials** → Create OAuth 2.0 Client ID → Desktop app
5. Download the credentials JSON
6. Get your refresh token:

```bash
cd server
npm install
node config/getGoogleToken.js
```

Follow the URL printed, authorize, and paste the code back. Your `GOOGLE_REFRESH_TOKEN` will print to the terminal.

### 3. Jira API token

1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token** → name it `daypilot`
3. Copy the token → paste into `.env` as `JIRA_API_TOKEN`
4. Set `JIRA_EMAIL` to your Atlassian account email
5. Set `JIRA_BASE_URL` to `https://your-org.atlassian.net`

### 4. Tempo API token

1. In Jira, go to **Apps** → **Tempo Timesheets**
2. Click your avatar → **Settings** → **API Integration**
3. Generate a token → paste as `TEMPO_API_TOKEN`
4. Find your account ID: `GET /rest/api/3/myself` → copy `accountId` → paste as `TEMPO_ACCOUNT_ID`

### 5. Gmail app password

1. Go to your Google Account → Security → 2-Step Verification → App passwords
2. Create one for "Mail" → copy it
3. Paste as `GMAIL_APP_PASSWORD` in `.env`
4. Set `GMAIL_USER` to your Gmail address

### 6. Copy and fill in env

```bash
cp .env.example .env
# Fill in all values
```

### 7. Run locally

```bash
cd server
npm install
npm run dev
```

Server runs at `http://localhost:3000`

---

## Deploy to Render

1. Sign up at [render.com](https://render.com)
2. New → Web Service → connect your GitHub repo
3. Render auto-detects `render.yaml` — click **Apply**
4. Go to **Environment** → add all your `.env` values
5. Get your deploy hook URL from Render → add as `RENDER_DEPLOY_HOOK_URL` in GitHub repo secrets
6. Every push to `main` auto-deploys

---

## Install the KDE Plasma Widget

On your Ubuntu machine:

```bash
cd desktop
bash install-widget.sh
```

Then right-click desktop → **Add Widgets** → search **Daypilot**.

Open the widget settings and set your Render server URL.

---

## API Reference

### Calendar

```
GET  /api/calendar/events?date=YYYY-MM-DD
GET  /api/calendar/rooms
POST /api/calendar/event      { title, start, end, jiraKey?, attendees?, roomResourceEmail? }
POST /api/calendar/focus      { title?, start, end }
PATCH /api/calendar/event/:id { ...fields }
```

### Jira

```
GET /api/jira/my-issues
GET /api/jira/issue/:key
GET /api/jira/issue/:key/worklogs
```

### Tempo

```
GET    /api/tempo/worklogs?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /api/tempo/log        { issueKey, timeSpentSeconds, startDate, startTime?, description? }
PUT    /api/tempo/log/:id    { timeSpentSeconds, startDate, description }
DELETE /api/tempo/log/:id
POST   /api/tempo/submit     { from, to, managerEmail }
```

### Planner

```
GET /api/planner/day?date=YYYY-MM-DD
```

Returns events, open Jira issues, and free time slots for the day.

---

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Long-lived refresh token |
| `GOOGLE_CALENDAR_ID` | Calendar ID (default: `primary`) |
| `JIRA_BASE_URL` | e.g. `https://your-org.atlassian.net` |
| `JIRA_EMAIL` | Your Atlassian account email |
| `JIRA_API_TOKEN` | Jira API token |
| `TEMPO_API_TOKEN` | Tempo API token |
| `TEMPO_ACCOUNT_ID` | Your Jira/Tempo account ID |
| `GMAIL_USER` | Gmail address for sending summaries |
| `GMAIL_APP_PASSWORD` | Gmail app password |
