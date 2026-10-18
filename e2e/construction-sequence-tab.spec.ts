import { test, expect, type Page } from '@playwright/test'
import { loginAsTestUser } from './helpers'

// Seam 2 of the Construction Sequence spec: the 4D tab in a real browser, against the Sample
// Project (9999_PSM) with the PSM Schedule already uploaded.
//
// READ-ONLY. The database is production, and uploading replaces a project's one Schedule, so this
// spec never uploads. Precondition: the developer has uploaded `PSM_4D_schedule.json` to the target
// project once through the 4D tab. Without it the spec skips.
//
// Target project: `E2E_4D_PROJECT_ID` in .env.local, else the first project whose card mentions
// 9999 / PSM. Expected values below are literals read from the PSM file, not re-derived.
//
// Prior art: iot-tab.spec.ts (project discovery, fixed engine-boot wait, engine-error filter).

const isEngineCrash = (msg: string) =>
  /No camera initialized/i.test(msg) ||
  /reading 'dispose'/i.test(msg) ||
  /Cannot read properties of (null|undefined)/i.test(msg) ||
  /\[4d\]/.test(msg)

async function gotoPsmModel(page: Page): Promise<string | null> {
  await loginAsTestUser(page)
  let projectId = process.env.E2E_4D_PROJECT_ID ?? null
  if (!projectId) {
    await page.locator('a[href*="/projects/"]').first().waitFor({ timeout: 15_000 }).catch(() => {})
    projectId = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('a[href*="/projects/"]'))
          .filter((el) => /9999|PSM/i.test(el.textContent ?? ''))
          .map((el) => el.getAttribute('href')?.match(/\/projects\/([^/]+)/)?.[1])
          .find(Boolean) ?? null,
    )
  }
  if (!projectId) return null
  await page.goto(`/projects/${projectId}/model`)
  // Engine boot plus the project's cloud models streaming in — same budget as the IOT spec.
  await page.waitForTimeout(25_000)
  return projectId
}

const taskRow = (page: Page, id: string) => page.locator(`[data-testid="cs-task"][data-task-id="${id}"]`)
const inProgressIds = (page: Page) =>
  page.locator('[data-testid="cs-task"][data-state="in-progress"]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-task-id')),
  )

async function openVisibilityMenu(page: Page) {
  await page.getByRole('button', { name: 'Visibility', exact: true }).click()
}

test.describe('4D tab', () => {
  test.setTimeout(180_000)

  test('scrubs the PSM Construction Sequence and gives the viewport back on leaving', async ({ page }) => {
    const engineErrors: string[] = []
    page.on('pageerror', (e) => {
      if (isEngineCrash(e.message)) engineErrors.push(`pageerror: ${e.message}`)
    })
    page.on('console', (m) => {
      // The 4D component reports apply / restore failures as warnings, prefixed "[4d]".
      const relevant = m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[4d]'))
      if (relevant && isEngineCrash(m.text())) engineErrors.push(`console: ${m.text()}`)
    })

    const projectId = await gotoPsmModel(page)
    test.skip(!projectId, 'No PSM project available to the test account.')

    await page.getByRole('button', { name: '4D', exact: true }).click()
    const gantt = page.getByTestId('cs-gantt')
    const hasSchedule = await gantt.waitFor({ timeout: 15_000 }).then(() => true, () => false)
    test.skip(!hasSchedule, 'No Schedule uploaded to this project — upload PSM_4D_schedule.json once through the 4D tab.')

    // ── Opens at the last month, paused ────────────────────────────────────────
    await expect(page.getByTestId('cs-month')).toHaveText('Month 14.0 / 14')
    await expect(page.getByTestId('cs-play')).toHaveAttribute('data-playing', 'false')

    // ── The Gantt: 51 Tasks in three buildings; Facade Painting has nothing to show
    await expect(page.getByTestId('cs-task')).toHaveCount(51)
    await expect(page.getByTestId('cs-building')).toHaveCount(3)
    await expect(taskRow(page, 'T050').getByTestId('cs-task-empty')).toBeVisible()
    await expect(taskRow(page, 'T058').getByTestId('cs-task-empty')).toBeVisible()

    // ── A known month marks exactly the expected Tasks In progress ─────────────
    // T003 (PSM2 Foundation) starts at exactly 3.0 — the start edge counts as In progress.
    await page.getByTestId('cs-slider').fill('3')
    await expect(page.getByTestId('cs-month')).toHaveText('Month 3.0 / 14')
    expect((await inProgressIds(page)).sort()).toEqual(['T002', 'T003'])

    await page.getByTestId('cs-slider').fill('8')
    expect((await inProgressIds(page)).sort()).toEqual(['T036', 'T037', 'T038', 'T039', 'T040', 'T041', 'T044'])

    // ── Clicking a Task jumps to its start and pauses ──────────────────────────
    await taskRow(page, 'T012').click()
    await expect(page.getByTestId('cs-month')).toHaveText('Month 4.6 / 14')
    await expect(page.getByTestId('cs-play')).toHaveAttribute('data-playing', 'false')

    // ── Play advances the month ────────────────────────────────────────────────
    await page.getByTestId('cs-play').click()
    await expect(page.getByTestId('cs-play')).toHaveAttribute('data-playing', 'true')
    await page.waitForTimeout(1500)
    await page.getByTestId('cs-play').click()
    const played = Number((await page.getByTestId('cs-month').textContent())?.match(/Month ([\d.]+)/)?.[1])
    expect(played).toBeGreaterThan(5)

    // ── Isolate / Hide are off while 4D owns visibility … ──────────────────────
    await openVisibilityMenu(page)
    await expect(page.getByRole('button', { name: 'Isolate', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Hide', exact: true })).toBeDisabled()
    await openVisibilityMenu(page)

    // … and come back on any other tab. Disabled for want of a selection there is still fine;
    // the hover hint must stop blaming 4D.
    await page.getByRole('button', { name: 'Models', exact: true }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('cs-timeline')).toHaveCount(0)
    await openVisibilityMenu(page)
    await expect(page.getByText('the 4D tab controls visibility')).toHaveCount(0)

    expect(engineErrors, engineErrors.join('\n')).toEqual([])
  })
})
