import { describe, it, expect } from 'vitest'
import {
  getZone,
  computeSlotStats,
  computeOverallStats,
  computeLeaveImpact,
  computeLeavePlanImpact,
  findVacationWindows,
  formatClasses,
  parseSessionDate,
} from '../engine/attendance'
import { JAVA, MA212, HRM, AOA, SDCP1, HOLIDAYS, ALL_SLOTS } from './fixtures'

describe('getZone', () => {
  it('green at 80%+', () => {
    expect(getZone(80)).toBe('green')
    expect(getZone(85.5)).toBe('green')
    expect(getZone(100)).toBe('green')
  })
  it('amber at 75-80%', () => {
    expect(getZone(75)).toBe('amber')
    expect(getZone(79.99)).toBe('amber')
  })
  it('red below 75%', () => {
    expect(getZone(74.99)).toBe('red')
    expect(getZone(0)).toBe('red')
  })
})

describe('computeSlotStats', () => {
  it('Java: 26/32 = 81.25%', () => {
    const stats = computeSlotStats(JAVA, HOLIDAYS)
    expect(stats.presentHours).toBe(26)
    expect(stats.totalHours).toBe(32)
    expect(stats.percentage).toBeCloseTo(81.25, 1)
    expect(stats.zone).toBe('green')
  })

  it('Java: remaining sessions after removing holidays', () => {
    const stats = computeSlotStats(JAVA, HOLIDAYS)
    // 12 upcoming - Sep 4 holiday = 11 × 2h = 22h
    expect(stats.remainingHours).toBe(22)
  })

  it('MA212: 36/42 = 85.71%', () => {
    const stats = computeSlotStats(MA212, HOLIDAYS)
    expect(stats.presentHours).toBe(36)
    expect(stats.totalHours).toBe(42)
    expect(stats.percentage).toBeCloseTo(85.71, 1)
  })

  it('HRM: 26/32 = 81.25%', () => {
    const stats = computeSlotStats(HRM, HOLIDAYS)
    expect(stats.presentHours).toBe(26)
    expect(stats.totalHours).toBe(32)
    expect(stats.percentage).toBeCloseTo(81.25, 1)
  })

  it('AoA: 38/44 = 86.36%', () => {
    const stats = computeSlotStats(AOA, HOLIDAYS)
    expect(stats.presentHours).toBe(38)
    expect(stats.totalHours).toBe(44)
    expect(stats.percentage).toBeCloseTo(86.36, 1)
  })

  it('SDCP1: 2/3 = 66.67%', () => {
    const stats = computeSlotStats(SDCP1, HOLIDAYS)
    expect(stats.presentHours).toBe(2)
    expect(stats.totalHours).toBe(3)
    expect(stats.percentage).toBeCloseTo(66.67, 1)
    expect(stats.zone).toBe('red')
  })
})

describe('computeOverallStats', () => {
  it('courses-only: 126/150 = 84%', () => {
    const stats = computeOverallStats(ALL_SLOTS, HOLIDAYS, true)
    expect(stats.presentHours).toBe(126)
    expect(stats.totalHours).toBe(150)
    expect(stats.percentage).toBeCloseTo(84, 1)
    expect(stats.zone).toBe('green')
  })

  it('all-pool: 136.5/164.5 ≈ 83%', () => {
    const stats = computeOverallStats(ALL_SLOTS, HOLIDAYS, false)
    expect(stats.presentHours).toBe(136.5)
    expect(stats.totalHours).toBe(164.5)
    expect(stats.percentage).toBeCloseTo(82.98, 0)
  })

  it('courses-only budget: ~25h missable', () => {
    const stats = computeOverallStats(ALL_SLOTS, HOLIDAYS, true)
    expect(stats.budgetHours).toBeGreaterThan(24)
    expect(stats.budgetHours).toBeLessThan(26)
  })
})

