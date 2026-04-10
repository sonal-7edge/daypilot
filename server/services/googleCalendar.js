const { google } = require('googleapis');

// Per-user room cache keyed by refresh token
const roomCacheStore = new Map();

function createCalClient(creds) {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_CALENDAR_ID = 'primary',
  } = creds;

  function getAuthClient() {
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    return auth;
  }

  function getCalendar() {
    return google.calendar({ version: 'v3', auth: getAuthClient() });
  }

  async function listEvents(timeMin, timeMax) {
    const calendar = getCalendar();
    const res = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 86400000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items;
  }

  async function createEvent({ title, description, start, end, attendees = [], roomResourceEmail }) {
    const calendar = getCalendar();
    const organizerEmail = creds.JIRA_EMAIL;

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
      calendarId: GOOGLE_CALENDAR_ID,
      resource: event,
      sendUpdates: 'all',
    });
    return res.data;
  }

  async function updateEvent(eventId, updates) {
    const calendar = getCalendar();
    const res = await calendar.events.patch({
      calendarId: GOOGLE_CALENDAR_ID,
      eventId,
      resource: updates,
      sendUpdates: 'all',
    });
    return res.data;
  }

  async function discoverRooms() {
    const cacheKey = GOOGLE_REFRESH_TOKEN;
    const cached = roomCacheStore.get(cacheKey);
    if (cached && Date.now() - cached.time < 3600000) return cached.data;

    const calendar = getCalendar();
    const res = await calendar.calendarList.list({ maxResults: 250 });

    const rooms = (res.data.items || [])
      .filter(c => c.id.endsWith('@resource.calendar.google.com'))
      .map(c => ({ resourceName: c.summary, resourceEmail: c.id }))
      .sort((a, b) => a.resourceName.localeCompare(b.resourceName));

    roomCacheStore.set(cacheKey, { data: rooms, time: Date.now() });
    return rooms;
  }

  async function listRooms() {
    try {
      const admin = google.admin({ version: 'directory_v1', auth: getAuthClient() });
      const res = await admin.resources.calendars.list({ customer: 'my_customer' });
      return res.data.items || [];
    } catch {
      return discoverRooms();
    }
  }

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

  async function blockFocusTime({ title = 'Focus Time', start, end }) {
    return createEvent({
      title,
      description: 'Blocked for deep work - Daypilot',
      start,
      end,
    });
  }

  return { listEvents, createEvent, updateEvent, listRooms, getAvailableRooms, blockFocusTime };
}

module.exports = createCalClient;
