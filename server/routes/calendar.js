const express = require('express');
const router = express.Router();
const cal = require('../services/googleCalendar');
const { getIssue, buildEventDescription } = require('../services/jira');
const tempo = require('../services/tempo');
// GET /api/calendar/events?date=2025-04-09
router.get('/events', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const timeMin = new Date(`${date}T00:00:00+05:30`).toISOString();
    const timeMax = new Date(`${date}T23:59:59+05:30`).toISOString();
    const events = await cal.listEvents(timeMin, timeMax);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar/rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await cal.listRooms();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar/available-rooms?start=...&end=...
router.get('/available-rooms', async (req, res) => {
  try {
    const { start, end } = req.query;
    const rooms = await cal.getAvailableRooms(start, end);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calendar/event
// Body: { title, start, end, attendees, roomResourceEmail, description, jiraKey, account }
router.post('/event', async (req, res) => {
  try {
    let { title, start, end, attendees, roomResourceEmail, description, jiraKey, account } = req.body;

    let issue = null;
    if (jiraKey) {
      issue = await getIssue(jiraKey);
      if (!title) title = `[${issue.key}] ${issue.fields.summary}`;
      description = buildEventDescription(issue) + (description ? `\n\n${description}` : '');
    }

    if (account) description = (description ? description + '\n' : '') + `Account: ${account}`;

    const event = await cal.createEvent({ title, description, start, end, attendees, roomResourceEmail });

    // Log to Tempo if jiraKey + account provided
    if (jiraKey && account && issue) {
      const startDate = start.substring(0, 10);
      const startTimePart = start.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] || '09:00:00';
      const timeSpentSeconds = Math.round((new Date(end) - new Date(start)) / 1000);

      const existing = await tempo.getWorklogs(startDate, startDate);
      const toDelete = existing.filter(log => log.issue?.key === jiraKey);
      await Promise.all(toDelete.map(log => tempo.deleteWorklog(log.tempoWorklogId)));

      await tempo.logTime({
        issueId: issue.id,
        timeSpentSeconds,
        startDate,
        startTime: startTimePart,
        description: `Meeting — ${title}`,
        account,
      });
    }

    res.json(event);
  } catch (err) {
    const detail = err.response?.data || err.message;
    res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

// POST /api/calendar/focus
// Body: { title, start, end }
router.post('/focus', async (req, res) => {
  try {
    const event = await cal.blockFocusTime(req.body);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/calendar/event/:eventId
router.patch('/event/:eventId', async (req, res) => {
  try {
    const event = await cal.updateEvent(req.params.eventId, req.body);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
