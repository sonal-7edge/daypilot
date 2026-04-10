const express = require('express');
const router = express.Router();
const createTempoClient = require('../services/tempo');
const createMailer = require('../services/mailer');

// GET /api/tempo/worklogs?from=2025-04-01&to=2025-04-09
router.get('/worklogs', async (req, res) => {
  try {
    const tempo = createTempoClient(req.creds);
    const { from, to } = req.query;
    const logs = await tempo.getWorklogs(from, to);
    res.json({ logs, summary: tempo.summarizeWorklogs(logs) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/log
router.post('/log', async (req, res) => {
  try {
    const tempo = createTempoClient(req.creds);
    const log = await tempo.logTime(req.body);
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tempo/log/:worklogId
router.delete('/log/:worklogId', async (req, res) => {
  try {
    const tempo = createTempoClient(req.creds);
    const result = await tempo.deleteWorklog(req.params.worklogId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tempo/log/:worklogId
router.put('/log/:worklogId', async (req, res) => {
  try {
    const tempo = createTempoClient(req.creds);
    const result = await tempo.updateWorklog(req.params.worklogId, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tempo/accounts — list Tempo accounts available to this user
// Falls back to an empty array if the Tempo Accounts module is not enabled
router.get('/accounts', async (req, res) => {
  try {
    const tempo = createTempoClient(req.creds);
    const accounts = await tempo.getAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tempo/submit
// Body: { from, to, managerEmail }
router.post('/submit', async (req, res) => {
  try {
    const tempo = createTempoClient(req.creds);
    const mailer = createMailer(req.creds);
    const { from, to, managerEmail } = req.body;

    const result = await tempo.submitTimesheet(from, to);

    const logs = await tempo.getWorklogs(from, to);
    const summary = tempo.summarizeWorklogs(logs);

    if (managerEmail) {
      await mailer.sendTimesheetSummary({ to: managerEmail, period: { from, to }, summary });
    }

    res.json({ submitted: true, result, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
