#!/usr/bin/env node
/**
 * Daypilot Setup Wizard
 * Guides you through collecting all credentials and generates your personal
 * base64-encoded token to use with the Daypilot MCP server.
 *
 * Run: node setup/index.js
 */

const readline = require('readline');
const http = require('http');
const { google } = require('googleapis');
const axios = require('axios');
const url = require('url');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, ans => resolve(ans.trim())));
}

function askSecret(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function handler(ch) {
      if (ch === '\n' || ch === '\r' || ch === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(input);
      } else if (ch === '\u007f') {
        if (input.length > 0) input = input.slice(0, -1);
      } else {
        input += ch;
        process.stdout.write('*');
      }
    });
  });
}

function separator(title) {
  console.log('\n' + '─'.repeat(60));
  if (title) console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

async function getGoogleRefreshToken(clientId, clientSecret) {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3333/callback'
  );

  const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n  Starting local OAuth callback server on http://localhost:3333 ...');
  console.log('\n  Open this URL in your browser:\n');
  console.log('  ' + authUrl);
  console.log('\n  Waiting for Google to redirect back...\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const qs = url.parse(req.url, true).query;
      if (!qs.code) {
        res.end('No code found. Try again.');
        return;
      }
      res.end('<h2 style="font-family:sans-serif">✅ Success! You can close this tab.</h2>');
      server.close();

      try {
        const { tokens } = await oauth2Client.getToken(qs.code);
        resolve(tokens.refresh_token);
      } catch (err) {
        reject(new Error('Failed to exchange code: ' + err.message));
      }
    });
    server.listen(3333);
  });
}

