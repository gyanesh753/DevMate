import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authenticate } from './middleware/auth.js'
import { requestContext, errorHandler, HttpError, parse } from './lib/errors.js'
import { transaction } from './db/index.js'
import projectsRouter from './routes/projects.js'
import applicationsRouter, { listApplications } from './routes/applications.js'
import usersRouter from './routes/users.js'
import { uuid } from '../shared/validation.js'
export function createApp({
  pool,
  supabase,
  origins = ['http://localhost:5173'],
  proxyHops = 0,
  rateLimits = true,
}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', proxyHops)
  app.use(
    requestContext,
    helmet(),
    cors({ origin: origins, credentials: false }),
    express.json({ limit: '64kb' }),
  )
  const limiter = (max, keyGenerator) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      ...(keyGenerator ? { keyGenerator } : {}),
      handler: (req, res, next) =>
        next(new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')),
    })
  if (rateLimits) app.use('/api', limiter(600))
  const writeLimiter = rateLimits ? limiter(60, (req) => req.user.id) : (req, res, next) => next()
  const auth = authenticate(supabase, true),
    optionalAuth = authenticate(supabase)
  const context = { pool, auth, optionalAuth, writeLimiter }
  app.get('/api/health', async (req, res) => {
    try {
      await transaction(pool, null, (c) => c.query('SELECT 1'))
      res.json({ status: 'healthy' })
    } catch {
      throw new HttpError(503, 'UNAVAILABLE', 'Service temporarily unavailable.')
    }
  })
  app.get('/api/skills', async (req, res) =>
    res.json(
      await transaction(
        pool,
        null,
        async (c) => (await c.query('SELECT id,name FROM public.skills ORDER BY name')).rows,
      ),
    ),
  )
  app.get('/api/projects/:id/applications', auth, async (req, res) =>
    res.json(await listApplications(pool, req, parse(uuid, req.params.id))),
  )
  app.use('/api/projects', projectsRouter(context))
  app.use('/api/applications', applicationsRouter(context))
  app.use('/api/users', usersRouter(context))
  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint not found.')))
  app.use(errorHandler)
  return app
}
