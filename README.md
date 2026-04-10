# Daypilot

Personal productivity hub — Google Calendar planning, Jira card tracking, and Tempo time logging in one place. Includes a KDE Plasma desktop widget and a GNOME quick-add script for fast event and focus block creation.

## Use Cases

### Calendar Management

| Use Case | How |
|---|---|
| View all events for a day | `GET /api/calendar/events?date=YYYY-MM-DD` |
| Create a meeting (with optional Jira card, attendees, room) | `POST /api/calendar/event` |
| Update an existing event | `PATCH /api/calendar/event/:id` |
| Block focus/deep work time | `POST /api/calendar/focus` |
| List all meeting rooms | `GET /api/calendar/rooms` |
| Check which rooms are free for a time slot | `GET /api/calendar/available-rooms?start=...&end=...` |

- Creating an event with a Jira key auto-fills the title and appends issue status, time spent, and estimate to the description.
- Adding an account/billing code when creating a meeting also logs time to Tempo automatically.
- Room list is cached for 1 hour; falls back to calendar discovery if Admin API is unavailable.
- Attendee emails are deduplicated automatically.

---

### Jira Issue Tracking

| Use Case | How |
|---|---|
| View my assigned issues in the active sprint | `GET /api/jira/my-issues` |
| Get only active issues (In Progress / QA / In Review / Testing) | `GET /api/jira/active-issues` |
| Look up a single issue by key | `GET /api/jira/issue/:key` |
| View all worklogs on an issue | `GET /api/jira/issue/:key/worklogs` |
| List all team members (for attendee picker) | `GET /api/jira/users` |

- Sprint issues include: status, priority, time spent, estimate, subtasks, and a progress bar.
- Active issues endpoint is used by the desktop widget's issue dropdown.
- Team members are filtered to your org domain and sorted alphabetically.

---

### Tempo Time Tracking

| Use Case | How |
|---|---|
| Log time on a Jira issue | `POST /api/tempo/log` |
| View worklogs for a date range | `GET /api/tempo/worklogs?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Edit logged hours | `PUT /api/tempo/log/:id` |
| Delete a worklog | `DELETE /api/tempo/log/:id` |
| Submit timesheet + email summary to manager | `POST /api/tempo/submit` |

- All logs require a billable account/project code for compliance.
- Submit generates an HTML email with a per-issue hours breakdown and sends it via Gmail SMTP.
- Worklogs are summarized by issue: total hours, percentage, and issue summary.

---

### Focus Time Logging

| Use Case | How |
|---|---|
| Create a calendar focus block + log Tempo time in one step | `POST /api/focus/log` |

Provide: Jira issue key, duration (hours + minutes), account code.

- Creates a Google Calendar event with issue details in the description.
- Logs time to Tempo for the issue.
- Automatically removes any duplicate Tempo entries for that issue on that date to prevent double-billing.

---

### Day Planner

| Use Case | How |
|---|---|
| View unified day: events + sprint issues + free slots | `GET /api/planner/day?date=YYYY-MM-DD` |

- Events shown in timeline order with type-based color coding: Focus (teal), Meetings/Standup (blue), Other (purple).
- Free slots are auto-detected between events within 9am–6pm working hours (minimum 30-minute threshold).
- Sprint issues show status, logged / estimated hours, and a progress bar.
- Clicking a free slot auto-fills the meeting creation form with that time range.

---

### Web Application (React + Vite)

**Planner page (`/`)**
- Create meetings with optional Jira key, room selection, attendees, and description.
- Create focus blocks with a simplified form.
- Interactive free-slot cards — click to pre-fill meeting form.
- Events list with expandable descriptions.
- Issues widget with status badges and time progress bars.

**Tempo page (`/tempo`)**
- Date range picker with a "This week" quick button.
- Log time form: issue key, hours (0.25 step), date, description.
- Summary cards: total hours, issues worked, worklog count.
- Per-issue breakdown with relative bar chart.
- Inline worklog editing and deletion.
- Timesheet submission modal: enter manager email, submit worklogs and send email in one action.

---

### Desktop Widget & Quick-Add Scripts

**KDE Plasma widget** — right-click desktop → Add Widgets → Daypilot. Set your server URL in widget settings.

**GNOME/Wayland quick-add script** — two workflows triggered from a keyboard shortcut (`Super+F` by default):

**Focus block workflow:**
1. Pick mode: Focus Block or Meeting.
2. Select active issue from dropdown.
3. Set date, time, duration, and billing account.
4. Sends one request → creates calendar event + logs Tempo time.

**Meeting workflow:**
1. Set date, start, and end time.
2. Checks room availability for that slot.
3. Optionally add Jira key, room, billing account.
4. Multi-select attendees from your team.
5. Sends one request → creates calendar event (+ logs Tempo time if account provided).

**Available billing account codes:**
- `CLOUD_NATIVE_ENG_OPEX`
- `CUST_ORDO` (billable customer)
- `CUST_ORDO_Non_Billable`
- `INT-AI-TP`
- `INT-ORG-COMMUNITY-INITIATIVE`
- `INT-ORG-INNOVATION-TIME`
- `OPEX` (internal)

---

## Stack

- **Server**: Node.js + Express, hosted on Render
- **Frontend**: React + Vite
- **Desktop widget**: KDE Plasma (QML)
- **Quick-add script**: Bash + zenity (GNOME/Wayland)
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
GET   /api/calendar/events?date=YYYY-MM-DD
GET   /api/calendar/rooms
GET   /api/calendar/available-rooms?start=ISO&end=ISO
POST  /api/calendar/event   { title, start, end, jiraKey?, attendees?, roomResourceEmail?, account? }
POST  /api/calendar/focus   { title?, start, end }
PATCH /api/calendar/event/:id { ...fields }
```

### Jira

```
GET /api/jira/my-issues
GET /api/jira/active-issues
GET /api/jira/issue/:key
GET /api/jira/issue/:key/worklogs
GET /api/jira/users
```

### Tempo

```
GET    /api/tempo/worklogs?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /api/tempo/log     { issueKey, timeSpentSeconds, startDate, startTime?, description?, account }
PUT    /api/tempo/log/:id { timeSpentSeconds, startDate, description }
DELETE /api/tempo/log/:id
POST   /api/tempo/submit  { from, to, managerEmail }
```

### Focus

```
POST /api/focus/log { issueKey, hours, minutes, date, startTime, account }
```

Creates calendar event + logs Tempo time, deduplicating any prior entry for that issue/date.

### Planner

```
GET /api/planner/day?date=YYYY-MM-DD
```

Returns events, open Jira sprint issues, and free time slots for the day.

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
