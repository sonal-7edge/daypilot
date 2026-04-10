import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { sessions } from '../sessions/sessionStore.js';
import { registerCardTools }     from '../tools/cards.js';
import { registerAccountTools }  from '../tools/accounts.js';
import { registerCalendarTools } from '../tools/calendar.js';
import { registerTempoTools }    from '../tools/tempo.js';
import { registerFocusTools }    from '../tools/focus.js';
import { registerMeetingTools }  from '../tools/meeting.js';
import { registerUnloggedTools } from '../tools/unlogged.js';

const BASE_URL = process.env.DAYPILOT_API_URL || 'http://localhost:3000';

function parseBody(req) {
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
  });
}

function makeApiClient(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: token ? { 'x-daypilot-token': token } : {},
  });
}

export async function mcpRoute(req, res) {
  const sessionId = req.headers['mcp-session-id'];

  // ── Existing session ──────────────────────────────────────────────────────
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId);
    const body = await parseBody(req);
    await transport.handleRequest(req, res, body);
    return;
  }

  // ── New session — must be POST ────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'New MCP session must be initiated with a POST request.' }));
    return;
  }

  const token = req.headers['x-daypilot-token'];
  const apiClient = makeApiClient(token);

  const mcpServer = new McpServer({ name: 'daypilot', version: '1.0.0' });

  // Register all tool groups — each gets the apiClient so they can call the
  // Daypilot API with the user's credentials embedded in the axios instance.
  registerCardTools(mcpServer, apiClient);
  registerAccountTools(mcpServer, apiClient);
  registerCalendarTools(mcpServer, apiClient);
  registerTempoTools(mcpServer, apiClient);
  registerFocusTools(mcpServer, apiClient);
  registerMeetingTools(mcpServer, apiClient);
  registerUnloggedTools(mcpServer, apiClient);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, { transport, token });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };

  await mcpServer.connect(transport);

  const body = await parseBody(req);
  await transport.handleRequest(req, res, body);
}
