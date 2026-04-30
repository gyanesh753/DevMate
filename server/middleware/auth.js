const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : null

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' })
    }

    if (!supabase) {
      return res.status(500).json({
        error:
          'Server auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.',
      })
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = { requireAuth }
