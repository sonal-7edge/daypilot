// Require x-daypilot-token on new session creation (POST /mcp without a session ID).
// Existing sessions carry their token in the session store — no re-auth needed.
export function authMiddleware(req, res) {
  const isNewSession = req.method === 'POST' && !req.headers['mcp-session-id'];

  if (isNewSession && !req.headers['x-daypilot-token']) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Missing x-daypilot-token header. Run the Daypilot setup wizard to get your token.',
    }));
    return false;
  }

  return true;
}
