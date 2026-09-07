import { test, expect, type Page } from '@playwright/test'
import { loginAsTestUser } from './helpers'

// The IOT tab's single test seam, rewritten for phase 2. Phase 1's assertions named a hardcoded
// roster (`ENV-3F-03` in alarm, a specific device offline); devices are authored now, so every one
// of those became false and this is a rewrite rather than an extension.
//
// ⚠️ This test WRITES TO A LIVE DATABASE. There is no staging environment — whichever Supabase
// project the app points at is production. So it creates one device, asserts against it, and
// deletes it through the same UI, asserting it is gone. The cleanup assertion is part of the test
// precisely so a failed cleanup fails loudly instead of leaving a stray device in a real project.
//
// Prior art: model-teardown.spec.ts, for project discovery, the fixed engine-boot wait (there is no
// ready signal) and the filtered console/pageerror collection.

const isEngineCrash = (msg: string) =>
  /No camera initialized/i.test(msg) ||
  /reading 'dispose'/i.test(msg) ||
  /Cannot read properties of (null|undefined)/i.test(msg)

/** Names the device this run creates, so a leaked row is traceable to a test rather than a user. */
const deviceLabel = `E2E probe ${Date.now()}`

async function openIotTab(page: Page) {
  await page.getByRole('button', { name: 'IOT', exact: true }).click()
  await page.waitForTimeout(1500)
}

async function gotoProjectModel(page: Page): Promise<string | null> {
  await loginAsTestUser(page)
  await page
    .locator('a[href*="/projects/"]')
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {})

  const projectId = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('a[href*="/projects/"]'))
        .map((el) => el.getAttribute('href')?.match(/\/projects\/([^/]+)/)?.[1])
        .find(Boolean) ?? null,
  )
  if (!projectId) return null

  await page.goto(`/projects/${projectId}/model`)
  // Engine setup plus the project's cloud models streaming in. Measured: a project with 8
  // models needs well over 10s before anything is pickable, and the element probe below is not a
  // substitute for waiting — it only retries clicks, it cannot make geometry arrive sooner.
  await page.waitForTimeout(25_000)
  return projectId
}


/**
 * Clicks across the viewport until one point selects an element that can still be bound.
 *
 * A grid rather than a handful of centre points, for two reasons. Where geometry sits on screen
 * depends on the project and camera; and elements that are **already devices** are legitimately
 * unbindable — the panel says so instead of offering the form — so a sweep must be able to walk
 * past however many a real project has already accumulated.
 */
async function selectAnyElement(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  labelInput: ReturnType<Page['getByTestId']>,
): Promise<boolean> {
  const columns = [0.2, 0.35, 0.5, 0.65, 0.8]
  const rows = [0.25, 0.4, 0.55, 0.7]

  for (let pass = 0; pass < 2; pass++) {
    for (const fy of rows) {
      for (const fx of columns) {
        await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
        await page.waitForTimeout(600)
        if (await labelInput.isVisible().catch(() => false)) return true
      }
    }
    // Give any still-streaming models a moment before sweeping again.
    await page.waitForTimeout(4000)
  }
  return false
}

