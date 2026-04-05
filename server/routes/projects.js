const express = require('express');
const router = express.Router();
const pool = require('../db/index');

// GET all projects
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single project by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create a new project
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      skills_needed,
      owner_id,
      experience_level,
      industry,
      is_remote,
      location,
      max_members
    } = req.body;

    const result = await pool.query(
      `INSERT INTO projects 
        (title, description, type, skills_needed, owner_id, experience_level, industry, is_remote, location, max_members)
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, description, type, skills_needed, owner_id, experience_level, industry, is_remote, location, max_members]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;