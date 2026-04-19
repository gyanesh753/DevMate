const express = require('express')
const rateLimit = require('express-rate-limit')
const router = express.Router()
const pool = require('../db/index')

const applyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

const listApplicationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

// POST apply to a project
router.post('/', applyLimiter, async (req, res) => {
  try {
    const { project_id, applicant_id, message } = req.body

    const result = await pool.query(
      `INSERT INTO applications (project_id, applicant_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [project_id, applicant_id, message]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET applications for a project
router.get('/project/:project_id', listApplicationsLimiter, async (req, res) => {
  try {
    const { project_id } = req.params
    const result = await pool.query(
      'SELECT * FROM applications WHERE project_id = $1 ORDER BY created_at DESC',
      [project_id]
    )
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
