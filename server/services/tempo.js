const axios = require('axios');

function createTempoClient(creds) {
  const tempoClient = axios.create({
    baseURL: 'https://api.tempo.io/4',
    headers: {
      Authorization: `Bearer ${creds.TEMPO_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  async function getWorklogs(from, to) {
    const res = await tempoClient.get('/worklogs', {
      params: { from, to, limit: 200 },
    });
    return res.data.results;
  }

  async function logTime({ issueId, timeSpentSeconds, startDate, startTime = '09:00:00', description = '', account = '' }) {
    const res = await tempoClient.post('/worklogs', {
      issueId: parseInt(issueId),
      timeSpentSeconds,
      startDate,
      startTime,
      description,
      authorAccountId: creds.TEMPO_ACCOUNT_ID,
      attributes: [{ key: '_Account_', value: account }],
    });
    return res.data;
  }

  async function deleteWorklog(worklogId) {
    await tempoClient.delete(`/worklogs/${worklogId}`);
    return { deleted: worklogId };
  }

  async function updateWorklog(worklogId, updates) {
    const res = await tempoClient.put(`/worklogs/${worklogId}`, {
      ...updates,
      authorAccountId: creds.TEMPO_ACCOUNT_ID,
    });
    return res.data;
  }

  async function getTimesheetApproval(from, to) {
    const res = await tempoClient.get('/timesheet-approvals/user/' + creds.TEMPO_ACCOUNT_ID, {
      params: { from, to },
    });
    return res.data;
  }

  // Fetch available Tempo accounts for this user (requires Tempo Accounts module)
  // Falls back gracefully — callers should handle an empty array
  async function getAccounts() {
    try {
      const res = await tempoClient.get('/accounts', { params: { limit: 200 } });
      return (res.data.results || []).map(a => ({
        key: a.key,
        name: a.name,
        status: a.status,
      }));
    } catch {
      return [];
    }
  }

  async function submitTimesheet(from, to) {
    const res = await tempoClient.post('/timesheet-approvals/submit', {
      reviewerAccountId: null,
      from,
      to,
    });
    return res.data;
  }

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

  return { getWorklogs, logTime, deleteWorklog, updateWorklog, getAccounts, getTimesheetApproval, submitTimesheet, summarizeWorklogs };
}

module.exports = createTempoClient;
