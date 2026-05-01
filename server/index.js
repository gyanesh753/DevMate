const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db/index');
const projectsRouter = require('./routes/projects');
const applicationsRouter = require('./routes/applications');
const usersRouter = require('./routes/users')

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: false }));
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/users', usersRouter);

app.get('/', (req, res) => {
  res.json({ message: 'DevMate API is running!' });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ message: 'Database connected!', status: 'healthy' });
  } catch (error) {
    res.status(500).json({ message: 'Database connection failed', error: error.message });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
