const express = require('express');
const router = express.Router();
const tempo = require('../services/tempo');
const { sendTimesheetSummary } = require('../services/mailer');

// GET /api/tempo/worklogs?from=2025-04-01&to=2025-04-09
router.get('/worklogs', async (req, res) => {
  try {
    const { from, to } = req.query;
    const logs = await tempo.getWorklogs(from, to);
    res.json({ logs, summary: tempo.summarizeWorklogs(logs) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/log
// Body: { issueKey, timeSpentSeconds, startDate, startTime, description }
router.post('/log', async (req, res) => {
  try {
    const log = await tempo.logTime(req.body);
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tempo/log/:worklogId
router.delete('/log/:worklogId', async (req, res) => {
  try {
    const result = await tempo.deleteWorklog(req.params.worklogId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tempo/log/:worklogId
router.put('/log/:worklogId', async (req, res) => {
  try {
    const result = await tempo.updateWorklog(req.params.worklogId, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/submit
// Body: { from, to, managerEmail }
router.post('/submit', async (req, res) => {
  try {
    const { from, to, managerEmail } = req.body;

    // Submit to Tempo
    const result = await tempo.submitTimesheet(from, to);

    // Get worklogs for the period to build email
    const logs = await tempo.getWorklogs(from, to);
    const summary = tempo.summarizeWorklogs(logs);

    // Send email summary
    if (managerEmail) {
      await sendTimesheetSummary({
        to: managerEmail,
        period: { from, to },
        summary,
      });
    }

    res.json({ submitted: true, result, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
