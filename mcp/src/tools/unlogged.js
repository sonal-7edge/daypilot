import { z } from 'zod';

export function registerUnloggedTools(server, apiClient) {
  server.tool(
    'get_unlogged_events',
    `Find calendar events that have no matching Tempo worklog.
     Use this when the user asks "what haven't I logged?", "show unlogged time", or similar.
     After showing the list, offer to log each event: ask the user for each one whether to
     log it (→ go through the focus/meeting flow), skip it, or delete an existing wrong log.`,
    {
      date: z.string().describe('Date in YYYY-MM-DD format (default: today)'),
    },
    async ({ date }) => {
      const res = await apiClient.get('/api/planner/unlogged', { params: { date } });
      const { unlogged } = res.data;

      if (!unlogged.length) {
        return {
          content: [{
            type: 'text',
            text: `All calendar events on ${date} have a matching Tempo worklog. Nothing to log.`,
          }],
        };
      }

      const lines = unlogged.map((e, i) => {
        const start = new Date(e.start).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });
        const end = new Date(e.end).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });
        return [
          `${i + 1}. ${e.title || '(no title)'}`,
          `   Time: ${start} – ${end}  (${e.durationLabel})`,
          e.jiraKey ? `   Card: ${e.jiraKey}` : '   Card: none detected',
          `   Event ID: ${e.calEventId}`,
        ].join('\n');
      });

      return {
        content: [{
          type: 'text',
          text: [
            `${unlogged.length} unlogged event(s) on ${date}:\n`,
            lines.join('\n\n'),
            '\nFor each event, ask: Log it / Skip / Delete a wrong log',
          ].join('\n'),
        }],
      };
    }
  );
}
