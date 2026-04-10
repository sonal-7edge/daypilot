import { z } from 'zod';

function toISOStart(date, hhmm) {
  const [h, m] = hhmm.split(':');
  return `${date}T${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}:00+05:30`;
}

export function registerFocusTools(server, apiClient) {
  // ── log_focus_time ────────────────────────────────────────────────────────
  server.tool(
    'log_focus_time',
    `Log a focus block: creates a Google Calendar event + Tempo worklog.

IMPORTANT — follow this exact flow before calling this tool:

1. CARD
   • Call get_active_cards and show the list.
   • If the user already gave a card key, use it directly.

2. DATE & TIME
   • If no date mentioned → use today's date.
   • If no start time → ask "What time are you starting?"
   • If no duration → ask "How long? (e.g. 1h, 30m, 1h 30m)"

3. DESCRIPTION — pick the right source based on what the user says:
   • "from the card" / "from worklogs" → call get_issue_details first, then write the description using that context.
   • "from our chat" / "summarize" → use the conversation context above.
   • user types their own text → clean it up and format it into 2–3 professional sentences.
   • nothing said → call get_issue_details and write it yourself.
   Write the description yourself. Do NOT ask the user to write it.

4. ACCOUNT
   • Call get_user_accounts and show the numbered list.
   • Wait for the user to pick one.

5. PREVIEW — before calling this tool, show the user this exact format and wait for confirmation:

   📋 Focus Block · {date}
   ─────────────────────────────────────
   Card:        {KEY} — {summary}
   Time:        {start time} · {duration}
   Account:     {account}

   Description:
   {description}
   ─────────────────────────────────────
   ⚠ Will replace any existing Tempo logs for {KEY} on {date}
   Confirm? (yes / no)

6. Only call this tool after the user says yes/confirm.`,
    {
      jiraKey: z.string().describe('Jira issue key, e.g. AUTH-123'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
      startTime: z.string().describe('Start time HH:MM (24-hour)'),
      durationHours: z.number().int().min(0).describe('Hours component of duration'),
      durationMinutes: z.number().int().min(0).max(59).describe('Minutes component'),
      account: z.string().describe('Tempo billing account key chosen by the user'),
      description: z.string().describe('2–3 sentence professional description of the work'),
    },
    async ({ jiraKey, date, startTime, durationHours, durationMinutes, account, description }) => {
      const isoStart = toISOStart(date, startTime);

      const res = await apiClient.post('/api/focus/log', {
        jiraKey,
        startTime: isoStart,
        durationHours,
        durationMinutes,
        account,
        description,
      });

      const { event, durationLabel } = res.data;
      return {
        content: [{
          type: 'text',
          text: [
            '✅ Focus block logged.',
            '',
            `Card:     ${jiraKey}`,
            `Date:     ${date}   Start: ${startTime}   Duration: ${durationLabel}`,
            `Account:  ${account}`,
            `Event ID: ${event.id}`,
            '',
            'Description added to calendar:',
            description,
          ].join('\n'),
        }],
      };
    }
  );

  // ── update_focus_event ────────────────────────────────────────────────────
  server.tool(
    'update_focus_event',
    `Update an existing focus block — patches the Google Calendar event and replaces the Tempo worklog.
     Show a preview in the same format as log_focus_time and wait for confirmation before calling this tool.`,
    {
      calEventId: z.string().describe('Google Calendar event ID'),
      jiraKey: z.string().describe('Jira issue key'),
      date: z.string().describe('Date YYYY-MM-DD'),
      startTime: z.string().describe('New start time HH:MM (24-hour)'),
      durationHours: z.number().int().min(0),
      durationMinutes: z.number().int().min(0).max(59),
      account: z.string().describe('Tempo billing account key'),
      description: z.string().describe('Updated description'),
    },
    async ({ calEventId, jiraKey, date, startTime, durationHours, durationMinutes, account, description }) => {
      const isoStart = toISOStart(date, startTime);

      const res = await apiClient.patch(`/api/focus/log/${calEventId}`, {
        jiraKey, startTime: isoStart, durationHours, durationMinutes, account, description,
      });

      const { event, durationLabel } = res.data;
      return {
        content: [{
          type: 'text',
          text: [
            '✅ Focus block updated.',
            '',
            `Card:     ${jiraKey}`,
            `Date:     ${date}   Start: ${startTime}   Duration: ${durationLabel}`,
            `Account:  ${account}`,
            `Event ID: ${event.id}`,
          ].join('\n'),
        }],
      };
    }
  );
}
