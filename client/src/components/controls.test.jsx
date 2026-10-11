import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import ProjectCard from './ProjectCard'
import { ProjectForm } from '../pages/PostProject'
import Home from '../pages/Home'
import ProjectDetail from '../pages/ProjectDetail'
import { api } from '../lib/api'
vi.mock('../lib/api', () => ({ api: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const project = {
  id: 'a',
  title: 'Team project',
  description: 'Build together',
  type: 'passion',
  status: 'open',
  member_count: 1,
  max_members: 3,
  skills: [],
  owner_id: 'owner',
  owner_name: 'Owner',
  experience_level: 'any',
  is_remote: true,
}
function Location() {
  return (
    <p data-testid="location">
      {useLocation().pathname}
      {useLocation().search}
    </p>
  )
}
describe('working controls', () => {
  it('Apply navigates to the application form using a keyboard-accessible link', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProjectCard project={project} />
        <Location />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'Apply' }))
    expect(screen.getByTestId('location').textContent).toBe('/projects/a?apply=1')
  })
  it('failed posting preserves input and releases the submit button', async () => {
    api.mockRejectedValue(new Error('Connection interrupted'))
    const user = userEvent.setup()
    render(<ProjectForm catalog={[]} onSaved={vi.fn()} />)
    await user.type(screen.getByLabelText('Project title'), 'My project')
    await user.type(screen.getByLabelText('Description'), 'A useful description')
    await user.click(screen.getByRole('button', { name: 'Post project' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Project title').value).toBe('My project')
    expect(screen.getByRole('button', { name: 'Post project' }).disabled).toBe(false)
  })
  it('search updates the URL and handles API failures without rendering an object as a list', async () => {
    api.mockResolvedValue({ items: [], hasMore: false, nextCursor: null })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Home />
        <Location />
      </MemoryRouter>,
    )
    await screen.findByText(/No projects found/)
    await user.type(
      screen.getByRole('textbox', { name: 'Search by title, description or skill' }),
      'React',
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/?search=React'))
    api.mockRejectedValueOnce(new Error('Service unavailable'))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable')
  })
  it('stale search responses cannot overwrite the latest results', async () => {
    let finishOld
    api
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve
          }),
      )
      .mockResolvedValue({ items: [{ ...project, title: 'Latest result' }], hasMore: false })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Search by title, description or skill' }),
      'latest',
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('Latest result')
    finishOld({ items: [{ ...project, title: 'Old result' }], hasMore: false })
    await waitFor(() => expect(screen.queryByText('Old result')).toBeNull())
  })
  it('persisted application status replaces the submit control', async () => {
    api.mockResolvedValue({ ...project, members: [], my_application: { status: 'accepted' } })
    render(
      <MemoryRouter initialEntries={['/projects/a']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetail user={{ id: 'applicant' }} />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByText('accepted')
    expect(screen.queryByRole('button', { name: 'Submit application' })).toBeNull()
  })
})
