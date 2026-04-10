import { z } from 'zod';

export function registerTempoTools(server, apiClient) {
  // ── get_tempo_worklogs ────────────────────────────────────────────────────
  server.tool(
    'get_tempo_worklogs',
    'Fetch Tempo worklogs for a date range. Use this to check what is already logged before creating a new entry, or to show the user what will be replaced.',
    {
      from: z.string().describe('Start date YYYY-MM-DD'),
      to:   z.string().describe('End date YYYY-MM-DD (can equal from for a single day)'),
    },
    async ({ from, to }) => {
      const res = await apiClient.get('/api/tempo/worklogs', { params: { from, to } });
      const { logs, summary } = res.data;

      if (!logs.length) {
        return { content: [{ type: 'text', text: `No Tempo worklogs found from ${from} to ${to}.` }] };
      }

      const lines = logs.map(log => {
        const hrs = (log.timeSpentSeconds / 3600).toFixed(2);
        return `• ${log.startDate}  ${log.startTime || ''}  ${log.issue?.key || 'MISC'}  ${hrs}h  ${log.description || ''}  [ID: ${log.tempoWorklogId}]`;
      });

      const total = summary.reduce((acc, s) => acc + s.hours, 0).toFixed(2);

      return {
        content: [{
          type: 'text',
          text: `Tempo worklogs (${from} → ${to}):\n\n${lines.join('\n')}\n\nTotal: ${total}h`,
        }],
      };
    }
  );

  // ── delete_tempo_worklog ──────────────────────────────────────────────────
  server.tool(
    'delete_tempo_worklog',
    'Delete a specific Tempo worklog by ID. Use this when the user wants to remove an incorrect or duplicate log entry.',
    {
      worklogId: z.string().describe('Tempo worklog ID (visible in get_tempo_worklogs output)'),
    },
    async ({ worklogId }) => {
      await apiClient.delete(`/api/tempo/log/${worklogId}`);
      return {
        content: [{
          type: 'text',
          text: `Worklog ${worklogId} deleted.`,
        }],
      };
    }
  );
}