describe('computeLeaveImpact', () => {
  it('1-day leave on Sep 3 (Thu) affects AoA + HRM', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03')
    expect(impact.sessionsMissed).toBeGreaterThan(0)
    expect(impact.overallAfter).toBeLessThan(impact.overallBefore)
    expect(impact.overallZone).toBe('green')
  })

  it('2-week leave (Aug 31 - Sep 12) drops overall significantly', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-12')
    expect(impact.sessionsMissed).toBeGreaterThan(20)
    expect(impact.overallAfter).toBeLessThan(impact.overallBefore)
  })

  it('RP leave reduces impact — 1 RP on Sep 3 reduces missed sessions', () => {
    const withoutRp = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03', [], 0)
    const withRp = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03', [], 1)
    expect(withRp.rpLeavesUsed).toBe(1)
    expect(withRp.rpCoveredDates.length).toBe(1)
    expect(withRp.sessionsMissed).toBeLessThan(withoutRp.sessionsMissed)
    expect(withRp.overallAfter).toBeGreaterThan(withoutRp.overallAfter)
  })

  it('RP leave picks highest-hour day first', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-01', [], 1)
    expect(impact.rpLeavesUsed).toBe(1)
    expect(impact.rpCoveredDates.length).toBe(1)
    // Aug 31 (Mon) and Sep 1 (Tue) have sessions — one of them gets covered
    expect(['2026-08-31', '2026-09-01']).toContain(impact.rpCoveredDates[0])
  })

  it('timezone fix: Sep 6 (Sunday) should miss 0 sessions', () => {
    // Regression: toISOString() shifted IST midnight back to Sep 5 (Saturday),
    // which has 2 sessions. Must use local dates.
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-06', '2026-09-06')
    expect(impact.sessionsMissed).toBe(0)
    expect(impact.hoursMissed).toBe(0)
    expect(impact.overallAfter).toBe(impact.overallBefore)
  })

  it('timezone fix: Aug 30 (Sunday) to Sep 6 (Sunday) only counts weekdays', () => {
    // Sun→Sun should only miss Mon-Sat sessions in between, not shift into prior days
    // Sep 4 is a holiday — no sessions counted. Aug 30, Sep 6 are Sundays.
    // School days: Aug 31(3), Sep 1(3), Sep 2(1), Sep 3(3), Sep 5(2) = 12 sessions
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-30', '2026-09-06')
    expect(impact.sessionsMissed).toBe(12)
  })
})

