// Run this once locally to get your Google refresh token
// node config/getGoogleToken.js

require('dotenv').config({ path: '../.env' });
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3333/callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
];

const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });

console.log('\nStarting local server on http://localhost:3333 ...');
console.log('\nOpen this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for Google to redirect back...\n');

const server = http.createServer(async (req, res) => {
  const qs = url.parse(req.url, true).query;
  if (!qs.code) {
    res.end('No code found. Try again.');
    return;
  }

  res.end('<h2>Success! You can close this tab and check your terminal.</h2>');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(qs.code);
    console.log('✅ Your GOOGLE_REFRESH_TOKEN:\n');
    console.log(tokens.refresh_token);
    console.log('\nAdd this to your .env file as GOOGLE_REFRESH_TOKEN=');
  } catch (err) {
    console.error('Failed to get token:', err.message);
  }
});

server.listen(3333);