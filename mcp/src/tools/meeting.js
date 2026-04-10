import { z } from 'zod';

function toISOStart(date, hhmm) {
  const [h, m] = hhmm.split(':');
  return `${date}T${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}:00+05:30`;
}

export function registerMeetingTools(server, apiClient) {
  server.tool(
    'log_meeting',
    `Log a meeting: creates a Google Calendar event with attendees/room and auto-logs time in Tempo.

IMPORTANT — follow this exact flow before calling this tool:

1. TITLE & CARD
   • Ask for a meeting title.
   • Ask if there's a Jira card to link (optional). If yes, call get_issue_details to get context.

2. DATE & TIME
   • If no date → use today.
   • Ask for start time and end time (meetings need both).

3. ATTENDEES
   • Ask "Who should be invited?"
   • Call get_users to show the team list, or accept typed emails.
   • Collect a list of email addresses.

4. ROOM (optional)
   • Ask "Do you need a meeting room?"
   • If yes → call get_available_rooms with the meeting's start/end times.
   • Show available rooms and let the user pick one.

5. DESCRIPTION — same rules as focus time:
   • "from card/worklogs" → call get_issue_details first.
   • "from chat" → summarize conversation context.
   • manual text → clean it up into 2–3 professional sentences.
   • nothing → write it yourself using meeting title + card context.

6. ACCOUNT
   • Call get_user_accounts and show the list.
   • Wait for user to pick one.

7. PREVIEW — show before calling this tool:

   📋 Meeting · {date}
   ─────────────────────────────────────
   Title:       {title}
   Card:        {KEY} — {summary}  (or "none")
   Time:        {start time} – {end time}
   Attendees:   {name1}, {name2}, ...
   Room:        {room name}  (or "none")
   Account:     {account}

   Description:
   {description}
   ─────────────────────────────────────
   Confirm? (yes / no)

8. Only call this tool after the user confirms.`,
    {
      title: z.string().describe('Meeting title'),
      date: z.string().describe('Date YYYY-MM-DD'),
      startTime: z.string().describe('Start time HH:MM (24-hour)'),
      endTime: z.string().describe('End time HH:MM (24-hour)'),
      attendees: z.array(z.string()).describe('List of attendee email addresses'),
      roomResourceEmail: z.string().optional().describe('Room resource email (from get_available_rooms)'),
      jiraKey: z.string().optional().describe('Linked Jira issue key (optional)'),
      account: z.string().describe('Tempo billing account key'),
      description: z.string().describe('2–3 sentence professional meeting description'),
    },
    async ({ title, date, startTime, endTime, attendees, roomResourceEmail, jiraKey, account, description }) => {
      const isoStart = toISOStart(date, startTime);
      const isoEnd   = toISOStart(date, endTime);

      const res = await apiClient.post('/api/calendar/event', {
        title,
        start: isoStart,
        end: isoEnd,
        attendees,
        roomResourceEmail,
        jiraKey,
        account,
        description,
      });

      const event = res.data;
      const durationMins = Math.round((new Date(isoEnd) - new Date(isoStart)) / 60000);
      const durationLabel = durationMins >= 60
        ? `${Math.floor(durationMins / 60)}h${durationMins % 60 ? ` ${durationMins % 60}m` : ''}`
        : `${durationMins}m`;

      return {
        content: [{
          type: 'text',
          text: [
            '✅ Meeting logged.',
            '',
            `Title:     ${title}`,
            jiraKey ? `Card:      ${jiraKey}` : '',
            `Date:      ${date}   ${startTime} – ${endTime}  (${durationLabel})`,
            `Attendees: ${attendees.join(', ')}`,
            roomResourceEmail ? `Room:      ${roomResourceEmail}` : '',
            `Account:   ${account}`,
            `Event ID:  ${event.id}`,
            '',
            'Description added to calendar:',
            description,
          ].filter(l => l !== '').join('\n'),
        }],
      };
    }
  );
}
