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
  const organizerEmail = process.env.JIRA_EMAIL;

  // Build deduplicated attendee list — organizer is always accepted
  const allEmails = new Set([organizerEmail, ...attendees].filter(Boolean));
  const attendeeList = Array.from(allEmails).map(email => ({
    email,
    responseStatus: email === organizerEmail ? 'accepted' : 'needsAction',
  }));

  const event = {
    summary: title,
    description,
    start: { dateTime: start, timeZone: 'Asia/Kolkata' },
    end: { dateTime: end, timeZone: 'Asia/Kolkata' },
    attendees: [
      ...attendeeList,
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

// Discover all rooms from the user's calendarList (includes all subscribed room resources)
let roomCache = null;
let roomCacheTime = 0;

async function discoverRooms() {
  const now = Date.now();
  if (roomCache && now - roomCacheTime < 3600000) return roomCache; // 1h cache

  const calendar = getCalendar();
  const res = await calendar.calendarList.list({ maxResults: 250 });

  roomCache = (res.data.items || [])
    .filter(c => c.id.endsWith('@resource.calendar.google.com'))
    .map(c => ({ resourceName: c.summary, resourceEmail: c.id }))
    .sort((a, b) => a.resourceName.localeCompare(b.resourceName));

  roomCacheTime = now;
  return roomCache;
}

// List available calendar resources (meeting rooms)
async function listRooms() {
  try {
    const admin = google.admin({ version: 'directory_v1', auth: getAuthClient() });
    const res = await admin.resources.calendars.list({ customer: 'my_customer' });
    return res.data.items || [];
  } catch {
    return discoverRooms();
  }
}

// Return only rooms that are free during the given time window
async function getAvailableRooms(start, end) {
  const calendar = getCalendar();
  const rooms = await discoverRooms();
  if (!rooms.length) return [];

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: start,
      timeMax: end,
      items: rooms.map(r => ({ id: r.resourceEmail })),
    },
  });
  const busyMap = res.data.calendars;
  return rooms.filter(room => {
    const cal = busyMap[room.resourceEmail];
    return !cal?.errors?.length && (!cal?.busy || cal.busy.length === 0);
  });
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

module.exports = { listEvents, createEvent, updateEvent, listRooms, getAvailableRooms, blockFocusTime };
