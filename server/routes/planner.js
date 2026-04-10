const express = require('express');
const router = express.Router();
const createCalClient = require('../services/googleCalendar');
const createJiraClient = require('../services/jira');
const createTempoClient = require('../services/tempo');
const dayjs = require('dayjs');

// GET /api/planner/day?date=2025-04-09
router.get('/day', async (req, res) => {
  try {
    const cal = createCalClient(req.creds);
    const jira = createJiraClient(req.creds);

    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    const timeMin = dayjs(`${date}T00:00:00`).toISOString();
    const timeMax = dayjs(`${date}T23:59:59`).toISOString();

    const [events, issues] = await Promise.all([
      cal.listEvents(timeMin, timeMax),
      jira.getMyIssues(),
    ]);

    const freeSlots = findFreeSlots(events, date);
    res.json({ date, events, issues, freeSlots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/planner/unlogged?date=YYYY-MM-DD
// Returns calendar events that have no matching Tempo worklog on that day.
// Matching: by Jira key in the event title/description, OR by worklog start time
// falling inside the event window (±IST timezone).
router.get('/unlogged', async (req, res) => {
  try {
    const cal = createCalClient(req.creds);
    const tempo = createTempoClient(req.creds);

    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    const timeMin = dayjs(`${date}T00:00:00`).toISOString();
    const timeMax = dayjs(`${date}T23:59:59`).toISOString();

    const [events, { logs }] = await Promise.all([
      cal.listEvents(timeMin, timeMax),
      (async () => {
        const raw = await tempo.getWorklogs(date, date);
        return { logs: raw };
      })(),
    ]);

    const JIRA_KEY_RE = /([A-Z][A-Z0-9]+-\d+)/;

    const unlogged = events
      .filter(e => e.start?.dateTime) // skip all-day events
      .filter(e => {
        const text = `${e.summary || ''} ${e.description || ''}`;
        const keyMatch = text.match(JIRA_KEY_RE);
        const jiraKey = keyMatch ? keyMatch[1] : null;

        const evStart = new Date(e.start.dateTime).getTime();
        const evEnd   = new Date(e.end.dateTime).getTime();

        return !logs.some(log => {
          // Match by Jira key
          if (jiraKey && log.issue?.key === jiraKey) return true;
          // Match by worklog start time falling inside event window
          const logTs = new Date(`${log.startDate}T${log.startTime || '00:00:00'}+05:30`).getTime();
          return logTs >= evStart && logTs < evEnd;
        });
      })
      .map(e => {
        const text = `${e.summary || ''} ${e.description || ''}`;
        const keyMatch = text.match(JIRA_KEY_RE);
        const start = new Date(e.start.dateTime);
        const end   = new Date(e.end.dateTime);
        const durationMinutes = Math.round((end - start) / 60000);
        return {
          calEventId: e.id,
          title: e.summary,
          jiraKey: keyMatch ? keyMatch[1] : null,
          start: e.start.dateTime,
          end:   e.end.dateTime,
          durationMinutes,
          durationLabel: durationMinutes >= 60
            ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ''}`
            : `${durationMinutes}m`,
        };
      });

    res.json({ date, unlogged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function findFreeSlots(events, date) {
  const workStart = dayjs(`${date}T09:00:00`);
  const workEnd = dayjs(`${date}T18:00:00`);
  const slots = [];

  const sorted = [...events]
    .filter(e => e.start?.dateTime)
    .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

  let cursor = workStart;
  for (const ev of sorted) {
    const evStart = dayjs(ev.start.dateTime);
    const evEnd = dayjs(ev.end.dateTime);
    if (evStart.diff(cursor, 'minute') >= 30) {
      slots.push({ start: cursor.toISOString(), end: evStart.toISOString(), durationMinutes: evStart.diff(cursor, 'minute') });
    }
    if (evEnd.isAfter(cursor)) cursor = evEnd;
  }
  if (workEnd.diff(cursor, 'minute') >= 30) {
    slots.push({ start: cursor.toISOString(), end: workEnd.toISOString(), durationMinutes: workEnd.diff(cursor, 'minute') });
  }
  return slots;
}

module.exports = router;
