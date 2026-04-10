// Decode the x-daypilot-token header into req.creds.
// The token is a base64-encoded JSON object with per-user API credentials.
// Falls back to process.env if no token is present (single-user / local dev).
function credentialsMiddleware(req, res, next) {
  const token = req.headers['x-daypilot-token'];

  if (token) {
    try {
      req.creds = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid x-daypilot-token: could not decode' });
    }
  } else {
    // Local dev fallback — read from environment
    req.creds = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
      GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || 'primary',
      JIRA_EMAIL: process.env.JIRA_EMAIL,
      JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
      TEMPO_API_TOKEN: process.env.TEMPO_API_TOKEN,
      TEMPO_ACCOUNT_ID: process.env.TEMPO_ACCOUNT_ID,
      GMAIL_USER: process.env.GMAIL_USER,
      GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    };
  }

  next();
}

module.exports = { credentialsMiddleware };
