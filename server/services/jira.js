const axios = require('axios');

function createJiraClient(creds) {
  const jiraClient = axios.create({
    baseURL: `${process.env.JIRA_BASE_URL}/rest/api/3`,
    auth: {
      username: creds.JIRA_EMAIL,
      password: creds.JIRA_API_TOKEN,
    },
    headers: { 'Content-Type': 'application/json' },
  });

  async function getMyIssues() {
    const jql = `assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC`;
    const res = await jiraClient.post('/search/jql', {
      jql,
      fields: ['summary', 'status', 'priority', 'timespent', 'timeoriginalestimate', 'worklog', 'parent', 'issuetype'],
      maxResults: 50,
    });
    return res.data.issues;
  }

  async function getActiveIssues(statuses = null) {
    const list = statuses && statuses.length
      ? statuses
      : ['In Progress', 'QA', 'In Review', 'Testing'];
    const statusFilter = list.map(s => `"${s}"`).join(', ');
    const jql = `assignee = currentUser() AND status in (${statusFilter}) ORDER BY updated DESC`;
    const res = await jiraClient.post('/search/jql', {
      jql,
      fields: ['summary', 'status', 'parent', 'issuetype'],
      maxResults: 50,
    });
    return res.data.issues;
  }

  async function getUsers() {
    const res = await jiraClient.get('/users/search', {
      params: { query: '', maxResults: 200 },
    });
    return res.data
      .filter(u => u.emailAddress && u.emailAddress.includes('@7edge.com') && u.active)
      .map(u => ({ displayName: u.displayName, email: u.emailAddress }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async function getIssue(issueKey) {
    const res = await jiraClient.get(`/issue/${issueKey}`, {
      params: {
        fields: 'summary,description,status,priority,timespent,timeoriginalestimate,worklog,assignee,issuetype,parent',
      },
    });
    return res.data;
  }

  async function getWorklogs(issueKey) {
    const res = await jiraClient.get(`/issue/${issueKey}/worklog`);
    return res.data.worklogs;
  }

  // Fetch accountId for the authenticated user (used during setup)
  async function getMyAccountId() {
    const res = await jiraClient.get('/myself');
    return res.data.accountId;
  }

  function buildEventDescription(issue) {
    const f = issue.fields;
    const spent = f.timespent ? `${Math.round(f.timespent / 3600)}h` : 'not logged';
    const estimate = f.timeoriginalestimate ? `${Math.round(f.timeoriginalestimate / 3600)}h` : 'none';
    return [
      `Jira: ${issue.key} — ${f.summary}`,
      `Status: ${f.status.name}`,
      `Time spent: ${spent} / Estimate: ${estimate}`,
      f.parent ? `Parent: ${f.parent.key} ${f.parent.fields.summary}` : '',
    ].filter(Boolean).join('\n');
  }

  return { getMyIssues, getActiveIssues, getUsers, getIssue, getWorklogs, getMyAccountId, buildEventDescription };
}

module.exports = createJiraClient;
