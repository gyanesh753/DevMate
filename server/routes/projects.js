const express = require('express');
const router = express.Router();
const pool = require('../db/index');
const { requireAuth } = require('../middleware/auth');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET all projects with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, experience_level, is_remote, search, owner_id } = req.query

    const typeVal = type && type !== 'all' ? type : null
    const experienceVal =
      experience_level && experience_level !== 'any' ? experience_level : null
    const remoteVal =
      is_remote !== undefined && is_remote !== ''
        ? is_remote === 'true'
        : null
    const rawSearch = typeof search === 'string' ? search.trim() : ''
    const searchVal = rawSearch.length > 0 ? rawSearch : null
    const rawOwner =
      typeof owner_id === 'string' ? owner_id.trim() : ''
    const ownerVal = rawOwner.length > 0 && UUID_RE.test(rawOwner) ? rawOwner : null

    const result = await pool.query(
      `SELECT * FROM projects
       WHERE ($1::text IS NULL OR type = $1)
         AND ($2::text IS NULL OR experience_level = $2)
         AND ($3::boolean IS NULL OR is_remote = $3)
         AND (
           $4::text IS NULL
           OR title ILIKE ('%' || $4::text || '%')
           OR description ILIKE ('%' || $4::text || '%')
         )
         AND ($5::uuid IS NULL OR owner_id = $5)
       ORDER BY created_at DESC`,
      [typeVal, experienceVal, remoteVal, searchVal, ownerVal]
    )
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
      `SELECT p.*, u.name as owner_name, u.github_url, u.linkedin_url
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1`,
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
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      skills_needed,
      experience_level,
      industry,
      is_remote,
      location,
      max_members
    } = req.body;

    const owner_id = req.user.id;

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