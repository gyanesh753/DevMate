const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db/index');
const projectsRouter = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
