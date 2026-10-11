import { describe, it, expect } from 'vitest'
import {
  projectSchema,
  profileSchema,
  decisionSchema,
  applicationSchema,
} from '../shared/validation.js'
import { pagination, page } from '../server/lib/pagination.js'
const project = {
  title: 'Project',
  description: 'Description',
  type: 'passion',
  experience_level: 'any',
  is_remote: true,
  max_members: 2,
}
describe('form boundaries', () => {
  it('requires meaningful content and strict identity-free fields', () => {
    expect(projectSchema.safeParse({ ...project, title: '   ' }).success).toBe(false)
    expect(projectSchema.safeParse({ ...project, owner_id: crypto.randomUUID() }).success).toBe(
      false,
    )
    expect(projectSchema.safeParse({ ...project, is_remote: 'false' }).success).toBe(false)
    expect(projectSchema.safeParse({ ...project, is_remote: false }).success).toBe(false)
    expect(
      projectSchema.safeParse({ ...project, is_remote: false, location: 'Pune' }).success,
    ).toBe(true)
    expect(projectSchema.safeParse({ ...project, max_members: 2.5 }).success).toBe(false)
    expect(profileSchema.safeParse({ name: 'A', github_url: 'javascript:alert(1)' }).success).toBe(
      false,
    )
    expect(decisionSchema.safeParse({ status: 'pending' }).success).toBe(false)
    expect(
      applicationSchema.safeParse({ project_id: crypto.randomUUID(), message: ' ' }).success,
    ).toBe(false)
  })
  it('preserves cursor timestamp precision and binds filters', () => {
    const paging = pagination({ limit: '1' }, { search: 'x' })
    const at = '2026-10-11T01:02:03.123456Z',
      id = crypto.randomUUID()
    const data = page(
      [
        { id, cursor_at: at },
        { id: crypto.randomUUID(), cursor_at: at },
      ],
      paging,
    )
    expect(pagination({ cursor: data.nextCursor }, { search: 'x' }).cursor.at).toBe(at)
    expect(data.items[0]).not.toHaveProperty('cursor_at')
    expect(() => pagination({ cursor: data.nextCursor }, { search: 'y' })).toThrow()
  })
})