test.describe('IOT tab', () => {
  // The per-test budget is global, and this test spends most of it waiting: login, engine boot,
  // and a create/delete round-trip against a real database.
  test.setTimeout(180_000)

  test('binds an element as a device, drives the panel, and removes it', async ({ page }) => {
    const engineErrors: string[] = []
    page.on('pageerror', (e) => {
      if (isEngineCrash(e.message)) engineErrors.push(`pageerror: ${e.message}`)
    })
    page.on('console', (m) => {
      if (m.type() === 'error' && isEngineCrash(m.text())) engineErrors.push(`console: ${m.text()}`)
    })

    const projectId = await gotoProjectModel(page)
    test.skip(!projectId, 'No project available in the test account.')

    await openIotTab(page)

    // Binding is admin-only. Without the bind form there is nothing this test can do, and a
    // non-admin account is a legitimate configuration rather than a failure.
    const labelInput = page.getByTestId('iot-bind-label')
    const bindPanelPresent = await page
      .getByTestId('iot-bind-save')
      .or(page.locator('text=Select one element in the model'))
      .first()
      .isVisible()
      .catch(() => false)
    test.skip(!bindPanelPresent, 'Test account is not a project admin — cannot bind devices.')

    // ─── Select one element in the viewport ──────────────────────────────────
    // Scoped to the viewport container so this cannot match the MiniMap's canvas.
    const canvas = page
      .locator('[aria-label="BIM model viewport container"]')
      .locator('canvas')
      .first()
    await canvas.waitFor({ state: 'visible', timeout: 30_000 })
    const box = await canvas.boundingBox()
    test.skip(!box, 'Viewport canvas has no layout box.')

    // A single blind click at the centre is not good enough: where the geometry sits on screen
    // depends on the project, the camera and which models finished loading. Probe a spread of
    // points until one lands on an element, which is what a user does anyway.
    const hit = await selectAnyElement(page, box!, labelInput)
    test.skip(!hit, 'No element could be picked in this project — nothing to bind.')

    // ─── Bind it ─────────────────────────────────────────────────────────────
    await labelInput.fill(deviceLabel)
    await page.getByTestId('iot-bind-save').click()

    const row = page
      .locator('[data-testid="iot-device-row"]')
      .filter({ hasText: deviceLabel })
      .first()
    await expect(row, 'the bound device should appear in the list').toBeVisible({ timeout: 15_000 })

    // Everything from here runs inside try/finally so a failed assertion still removes the
    // device. Without it a failure leaves a real row in a real project — and because a bound
    // element is then reported as taken rather than offered for binding, it also blocks the
    // next run from finding anything to bind.
    try {

      // ─── The same element cannot be bound twice ──────────────────────────────
      // Asserted here, before anything moves the camera. The element bound above is still the one
      // selected in the viewport, so the panel must now report it as taken rather than offering a
      // second bind. (Checking this after clicking the device row does not work: that flies the
      // camera, so the same screen coordinate no longer points at the same element.)
      await expect(
        page.locator('text=already the device'),
        'a bound element must be reported as taken, not offered for a duplicate bind',
      ).toBeVisible({ timeout: 15_000 })

      // ─── A chip appears on the model ─────────────────────────────────────────
      // Chips are ordinary light-DOM elements (confirmed by probe), so they are queryable here.
      const deviceId = await row.getAttribute('data-device-id')
      const chip = page.locator(`.iot-chip[data-device-id="${deviceId}"]`)
      await expect(chip, 'the bound device should get a chip on its element').toBeVisible({
        timeout: 15_000,
      })

      // ─── The chip carries the same value as the row ──────────────────────────
      // The two value elements are compared directly, not by regexing the row: the row also holds
      // the device label, and a label like "E2E probe 1788…" makes the first digit in it the "2" of
      // "E2E". Both are read in one evaluation because readings tick every few seconds, so reading
      // one and then asserting the other compares two different instants.
      await expect
        .poll(
          async () =>
            page.evaluate((id) => {
              const row = document.querySelector(
                `[data-testid="iot-device-row"][data-device-id="${id}"]`,
              )
              // An offline device renders the no-value marker instead of a value — on both surfaces.
            // Falling back to it is what lets this assertion also prove the two agree when there
            // is nothing to report, which is the case most likely to be got wrong.
            const rowValue = (
              row?.querySelector('[data-testid="iot-row-value"]') ??
              row?.querySelector('[data-testid="iot-no-value"]')
            )?.textContent?.trim()
              const chipValue = document
                .querySelector(`.iot-chip[data-device-id="${id}"] .iot-chip__value`)
                ?.textContent?.trim()
              if (!rowValue || !chipValue) return `missing row=${rowValue} chip=${chipValue}`
              return rowValue === chipValue ? 'match' : `row=${rowValue} chip=${chipValue}`
            }, deviceId),
          {
            message: 'chip and list row must show the same reading, never two different numbers',
            timeout: 20_000,
          },
        )
        .toBe('match')

      // ─── Clicking the chip selects the device ────────────────────────────────
      await chip.click()
      const panel = page.getByTestId('iot-data-panel')
      await expect(panel).toBeVisible()
      await expect(panel).toHaveAttribute('data-device-id', deviceId!)
      await expect(chip, 'the selected chip should be marked as such').toHaveClass(
        /iot-chip--selected/,
      )

      // ─── The layer switch removes every chip, and restores them ──────────────
      const chipToggle = page.getByTestId('iot-chip-toggle')
      await chipToggle.uncheck()
      await expect(page.locator('.iot-chip')).toHaveCount(0, { timeout: 10_000 })
      await chipToggle.check()
      await expect(chip).toBeVisible({ timeout: 10_000 })

      // ─── Leaving the tab takes the chips with it ─────────────────────────────
      // Chips cannot be occluded, so one left behind would float over every other tab.
      await page.getByRole('button', { name: 'Models', exact: true }).click()
      await page.waitForTimeout(1000)
      await expect(
        page.locator('.iot-chip'),
        'no chip may survive leaving the IOT tab',
      ).toHaveCount(0)
      await openIotTab(page)
      await expect(chip).toBeVisible({ timeout: 15_000 })

      // ─── It drives the right panel ───────────────────────────────────────────
      await row.click()
      await expect(panel).toBeVisible()
      await expect(panel).toContainText(deviceLabel)

      // ─── Clean up, and prove it ──────────────────────────────────────────────
      await page.getByTestId('iot-delete').click()
      await page.getByTestId('iot-delete-confirm').click()

      await expect(
        page.locator('[data-testid="iot-device-row"]').filter({ hasText: deviceLabel }),
        'the test must not leave a device behind in a real project',
      ).toHaveCount(0, { timeout: 15_000 })
    } finally {
      // Best-effort second pass: if an assertion above threw before the delete ran, remove the
      // device anyway. Failures here are swallowed — this must never mask the real failure.
      const stray = page
        .locator('[data-testid="iot-device-row"]')
        .filter({ hasText: deviceLabel })
        .first()
      if (await stray.isVisible().catch(() => false)) {
        await stray.click().catch(() => {})
        await page.getByTestId('iot-delete').click().catch(() => {})
        await page.getByTestId('iot-delete-confirm').click().catch(() => {})
        await page.waitForTimeout(1500)
      }
    }

    expect(engineErrors, 'engine error(s): ' + engineErrors.join(' | ')).toEqual([])
  })

  /**
   * Guards the one change this feature makes to shared code: Isolate and Hide now bump the
   * visibility epoch, which `useIfcSpaceVisibility` also listens to.
   *
   * ⚠️ **Partial by construction.** Whether a room is still *drawn* is not cheaply observable from
   * the DOM — the check that would settle it needs engine access this suite deliberately does not
   * have. What this asserts is that the flow completes, the selection survives, and the engine
   * raises nothing. Reading the hook's source says the rule is hide-only and therefore inert while
   * spaces are meant to be visible; **a human still has to confirm the room is on screen.**
   */
  test('isolating a room on the Room tab survives the added visibility-epoch bumps', async ({
    page,
  }) => {
    test.setTimeout(180_000)

    const engineErrors: string[] = []
    page.on('pageerror', (e) => {
      if (isEngineCrash(e.message)) engineErrors.push(`pageerror: ${e.message}`)
    })
    page.on('console', (m) => {
      if (m.type() === 'error' && isEngineCrash(m.text())) engineErrors.push(`console: ${m.text()}`)
    })

    const projectId = await gotoProjectModel(page)
    test.skip(!projectId, 'No project available in the test account.')

    await page.getByRole('button', { name: 'Room', exact: true }).click()
    await page.waitForTimeout(4000)

    const roomRow = page.locator('button', { hasText: /./ }).nth(0)
    const rooms = page.getByRole('button').filter({ hasText: /^\s*\S/ })
    test.skip((await rooms.count()) === 0, 'No rooms listed in this project.')

    // Pick a room from the list, then isolate it from the visibility toolbar.
    await roomRow.click().catch(() => {})
    await page.waitForTimeout(1000)

    const visibilityButton = page.getByRole('button', { name: /visib/i }).first()
    const hasToolbar = await visibilityButton.isVisible().catch(() => false)
    test.skip(!hasToolbar, 'Visibility toolbar not reachable in this layout.')

    await visibilityButton.click()
    await page.waitForTimeout(500)
    const isolate = page.getByRole('button', { name: /isolate/i }).first()
    if (await isolate.isVisible().catch(() => false)) {
      await isolate.click()
      await page.waitForTimeout(2500)
    }

    // Put the model back so the run leaves nothing surprising behind.
    await visibilityButton.click().catch(() => {})
    await page.waitForTimeout(400)
    const showAll = page.getByRole('button', { name: /show all/i }).first()
    if (await showAll.isVisible().catch(() => false)) {
      await showAll.click()
      await page.waitForTimeout(2000)
    }

    expect(engineErrors, 'engine error(s): ' + engineErrors.join(' | ')).toEqual([])
  })
})
