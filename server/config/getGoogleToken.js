// Run this once locally to get your Google refresh token
// node config/getGoogleToken.js

require('dotenv').config({ path: '../.env' });
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
];

const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

console.log('\nOpen this URL in your browser:\n');
console.log(url);
console.log('\nPaste the code here:');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('> ', async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('\nYour GOOGLE_REFRESH_TOKEN:\n');
  console.log(tokens.refresh_token);
  console.log('\nAdd this to your .env file.');
  rl.close();
});