async function fetchTempoAccountId(jiraBaseUrl, jiraEmail, jiraToken) {
  try {
    const res = await axios.get(`${jiraBaseUrl}/rest/api/3/myself`, {
      auth: { username: jiraEmail, password: jiraToken },
    });
    return res.data.accountId;
  } catch (err) {
    console.log(`  ⚠  Could not auto-fetch account ID: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           Daypilot Setup Wizard                         ║');
  console.log('║  This wizard collects your credentials and generates    ║');
  console.log('║  a personal token for use with the MCP server.          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const creds = {};

  // ── Step 1: Google OAuth ──────────────────────────────────────────────────
  separator('Step 1 of 5 — Google OAuth (Calendar access)');
  console.log(`
  You need a Google Cloud project with the Calendar API enabled.

  How to get your Google OAuth credentials:
  1. Go to https://console.cloud.google.com
  2. Create a project (or select an existing one)
  3. Enable APIs: "Google Calendar API" and "Admin SDK API"
  4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
  5. Application type: Desktop app
  6. Download the JSON — copy Client ID and Client Secret from it
  7. Add http://localhost:3333/callback as an Authorised Redirect URI
`);

  creds.GOOGLE_CLIENT_ID = await ask('  Google Client ID: ');
  creds.GOOGLE_CLIENT_SECRET = await askSecret('  Google Client Secret: ');

  console.log('\n  Fetching your refresh token via browser OAuth flow...');
  try {
    creds.GOOGLE_REFRESH_TOKEN = await getGoogleRefreshToken(
      creds.GOOGLE_CLIENT_ID,
      creds.GOOGLE_CLIENT_SECRET
    );
    console.log('  ✅ Google refresh token obtained.');
  } catch (err) {
    console.log(`  ❌ OAuth failed: ${err.message}`);
    console.log('  Enter your refresh token manually (or leave blank to skip):');
    creds.GOOGLE_REFRESH_TOKEN = await ask('  Refresh token: ');
  }

  const defaultCalId = await ask('  Calendar ID (press Enter for "primary"): ');
  creds.GOOGLE_CALENDAR_ID = defaultCalId || 'primary';

  // ── Step 2: Atlassian Jira ────────────────────────────────────────────────
  separator('Step 2 of 5 — Atlassian Jira API token');
  console.log(`
  How to generate a Jira API token:
  1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
  2. Click "Create API token"
  3. Give it a name (e.g. "daypilot") and copy the token

  Your Jira base URL looks like: https://your-org.atlassian.net
  (This is stored on the server — you don't need to include it in your token)
`);

  creds.JIRA_EMAIL = await ask('  Atlassian account email: ');
  creds.JIRA_API_TOKEN = await askSecret('  Jira API token: ');

  // Derive base URL from email domain to auto-fetch account ID
  const jiraBaseUrl = await ask('  Jira base URL (e.g. https://your-org.atlassian.net): ');

  // ── Step 3: Tempo ─────────────────────────────────────────────────────────
  separator('Step 3 of 5 — Tempo Timesheets API token');
  console.log(`
  How to generate a Tempo API token:
  1. In Jira, go to Apps → Tempo Timesheets
  2. Click your avatar (top-right) → Settings → API Integration
  3. Click "New Token", name it "daypilot", copy it

  Your Tempo Account ID is your Atlassian account ID.
  We'll try to fetch it automatically from Jira using your credentials.
`);

  creds.TEMPO_API_TOKEN = await askSecret('  Tempo API token: ');

  console.log('  Fetching your Tempo Account ID from Jira...');
  const autoAccountId = await fetchTempoAccountId(jiraBaseUrl, creds.JIRA_EMAIL, creds.JIRA_API_TOKEN);
  if (autoAccountId) {
    console.log(`  ✅ Account ID found: ${autoAccountId}`);
    creds.TEMPO_ACCOUNT_ID = autoAccountId;
  } else {
    console.log(`
  To find your Account ID manually:
  1. Open your browser dev tools → Network tab
  2. In Jira, visit https://<your-org>.atlassian.net/rest/api/3/myself
  3. Copy the "accountId" field from the JSON response
`);
    creds.TEMPO_ACCOUNT_ID = await ask('  Tempo Account ID: ');
  }

  // ── Step 4: Gmail ─────────────────────────────────────────────────────────
  separator('Step 4 of 5 — Gmail (for timesheet email summaries)');
  console.log(`
  Daypilot sends timesheet summaries via Gmail SMTP using an App Password.

  How to create a Gmail App Password:
  1. Go to your Google Account → Security
  2. Under "How you sign in to Google", click "2-Step Verification" (must be enabled)
  3. Scroll to the bottom → "App passwords"
  4. Select app: Mail, Select device: Other → name it "daypilot"
  5. Copy the 16-character password shown
`);

  creds.GMAIL_USER = await ask('  Gmail address (e.g. you@gmail.com): ');
  creds.GMAIL_APP_PASSWORD = await askSecret('  Gmail App Password (16 chars): ');

  // ── Step 5: Generate token ────────────────────────────────────────────────
  separator('Step 5 of 5 — Generating your Daypilot token');

  const token = Buffer.from(JSON.stringify(creds)).toString('base64');

  console.log(`
  ✅ Setup complete! Your personal Daypilot token:

  ┌─────────────────────────────────────────────────────────────┐
`);
  // Print token in chunks for readability
  const chunks = token.match(/.{1,64}/g) || [];
  chunks.forEach(chunk => console.log('  │  ' + chunk));
  console.log(`  └─────────────────────────────────────────────────────────────┘

  How to use this token:
  ──────────────────────

  1. Add it to your Claude Desktop MCP config
     (~/.claude/claude_desktop_config.json or claude_desktop_config.json):

     {
       "mcpServers": {
         "daypilot": {
           "command": "node",
           "args": ["/path/to/daypilot/mcp/server.js"],
           "env": {}
         }
       }
     }

     Then send the token as x-daypilot-token header when connecting to the
     HTTP MCP server (see mcp/README for deployment instructions).

  2. When connecting to the hosted MCP server, include this header:
       x-daypilot-token: ${token.substring(0, 20)}...

  ⚠  Keep this token private — it contains your API credentials.
     Regenerate it here if any credentials change.
`);

  rl.close();
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  rl.close();
  process.exit(1);
});
