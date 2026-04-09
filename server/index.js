require('dotenv').config();
const express = require('express');
const cors = require('cors');

const calendarRoutes = require('./routes/calendar');
const jiraRoutes = require('./routes/jira');
const tempoRoutes = require('./routes/tempo');
const plannerRoutes = require('./routes/planner');
const focusRoutes = require('./routes/focus');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'daypilot' }));

// Routes
app.use('/api/calendar', calendarRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/tempo', tempoRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/focus', focusRoutes);

app.listen(PORT, () => {
  console.log(`Daypilot server running on port ${PORT}`);
});
