const express = require('express');
const router = express.Router();
const createCalClient = require('../services/googleCalendar');
const createTempoClient = require('../services/tempo');
const createJiraClient = require('../services/jira');

// POST /api/focus/log
// Body: { jiraKey, startTime, durationHours, durationMinutes, account, description? }
router.post('/log', async (req, res) => {
  try {
    const cal = createCalClient(req.creds);
    const tempo = createTempoClient(req.creds);
    const jira = createJiraClient(req.creds);

    const { jiraKey, startTime, durationHours = 1, durationMinutes = 0, account, description } = req.body;

    const timeSpentSeconds = (parseInt(durationHours) * 3600) + (parseInt(durationMinutes) * 60);

    const parsedStart = new Date(startTime);
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ error: `Invalid startTime received: "${startTime}"` });
    }
    const endTime = new Date(parsedStart.getTime() + timeSpentSeconds * 1000).toISOString();

    const durationLabel = [
      parseInt(durationHours) > 0 ? `${durationHours}h` : '',
      parseInt(durationMinutes) > 0 ? `${durationMinutes}m` : '',
    ].filter(Boolean).join(' ');

    let issue = null;
    if (jiraKey) {
      issue = await jira.getIssue(jiraKey);
    }

    const calDescription = description || [
      issue ? `${issue.key} — ${issue.fields.summary}` : '',
      issue ? `Status: ${issue.fields.status.name}` : '',
      `Duration: ${durationLabel}`,
      account ? `Account: ${account}` : '',
    ].filter(Boolean).join('\n');

    const event = await cal.createEvent({
      title: `Focus Time${jiraKey ? ` (${jiraKey})` : ''}`,
      description: calDescription,
      start: startTime,
      end: endTime,
    });

    if (jiraKey) {
      const startDate = startTime.substring(0, 10);
      const startTimePart = startTime.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] || '09:00:00';

      const existing = await tempo.getWorklogs(startDate, startDate);
      const toDelete = existing.filter(log => log.issue?.key === jiraKey);
      await Promise.all(toDelete.map(log => tempo.deleteWorklog(log.tempoWorklogId)));

      await tempo.logTime({
        issueId: issue.id,
        timeSpentSeconds,
        startDate,
        startTime: startTimePart,
        description: `Focus session — ${durationLabel}`,
        account,
      });
    }

    res.json({ event, durationLabel, jiraKey, account });
  } catch (err) {
    const detail = err.response?.data || err.message;
    res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

// PATCH /api/focus/log/:calEventId
// Body: { jiraKey, startTime, durationHours, durationMinutes, account, description? }
router.patch('/log/:calEventId', async (req, res) => {
  try {
    const cal = createCalClient(req.creds);
    const tempo = createTempoClient(req.creds);
    const jira = createJiraClient(req.creds);

    const { calEventId } = req.params;
    const { jiraKey, startTime, durationHours = 1, durationMinutes = 0, account, description } = req.body;

    const timeSpentSeconds = (parseInt(durationHours) * 3600) + (parseInt(durationMinutes) * 60);

    const parsedStart = new Date(startTime);
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ error: `Invalid startTime received: "${startTime}"` });
    }
    const endTime = new Date(parsedStart.getTime() + timeSpentSeconds * 1000).toISOString();

    const durationLabel = [
      parseInt(durationHours) > 0 ? `${durationHours}h` : '',
      parseInt(durationMinutes) > 0 ? `${durationMinutes}m` : '',
    ].filter(Boolean).join(' ');

    let issue = null;
    if (jiraKey) {
      issue = await jira.getIssue(jiraKey);
    }

    const calDescription = description || [
      issue ? `${issue.key} — ${issue.fields.summary}` : '',
      issue ? `Status: ${issue.fields.status.name}` : '',
      `Duration: ${durationLabel}`,
      account ? `Account: ${account}` : '',
    ].filter(Boolean).join('\n');

    const event = await cal.updateEvent(calEventId, {
      summary: `Focus Time${jiraKey ? ` (${jiraKey})` : ''}`,
      description: calDescription,
      start: { dateTime: startTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endTime, timeZone: 'Asia/Kolkata' },
    });

    if (jiraKey) {
      const startDate = startTime.substring(0, 10);
      const startTimePart = startTime.match(/T(\d{2}:\d{2}:\d{2})/)?.[1] || '09:00:00';

      const existing = await tempo.getWorklogs(startDate, startDate);
      const toDelete = existing.filter(log => log.issue?.key === jiraKey);
      await Promise.all(toDelete.map(log => tempo.deleteWorklog(log.tempoWorklogId)));

      await tempo.logTime({
        issueId: issue.id,
        timeSpentSeconds,
        startDate,
        startTime: startTimePart,
        description: `Focus session — ${durationLabel}`,
        account,
      });
    }

    res.json({ event, durationLabel, jiraKey, account });
  } catch (err) {
    const detail = err.response?.data || err.message;
    res.status(500).json({ error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

module.exports = router;
