const axios = require('axios');

const jiraClient = axios.create({
  baseURL: `${process.env.JIRA_BASE_URL}/rest/api/3`,
  auth: {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  },
  headers: { 'Content-Type': 'application/json' },
});

// Get issues assigned to me (in progress or done this sprint)
async function getMyIssues() {
  const jql = `assignee = currentUser() AND sprint in openSprints() ORDER BY updated DESC`;
  const res = await jiraClient.post('/search/jql', {
    jql,
    fields: ['summary', 'status', 'priority', 'timespent', 'timeoriginalestimate', 'worklog', 'parent', 'issuetype'],
    maxResults: 50,
  });
  return res.data.issues;
}

// Get active issues assigned to me — for focus block dropdown
async function getActiveIssues() {
  const jql = `assignee = currentUser() AND status in ("In Progress", "QA", "In Review", "Testing") ORDER BY updated DESC`;
  const res = await jiraClient.post('/search/jql', {
    jql,
    fields: ['summary', 'status', 'parent', 'issuetype'],
    maxResults: 50,
  });
  return res.data.issues;
}

// Get all 7edge users — for meeting attendee picker
async function getUsers() {
  const res = await jiraClient.get('/users/search', {
    params: { query: '', maxResults: 200 },
  });
  return res.data
    .filter(u => u.emailAddress && u.emailAddress.includes('@7edge.com') && u.active)
    .map(u => ({ displayName: u.displayName, email: u.emailAddress }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Get a single issue by key e.g. AUTH-123
async function getIssue(issueKey) {
  const res = await jiraClient.get(`/issue/${issueKey}`, {
    params: {
      fields: 'summary,description,status,priority,timespent,timeoriginalestimate,worklog,assignee,issuetype,parent',
    },
  });
  return res.data;
}

// Get worklogs for an issue
async function getWorklogs(issueKey) {
  const res = await jiraClient.get(`/issue/${issueKey}/worklog`);
  return res.data.worklogs;
}

// Build a clean calendar event description from a Jira issue
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

module.exports = { getMyIssues, getActiveIssues, getUsers, getIssue, getWorklogs, buildEventDescription };
