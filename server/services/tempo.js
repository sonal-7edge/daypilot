const axios = require('axios');

const tempoClient = axios.create({
  baseURL: 'https://api.tempo.io/4',
  headers: {
    Authorization: `Bearer ${process.env.TEMPO_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Get worklogs for a date range
async function getWorklogs(from, to) {
  const res = await tempoClient.get('/worklogs', {
    params: { from, to, limit: 200 },
  });
  return res.data.results;
}

// Log time on an issue
// issueId: numeric Jira issue ID (required by Tempo v4)
// account: Tempo account key e.g. "INT-AI-TP" (required work attribute)
async function logTime({ issueId, timeSpentSeconds, startDate, startTime = '09:00:00', description = '', account = '' }) {
  const res = await tempoClient.post('/worklogs', {
    issueId: parseInt(issueId),
    timeSpentSeconds,
    startDate,
    startTime,
    description,
    authorAccountId: process.env.TEMPO_ACCOUNT_ID,
    attributes: [{ key: '_Account_', value: account }],
  });
  return res.data;
}

// Delete a worklog
async function deleteWorklog(worklogId) {
  await tempoClient.delete(`/worklogs/${worklogId}`);
  return { deleted: worklogId };
}

// Update a worklog
async function updateWorklog(worklogId, updates) {
  const res = await tempoClient.put(`/worklogs/${worklogId}`, {
    ...updates,
    authorAccountId: process.env.TEMPO_ACCOUNT_ID,
  });
  return res.data;
}

// Get timesheets (periods) for approval
async function getTimesheetApproval(from, to) {
  const res = await tempoClient.get('/timesheet-approvals/user/' + process.env.TEMPO_ACCOUNT_ID, {
    params: { from, to },
  });
  return res.data;
}

// Submit timesheet for approval
async function submitTimesheet(from, to) {
  const res = await tempoClient.post('/timesheet-approvals/submit', {
    reviewerAccountId: null, // Tempo auto-routes to manager
    from,
    to,
  });
  return res.data;
}

// Get worklog summary grouped by issue
function summarizeWorklogs(worklogs) {
  const map = {};
  for (const log of worklogs) {
    const key = log.issue?.key || 'MISC';
    if (!map[key]) map[key] = { key, summary: log.issue?.summary || '', seconds: 0, logs: [] };
    map[key].seconds += log.timeSpentSeconds;
    map[key].logs.push(log);
  }
  return Object.values(map).map(item => ({
    ...item,
    hours: +(item.seconds / 3600).toFixed(2),
  }));
}

module.exports = { getWorklogs, logTime, deleteWorklog, updateWorklog, getTimesheetApproval, submitTimesheet, summarizeWorklogs };
