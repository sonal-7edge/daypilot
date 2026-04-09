const express = require('express');
const router = express.Router();
const cal = require('../services/googleCalendar');
const { getIssue, buildEventDescription } = require('../services/jira');

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

// POST /api/calendar/event
// Body: { title, start, end, attendees, roomResourceEmail, description, jiraKey }
router.post('/event', async (req, res) => {
  try {
    let { title, start, end, attendees, roomResourceEmail, description, jiraKey } = req.body;

    // If a Jira key is given, enrich the description automatically
    if (jiraKey) {
      const issue = await getIssue(jiraKey);
      if (!title) title = `[${issue.key}] ${issue.fields.summary}`;
      description = buildEventDescription(issue) + (description ? `\n\n${description}` : '');
    }

    const event = await cal.createEvent({ title, description, start, end, attendees, roomResourceEmail });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