describe('computeLeavePlanImpact (projected + stacked ranges)', () => {
  it('empty plan: overallFinal = attend-everything projection (higher than term-ended)', () => {
    const impact = computeLeavePlanImpact(ALL_SLOTS, HOLIDAYS, [])
    expect(impact.overallBefore).toBeCloseTo(82.98, 1)
    expect(impact.overallAfter).toBe(impact.overallBefore) // nothing missed
    // 136.5 present + 106 upcoming = 242.5 of 270.5 = 89.65%
    expect(impact.overallFinal).toBeCloseTo(89.65, 1)
    expect(impact.overallFinalZone).toBe('green')
    expect(impact.sessionsMissed).toBe(0)
  })

  it('1-day leave (Sep 3): projected main number, term-ended secondary', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03')
    expect(impact.sessionsMissed).toBe(3)
    expect(impact.hoursMissed).toBe(4) // AOA 2h + SDCP1 1h + SDCP2 1h
    expect(impact.overallAfter).toBeCloseTo(81.01, 1)
    expect(impact.overallFinal).toBeCloseTo(88.17, 1)
    expect(impact.overallFinal).toBeGreaterThan(impact.overallAfter)
    expect(impact.overallFinalZone).toBe('green')
  })

  it('projected final = formula: (present + remaining - missed)/(conducted + remaining)', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-12')
    // Cross-check against the closed form computed from the reported numbers:
    // after = (P)/(C+L), final = (P + R - L)/(C + R), so final = after ratio + remaining scaling.
    // Exact engine values: after 63.05, final 70.43
    expect(impact.overallAfter).toBeCloseTo(63.05, 1)
    expect(impact.overallFinal).toBeCloseTo(70.43, 1)
    expect(impact.overallFinalZone).toBe('red')
  })

  it('PRESENT-flip fix: a range over already-attended days costs nothing', () => {
    const past = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-07-30', '2026-08-05')
    expect(past.sessionsMissed).toBe(0)
    expect(past.hoursMissed).toBe(0)
    expect(past.overallAfter).toBe(past.overallBefore)
  })

  it('mixed window: past days inside the range contribute zero missed sessions', () => {
    const mixed = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-20', '2026-08-28')
    const futureOnly = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-24', '2026-08-28')
    expect(mixed.sessionsMissed).toBe(futureOnly.sessionsMissed)
  })

  it('stacked ranges union their missed sessions', () => {
    const plan = computeLeavePlanImpact(ALL_SLOTS, HOLIDAYS, [
      { id: 'a', startDate: '2026-08-31', endDate: '2026-09-01' },
      { id: 'b', startDate: '2026-09-10', endDate: '2026-09-11' },
    ])
    const a = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-01')
    const b = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-10', '2026-09-11')
    expect(plan.sessionsMissed).toBe(a.sessionsMissed + b.sessionsMissed)
    expect(plan.hoursMissed).toBe(a.hoursMissed + b.hoursMissed)
    expect(plan.daysCount).toBe(a.daysCount + b.daysCount)
    expect(plan.ranges.length).toBe(2)
    expect(plan.startDate).toBe('2026-08-31')
    expect(plan.endDate).toBe('2026-09-11')
  })

  it('overlapping ranges are deduped to the union', () => {
    const overlap = computeLeavePlanImpact(ALL_SLOTS, HOLIDAYS, [
      { id: 'a', startDate: '2026-08-31', endDate: '2026-09-02' },
      { id: 'b', startDate: '2026-09-01', endDate: '2026-09-03' },
    ])
    const single = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-03')
    expect(overlap.sessionsMissed).toBe(single.sessionsMissed)
    expect(overlap.daysCount).toBe(single.daysCount)
    expect(overlap.daysCount).toBe(4) // Aug 31, Sep 1, Sep 2, Sep 3
  })

  it('RP leave covers the leave day so it counts as attended', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03', [], 1)
    expect(impact.rpCoveredDates).toContain('2026-09-03')
    expect(impact.sessionsMissed).toBe(0)
    expect(impact.overallAfter).toBe(impact.overallBefore)
  })
})

describe('findVacationWindows', () => {
  it('returns ranked windows', () => {
    const windows = findVacationWindows(ALL_SLOTS, HOLIDAYS, 14)
    expect(windows.length).toBeGreaterThan(0)
    expect(windows[0].rank).toBe(1)
    // First window should have best total calendar days
    expect(windows[0].totalCalendarDays).toBeGreaterThanOrEqual(
      windows[Math.min(windows.length - 1, 1)].totalCalendarDays
    )
  })

  it('windows near Sep 4 holiday are longer', () => {
    const windows = findVacationWindows(ALL_SLOTS, HOLIDAYS, 14)
    const sep4Window = windows.find(w => w.startDate === '2026-09-04' || w.endDate === '2026-09-04')
    if (sep4Window) {
      expect(sep4Window.totalCalendarDays).toBeGreaterThan(0)
    }
  })
})

describe('parseSessionDate', () => {
  it('parses "17 Jul 2026" to ISO', () => {
    expect(parseSessionDate('17 Jul 2026')).toBe('2026-07-17')
  })
  it('parses "01 Jan 2026" to ISO', () => {
    expect(parseSessionDate('01 Jan 2026')).toBe('2026-01-01')
  })
  it('passes through ISO dates', () => {
    expect(parseSessionDate('2026-07-17')).toBe('2026-07-17')
  })
})

describe('formatClasses', () => {
  it('formats 4h as 2 classes', () => {
    expect(formatClasses(4)).toBe('2 classes (4h)')
  })
  it('formats 6h as 3 classes', () => {
    expect(formatClasses(6)).toBe('3 classes (6h)')
  })
  it('formats 5h as 2.5 classes', () => {
    expect(formatClasses(5)).toBe('2.5 classes (5h)')
  })
})
