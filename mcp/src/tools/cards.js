import { z } from 'zod';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, '../../role-memory.json');

// Role → Jira statuses mapping (server-side memory, shared across all sessions)
export const ROLE_STATUSES = {
  dev:      ['In Progress', 'QA'],
  designer: ['In Design'],
  set:      ['QA'],
};

function readMemory() {
  try { return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')); }
  catch { return {}; }
}

function writeMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

export function registerCardTools(server, apiClient) {
  // ── set_role ──────────────────────────────────────────────────────────────
  server.tool(
    'set_role',
    `Save the user's role so card filtering is personalised automatically.
     - dev      → In Progress + QA
     - designer → In Design
     - set      → QA`,
    { role: z.enum(['dev', 'designer', 'set']).describe("User's role") },
    async ({ role }) => {
      const mem = readMemory();
      mem.role = role;
      writeMemory(mem);
      return {
        content: [{
          type: 'text',
          text: `Role saved as "${role}". Cards will be filtered to: ${ROLE_STATUSES[role].join(', ')}.`,
        }],
      };
    }
  );

  // ── get_active_cards ──────────────────────────────────────────────────────
  server.tool(
    'get_active_cards',
    `Fetch Jira cards assigned to the user, filtered by their saved role.
     Call this first so the user can pick a card for the focus block.
     If no role is saved, returns cards in: In Progress, QA, In Review, Testing.`,
    {},
    async () => {
      const mem = readMemory();
      const role = mem.role;
      const statuses = role ? ROLE_STATUSES[role] : ['In Progress', 'QA', 'In Review', 'Testing'];

      const res = await apiClient.get('/api/jira/active-issues', {
        params: { statuses: statuses.join(',') },
      });

      const issues = res.data;
      if (!issues.length) {
        return {
          content: [{
            type: 'text',
            text: `No cards found with status: ${statuses.join(', ')}${role ? ` (role: ${role})` : ''}.`,
          }],
        };
      }

      const lines = issues.map(i =>
        `• ${i.key} — ${i.fields.summary} [${i.fields.status.name}]`
      );
      return {
        content: [{
          type: 'text',
          text: `${issues.length} card(s) found${role ? ` for role "${role}"` : ''}:\n\n${lines.join('\n')}`,
        }],
      };
    }
  );
}
