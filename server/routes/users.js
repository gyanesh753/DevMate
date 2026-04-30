const express = require('express')
const router = express.Router()
const pool = require('../db/index')

// GET user profile by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT update user profile
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, bio, location, github_url, linkedin_url, skills } = req.body

    const result = await pool.query(
      `UPDATE users SET
        name = $1,
        bio = $2,
        location = $3,
        github_url = $4,
        linkedin_url = $5,
        skills = $6
       WHERE id = $7
       RETURNING *`,
      [name, bio, location, github_url, linkedin_url, skills, id]
    )
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
