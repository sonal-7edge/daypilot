const { google } = require('googleapis');

function getAuthClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuthClient() });
}

// List events for today or a given date range
async function listEvents(timeMin, timeMax) {
  const calendar = getCalendar();
  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeMin: timeMin || new Date().toISOString(),
    timeMax: timeMax || new Date(Date.now() + 86400000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items;
}

// Create an event
async function createEvent({ title, description, start, end, attendees = [], roomResourceEmail }) {
  const calendar = getCalendar();
  const event = {
    summary: title,
    description,
    start: { dateTime: start, timeZone: 'Asia/Kolkata' },
    end: { dateTime: end, timeZone: 'Asia/Kolkata' },
    attendees: [
      ...attendees.map(email => ({ email })),
      ...(roomResourceEmail ? [{ email: roomResourceEmail, resource: true }] : []),
    ],
  };
  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    resource: event,
    sendUpdates: 'all',
  });
  return res.data;
}

// Update an event
async function updateEvent(eventId, updates) {
  const calendar = getCalendar();
  const res = await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    eventId,
    resource: updates,
    sendUpdates: 'all',
  });
  return res.data;
}

// List available calendar resources (meeting rooms)
async function listRooms() {
  const admin = google.admin({ version: 'directory_v1', auth: getAuthClient() });
  const res = await admin.resources.calendars.list({
    customer: 'my_customer',
  });
  return res.data.items || [];
}

// Block focus time
async function blockFocusTime({ title = 'Focus Time', start, end }) {
  return createEvent({
    title,
    description: 'Blocked for deep work - Daypilot',
    start,
    end,
  });
}

module.exports = { listEvents, createEvent, updateEvent, listRooms, blockFocusTime };
