import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { parseSchedule } from '@/classes/ConstructionSchedule'

// Seam 1 of the Construction Sequence spec: the pure Schedule core, run in Node — no page, no
// engine. Expected values come from the `pias-4d-schedule/1` contract (handoff brief) and from the
// real PSM file, never from re-deriving them the way the core does.

/** A minimal valid Schedule; each test bends one field. */
function scheduleBody(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'pias-4d-schedule/1',
    project: 'TEST',
    time_unit: 'month',
    months: 10,
    highlight_color: '#3CD070',
    tasks: [
      { id: 'A', building: 'B1', name: 'Foundation', start_month: 0, end_month: 2, guids: ['g1', 'g2'] },
      { id: 'B', building: 'B1', name: 'Level 2 · Structure', start_month: 2, end_month: 5, guids: ['g3'] },
      { id: 'C', building: 'B2', name: 'Facade Painting', start_month: 4, end_month: 6, guids: [] },
      { id: 'D', building: 'B2', name: 'Walls', start_month: 3.5, end_month: 10, guids: ['g4'] },
    ],
    ...overrides,
  }
}

function errorsOf(input: unknown): string[] {
  const result = parseSchedule(input)
  expect(result.ok).toBe(false)
  return result.ok ? [] : result.errors
}

test.describe('Schedule validation', () => {
  test('accepts a well-formed Schedule', () => {
    const result = parseSchedule(scheduleBody())
    expect(result.ok).toBe(true)
  })

  test('refuses a file that is not pias-4d-schedule/1', () => {
    expect(errorsOf(scheduleBody({ schema: 'pias-4d-schedule/2' })).join('\n')).toMatch(/pias-4d-schedule\/1/)
  })

  test('refuses a time unit other than month, so real dates are never read as months', () => {
    expect(errorsOf(scheduleBody({ time_unit: 'day' })).join('\n')).toMatch(/month/i)
  })

  test('refuses a GUID that belongs to two Tasks, naming both', () => {
    const body = scheduleBody()
    body.tasks[1].guids = ['g3', 'g1']
    const message = errorsOf(body).join('\n')
    expect(message).toMatch(/g1/)
    expect(message).toMatch(/\bA\b/)
    expect(message).toMatch(/\bB\b/)
  })

  test('refuses a Task that does not end after it starts, naming it', () => {
    const body = scheduleBody()
    body.tasks[2].end_month = 4
    expect(errorsOf(body).join('\n')).toMatch(/\bC\b.*end/i)
  })

  test('refuses a Task outside the Schedule months, naming it', () => {
    const body = scheduleBody()
    body.tasks[3].end_month = 11
    expect(errorsOf(body).join('\n')).toMatch(/\bD\b/)
    const early = scheduleBody()
    early.tasks[0].start_month = -1
    expect(errorsOf(early).join('\n')).toMatch(/\bA\b/)
  })
})

function fixture() {
  const result = parseSchedule(scheduleBody())
  if (!result.ok) throw new Error(result.errors.join('\n'))
  return result.schedule
}

const sorted = (values: string[]) => [...values].sort()

test.describe('States at a month', () => {
  test('an element appears exactly at its Task start and turns real colour exactly at its end', () => {
    const schedule = fixture()
    expect(schedule.stateOf('g3', 1.9)).toBe('not-started')
    expect(schedule.stateOf('g3', 2)).toBe('in-progress')
    expect(schedule.stateOf('g3', 4.9)).toBe('in-progress')
    expect(schedule.stateOf('g3', 5)).toBe('built')
  })

  test('an element in no Task is Unscheduled', () => {
    expect(fixture().stateOf('not-in-any-task', 3)).toBeNull()
  })

  test('the Tasks In progress at a month include ones with nothing to show', () => {
    expect(fixture().tasksInProgress(4.5).map((t) => t.id)).toEqual(['B', 'C', 'D'])
  })
})

test.describe('Boundaries and diffs', () => {
  test('boundaries are every start and end month, sorted, once each', () => {
    expect(fixture().boundaries).toEqual([0, 2, 3.5, 4, 5, 6, 10])
  })

  test('moving within one interval changes nothing', () => {
    const diff = fixture().diff(1, 1.5)
    expect(diff.show).toEqual([])
    expect(diff.hide).toEqual([])
    expect(sorted(diff.inProgress)).toEqual(['g1', 'g2'])
  })

  test('crossing a start shows that Task; crossing back hides it again', () => {
    const schedule = fixture()
    const forward = schedule.diff(1.9, 2)
    expect(forward).toEqual({ show: ['g3'], hide: [], inProgress: ['g3'] })
    const back = schedule.diff(2, 1.9)
    expect(back.show).toEqual([])
    expect(back.hide).toEqual(['g3'])
    expect(sorted(back.inProgress)).toEqual(['g1', 'g2'])
  })

  test('from nothing applied, month 0 shows only what has started', () => {
    const diff = fixture().diff(null, 0)
    expect(sorted(diff.show)).toEqual(['g1', 'g2'])
    expect(sorted(diff.hide)).toEqual(['g3', 'g4'])
  })

  test('at the last month everything scheduled is visible and nothing is In progress', () => {
    const diff = fixture().diff(null, 10)
    expect(sorted(diff.show)).toEqual(['g1', 'g2', 'g3', 'g4'])
    expect(diff.hide).toEqual([])
    expect(diff.inProgress).toEqual([])
    expect(sorted(fixture().diff(0, 10).show)).toEqual(['g3', 'g4'])
  })
})

// The real file `build_4d.py` produced. Facts from the handoff brief and the spec: 51 Tasks,
// 6,560 unique GUIDs, 51 distinct boundaries, months 0–14, two Facade Painting Tasks with no GUIDs.
const PSM_PATH =
  process.env.PSM_4D_SCHEDULE_PATH ?? 'G:/My Drive/03_PIAS_Blender-MCP/00_PSM-Donmueang/PSM_4D_schedule.json'

test.describe('The PSM Schedule', () => {
  test.skip(!existsSync(PSM_PATH), `PSM Schedule not found at ${PSM_PATH} (set PSM_4D_SCHEDULE_PATH).`)

  test('is accepted with its Unicode Task names intact', () => {
    const result = parseSchedule(JSON.parse(readFileSync(PSM_PATH, 'utf8')))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const schedule = result.schedule
    expect(schedule.tasks).toHaveLength(51)
    expect(schedule.guidCount).toBe(6560)
    expect(schedule.boundaries).toHaveLength(51)
    expect(schedule.tasks.some((t) => t.name.includes('·'))).toBe(true)
    expect(schedule.tasks.filter((t) => t.guids.length === 0).map((t) => t.id)).toEqual(['T050', 'T058'])
    expect(schedule.diff(null, 14).inProgress).toEqual([])
    expect(schedule.diff(null, 14).show).toHaveLength(6560)
  })
})
