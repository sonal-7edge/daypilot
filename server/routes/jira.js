const express = require('express');
const router = express.Router();
const jira = require('../services/jira');

// GET /api/jira/active-issues — In Progress + QA cards for focus block dropdown
router.get('/active-issues', async (req, res) => {
  try {
    const issues = await jira.getActiveIssues();
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/users — all 7edge users for meeting attendee picker
router.get('/users', async (req, res) => {
  try {
    const users = await jira.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/my-issues
router.get('/my-issues', async (req, res) => {
  try {
    const issues = await jira.getMyIssues();
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/issue/:key
router.get('/issue/:key', async (req, res) => {
  try {
    const issue = await jira.getIssue(req.params.key);
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/issue/:key/worklogs
router.get('/issue/:key/worklogs', async (req, res) => {
  try {
    const logs = await jira.getWorklogs(req.params.key);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
