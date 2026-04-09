const express = require('express');
const router = express.Router();
const cal = require('../services/googleCalendar');
const jira = require('../services/jira');
const dayjs = require('dayjs');

// GET /api/planner/day?date=2025-04-09
// Returns calendar events + jira issues side by side for the day view
router.get('/day', async (req, res) => {
  try {
    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    const timeMin = dayjs(`${date}T00:00:00`).toISOString();
    const timeMax = dayjs(`${date}T23:59:59`).toISOString();

    const [events, issues] = await Promise.all([
      cal.listEvents(timeMin, timeMax),
      jira.getMyIssues(),
    ]);

    // Calculate free slots (gaps between events)
    const freeSlots = findFreeSlots(events, date);

    res.json({ date, events, issues, freeSlots });
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
