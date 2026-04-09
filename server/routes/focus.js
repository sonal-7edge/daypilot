const express = require('express');
const router = express.Router();
const cal = require('../services/googleCalendar');
const tempo = require('../services/tempo');
const { getIssue } = require('../services/jira');

// POST /api/focus/log
// Body: { jiraKey, startTime, durationHours, durationMinutes, account }
// - Creates a Google Calendar focus block
// - Removes any existing Tempo worklogs for the same issue on that date
// - Logs one clean Tempo worklog for the duration
router.post('/log', async (req, res) => {
  try {
    const { jiraKey, startTime, durationHours = 1, durationMinutes = 0, account } = req.body;

    const timeSpentSeconds = (parseInt(durationHours) * 3600) + (parseInt(durationMinutes) * 60);
    const endTime = new Date(new Date(startTime).getTime() + timeSpentSeconds * 1000).toISOString();

    const durationLabel = [
      parseInt(durationHours) > 0 ? `${durationHours}h` : '',
      parseInt(durationMinutes) > 0 ? `${durationMinutes}m` : '',
    ].filter(Boolean).join(' ');

    // Fetch Jira issue details
    let issue = null;
    if (jiraKey) {
      issue = await getIssue(jiraKey);
    }

    // Build calendar description
    const calDescription = [
      issue ? `${issue.key} — ${issue.fields.summary}` : '',
      issue ? `Status: ${issue.fields.status.name}` : '',
      `Duration: ${durationLabel}`,
      account ? `Account: ${account}` : '',
    ].filter(Boolean).join('\n');

    // Create calendar event
    const event = await cal.createEvent({
      title: `Focus Time${jiraKey ? ` (${jiraKey})` : ''}`,
      description: calDescription,
      start: startTime,
      end: endTime,
    });

    // Tempo: remove existing worklogs for this issue on this date, then log fresh
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
