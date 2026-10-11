import { test, expect } from '@playwright/test'
import { environment } from '../helpers.js'
import { randomUUID } from 'node:crypto'
let env, owner, applicant
const title = `Browser project ${randomUUID().slice(0, 8)}`
test.beforeAll(async () => {
  env = await environment()
  owner = await env.user('Browser owner')
  applicant = await env.user('Browser applicant')
})
test.afterAll(async () => {
  if (env) await env.close()
})
async function signIn(page, user) {
  await page.goto('/auth')
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
}
test('owner and applicant complete the collaboration lifecycle', async ({ browser }) => {
  const ownerContext = await browser.newContext(),
    applicantContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage(),
    applicantPage = await applicantContext.newPage()
  try {
    await signIn(ownerPage, owner)
    await ownerPage.getByRole('link', { name: 'Post a project', exact: true }).click()
    await ownerPage.getByLabel('Project title', { exact: true }).fill(title)
    await ownerPage
      .getByLabel('Description', { exact: true })
      .fill('Build a reliable collaboration platform together.')
    await ownerPage.getByLabel('React', { exact: true }).check()
    await ownerPage.getByLabel('Total team capacity (including you)', { exact: true }).fill('2')
    await ownerPage.getByRole('button', { name: 'Post project', exact: true }).click()
    await expect(ownerPage.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const projectURL = ownerPage.url()
    await applicantPage.goto(projectURL + '?apply=1')
    await applicantPage.getByRole('button', { name: 'Sign in to apply' }).click()
    await applicantPage.getByLabel('Email', { exact: true }).fill(applicant.email)
    await applicantPage.getByLabel('Password', { exact: true }).fill(applicant.password)
    await applicantPage.getByRole('button', { name: 'Sign in', exact: true }).click()
    await applicantPage
      .getByLabel('Why would you like to join?')
      .fill('I can build accessible React components.')
    await applicantPage.getByRole('button', { name: 'Submit application' }).click()
    await expect(applicantPage.getByText('pending', { exact: true })).toBeVisible()
    await applicantPage.reload()
    await expect(applicantPage.getByText('pending', { exact: true })).toBeVisible()
    await ownerPage.getByRole('link', { name: 'Review applications' }).click()
    await ownerPage.getByRole('button', { name: 'Accept', exact: true }).click()
    await ownerPage.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(
      ownerPage.getByRole('article').getByText('accepted', { exact: true }),
    ).toBeVisible()
    await applicantPage.getByRole('link', { name: 'My applications', exact: true }).click()
    await expect(
      applicantPage.getByRole('article').getByText('accepted', { exact: true }),
    ).toBeVisible()
    await ownerPage.goto(projectURL)
    await expect(ownerPage.getByText(/2\/2 total members/)).toBeVisible()
    await ownerPage.getByRole('link', { name: 'Edit project', exact: true }).click()
    await ownerPage.getByLabel('Project title', { exact: true }).fill(title + ' updated')
    await ownerPage.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      ownerPage.getByRole('heading', { name: title + ' updated', exact: true }),
    ).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Start project', exact: true }).click()
    await ownerPage.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(ownerPage.getByText('in-progress', { exact: true })).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Mark completed', exact: true }).click()
    await ownerPage.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(ownerPage.getByText('completed', { exact: true })).toBeVisible()
    await expect(ownerPage.getByRole('link', { name: 'Edit project', exact: true })).toHaveCount(0)
  } finally {
    await ownerContext.close()
    await applicantContext.close()
  }
})
test('sign-up creates a profile and keyboard search returns matching skills', async ({ page }) => {
  const email = `signup-${randomUUID()}@example.test`
  try {
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Create an account', exact: true }).click()
    await page.getByLabel('Full name').fill('New builder')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(`Password-${randomUUID()}!`)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New builder', exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Search projects', exact: true }).fill('React')
    await page.getByRole('textbox', { name: 'Search projects', exact: true }).press('Enter')
    await expect(page).toHaveURL(/search=React/)
    await expect(
      page.getByRole('textbox', { name: 'Search by title, description or skill' }),
    ).toHaveValue('React')
  } finally {
    const {
      rows: [u],
    } = await env.admin.query('SELECT id FROM auth.users WHERE email=$1', [email])
    if (u) await env.authAdmin.auth.admin.deleteUser(u.id)
  }
})
