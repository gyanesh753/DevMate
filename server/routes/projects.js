const express = require('express');
const router = express.Router();
const pool = require('../db/index');

// GET all projects with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, experience_level, is_remote, search } = req.query

    let query = 'SELECT * FROM projects WHERE 1=1'
    const params = []
    let paramCount = 1

    if (type && type !== 'all') {
      query += ` AND type = $${paramCount}`
      params.push(type)
      paramCount++
    }

    if (experience_level && experience_level !== 'any') {
      query += ` AND experience_level = $${paramCount}`
      params.push(experience_level)
      paramCount++
    }

    if (is_remote !== undefined && is_remote !== '') {
      query += ` AND is_remote = $${paramCount}`
      params.push(is_remote === 'true')
      paramCount++
    }

    if (search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`
      params.push(`%${search}%`)
      paramCount++
    }

    query += ' ORDER BY created_at DESC'

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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