import { z } from 'zod'

export const TYPES = ['passion', 'paid', 'open-source', 'hackathon', 'startup']
export const LEVELS = ['any', 'fresher', 'mid', 'senior']
export const STATUSES = ['open', 'in-progress', 'completed', 'closed']
export const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'closed']
export const LIMITS = {
  title: 120,
  description: 10000,
  message: 2000,
  name: 80,
  bio: 2000,
  location: 120,
  url: 2048,
}
const text = (max) => z.string().trim().min(1, 'Required').max(max)
const optionalText = (max) => z.string().trim().max(max).default('')
const url = z
  .union([
    z.literal(''),
    z
      .url()
      .max(LIMITS.url)
      .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol), 'Use an HTTP(S) URL'),
  ])
  .default('')
export const uuid = z.uuid()
const skills = z
  .array(uuid)
  .max(20)
  .refine((v) => new Set(v).size === v.length, 'Duplicate skills')
  .default([])
const projectFields = {
  title: text(LIMITS.title),
  description: text(LIMITS.description),
  type: z.enum(TYPES),
  skill_ids: skills,
  experience_level: z.enum(LEVELS),
  industry: optionalText(120),
  is_remote: z.boolean(),
  location: optionalText(LIMITS.location),
  max_members: z.number().int().min(2).max(20),
}
const locationRule = (v, ctx) => {
  if (!v.is_remote && !v.location)
    ctx.addIssue({
      code: 'custom',
      path: ['location'],
      message: 'Location is required for in-person projects',
    })
}
export const projectSchema = z.strictObject(projectFields).superRefine(locationRule)
// Editing is a complete form replacement with an explicit expected version.
export const projectEditSchema = z
  .strictObject({ ...projectFields, version: z.number().int().positive() })
  .superRefine(locationRule)
export const statusSchema = z.strictObject({
  status: z.enum(STATUSES),
  version: z.number().int().positive(),
})
export const applicationSchema = z.strictObject({ project_id: uuid, message: text(LIMITS.message) })
export const decisionSchema = z.strictObject({ status: z.enum(['accepted', 'rejected']) })
export const profileSchema = z.strictObject({
  name: text(LIMITS.name),
  bio: optionalText(LIMITS.bio),
  location: optionalText(LIMITS.location),
  github_url: url,
  linkedin_url: url,
  skill_ids: skills,
})
export const signupSchema = z.strictObject({
  name: text(LIMITS.name),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
})
