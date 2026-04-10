const express = require('express');
const router = express.Router();
const createJiraClient = require('../services/jira');

// GET /api/jira/active-issues
// ?statuses=In+Progress,QA  (optional — defaults by role)
router.get('/active-issues', async (req, res) => {
  try {
    const jira = createJiraClient(req.creds);
    const statuses = req.query.statuses
      ? req.query.statuses.split(',').map(s => s.trim())
      : null;
    const issues = await jira.getActiveIssues(statuses);
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/users
router.get('/users', async (req, res) => {
  try {
    const jira = createJiraClient(req.creds);
    const users = await jira.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/my-issues
router.get('/my-issues', async (req, res) => {
  try {
    const jira = createJiraClient(req.creds);
    const issues = await jira.getMyIssues();
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/issue/:key
router.get('/issue/:key', async (req, res) => {
  try {
    const jira = createJiraClient(req.creds);
    const issue = await jira.getIssue(req.params.key);
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/issue/:key/worklogs
router.get('/issue/:key/worklogs', async (req, res) => {
  try {
    const jira = createJiraClient(req.creds);
    const logs = await jira.getWorklogs(req.params.key);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
