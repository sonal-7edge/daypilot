import { z } from 'zod';

export function registerCalendarTools(server, apiClient) {
  // ── get_calendar_events ───────────────────────────────────────────────────
  server.tool(
    'get_calendar_events',
    'Fetch Google Calendar events for a given date. Useful for reviewing the day before logging time or checking the schedule.',
    {
      date: z.string().describe('Date in YYYY-MM-DD format (default: today)'),
    },
    async ({ date }) => {
      const res = await apiClient.get('/api/calendar/events', { params: { date } });
      const events = res.data;

      if (!events.length) {
        return { content: [{ type: 'text', text: `No calendar events found on ${date}.` }] };
      }

      const lines = events.map(e => {
        const start = e.start?.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'all-day';
        const end = e.end?.dateTime
          ? new Date(e.end.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
          : '';
        return `• ${start}${end ? ` – ${end}` : ''}  ${e.summary || '(no title)'}  [ID: ${e.id}]`;
      });

      return {
        content: [{
          type: 'text',
          text: `Calendar events on ${date}:\n\n${lines.join('\n')}`,
        }],
      };
    }
  );

  // ── get_available_rooms ───────────────────────────────────────────────────
  server.tool(
    'get_available_rooms',
    'Check which meeting rooms are free during a time slot. Call this when the user wants to book a room for a meeting.',
    {
      start: z.string().describe('Start time as ISO 8601, e.g. 2026-04-10T10:00:00+05:30'),
      end:   z.string().describe('End time as ISO 8601'),
    },
    async ({ start, end }) => {
      const res = await apiClient.get('/api/calendar/available-rooms', { params: { start, end } });
      const rooms = res.data;

      if (!rooms.length) {
        return { content: [{ type: 'text', text: 'No rooms are available for that time slot.' }] };
      }

      const lines = rooms.map((r, i) => `${i + 1}. ${r.resourceName}  [${r.resourceEmail}]`);
      return {
        content: [{
          type: 'text',
          text: `Available rooms:\n\n${lines.join('\n')}\n\nAsk the user to pick one by number.`,
        }],
      };
    }
  );

  // ── get_issue_details ─────────────────────────────────────────────────────
  server.tool(
    'get_issue_details',
    `Fetch a Jira issue's summary, status, description, and recent worklog entries.
     Use this to gather context for writing a meaningful focus block or meeting description.
     Call it when the user says "use the card details", "from worklogs", or similar.`,
    {
      jiraKey: z.string().describe('Jira issue key, e.g. AUTH-123'),
    },
    async ({ jiraKey }) => {
      const [issueRes, worklogRes] = await Promise.all([
        apiClient.get(`/api/jira/issue/${jiraKey}`),
        apiClient.get(`/api/jira/issue/${jiraKey}/worklogs`).catch(() => ({ data: [] })),
      ]);

      const issue = issueRes.data;
      const f = issue.fields;
      const worklogs = worklogRes.data || [];

      // Last 3 worklog comments as context
      const recentLogs = worklogs
        .slice(-3)
        .filter(w => w.comment)
        .map(w => `  - ${w.comment}`)
        .join('\n');

      const spent = f.timespent ? `${Math.round(f.timespent / 3600)}h logged` : 'no time logged yet';
      const estimate = f.timeoriginalestimate ? `${Math.round(f.timeoriginalestimate / 3600)}h estimated` : 'no estimate';

      return {
        content: [{
          type: 'text',
          text: [
            `${issue.key} — ${f.summary}`,
            `Status: ${f.status.name}  |  ${spent}  |  ${estimate}`,
            f.parent ? `Parent: ${f.parent.key} ${f.parent.fields?.summary || ''}` : '',
            f.description ? `\nJira description:\n${typeof f.description === 'string' ? f.description : JSON.stringify(f.description)}` : '',
            recentLogs ? `\nRecent worklog notes:\n${recentLogs}` : '',
          ].filter(Boolean).join('\n'),
        }],
      };
    }
  );

  // ── get_users ─────────────────────────────────────────────────────────────
  server.tool(
    'get_users',
    'Fetch all team members (for meeting attendee selection). Returns display name and email.',
    {},
    async () => {
      const res = await apiClient.get('/api/jira/users');
      const users = res.data;

      if (!users.length) {
        return { content: [{ type: 'text', text: 'No users found.' }] };
      }

      const lines = users.map((u, i) => `${i + 1}. ${u.displayName}  <${u.email}>`);
      return {
        content: [{
          type: 'text',
          text: `Team members:\n\n${lines.join('\n')}\n\nAsk the user to pick attendees by number or name.`,
        }],
      };
    }
  );
}
