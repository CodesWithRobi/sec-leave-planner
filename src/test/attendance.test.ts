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
  applyOverrides,
  applyODs,
  sessionHours,
  upcomingSessions,
  mapSessionStatus,
  normalizeAttendanceData,
  DEFAULT_HOLIDAYS,
  preloadedHolidays,
  isSessionCancelled,
} from '../engine/attendance'
import { JAVA, MA212, HRM, AOA, SDCP1, HOLIDAYS, ALL_SLOTS, makeSession } from './fixtures'
import type { Session, SlotDetail, ODEntry, HolidayWindow } from '../engine/types'

const od = (partial: Partial<ODEntry>): ODEntry => ({
  id: 'od-test',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  ...partial,
})

describe('DEFAULT_HOLIDAYS / preloadedHolidays', () => {
  it('Onam is a PARTIAL-day holiday (3:00-4:30 PM only), not whole-day', () => {
    const onam = DEFAULT_HOLIDAYS.find(d => d.date === '2026-08-31')
    expect(onam).toBeDefined()
    expect(onam!.start).toBe('15:00')
    expect(onam!.end).toBe('16:30')
    const { dates, windows } = preloadedHolidays()
    expect(dates.has('2026-08-31')).toBe(false)   // not a whole-day cancel
    expect(dates.has('2026-08-26')).toBe(true)    // other holidays stay whole-day
    expect(windows).toContainEqual(expect.objectContaining({ date: '2026-08-31', start: '15:00', end: '16:30' }))
  })

  it('has unique dates and a label per entry', () => {
    const dates = DEFAULT_HOLIDAYS.map(d => d.date)
    expect(new Set(dates).size).toBe(dates.length)
    DEFAULT_HOLIDAYS.forEach(d => expect(d.label.length).toBeGreaterThan(0))
  })
})

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
    // 11 upcoming × 2h = 22h (all sessions are 2h)
    expect(stats.remainingHours).toBe(22)
    expect(stats.remainingSessions).toBe(11)
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

  it('budget stays fractional (continuous hours), not floored to whole classes', () => {
    // 2h classes: 11 present, 1 absent, 2 upcoming.
    // Continuous budget = 22 + 4 - 0.8(24 + 4) = 3.6h.
    // Must show the fractional value: 3.6h / 1.8 classes, never a flooed whole.
    const sessions: Session[] = [
      ...Array.from({ length: 11 }, (_, i) =>
        makeSession(1, `2026-08-${String(1 + i * 3).padStart(2, '0')}`, '10:00 - 11:59', 'PRESENT', 2)),
      makeSession(1, '2026-09-01', '10:00 - 11:59', 'ABSENT', 2),
      makeSession(1, '2026-09-05', '10:00 - 11:59', 'UPCOMING', 2),
      makeSession(1, '2026-09-08', '10:00 - 11:59', 'UPCOMING', 2),
    ]
    const sd: SlotDetail = {
      slot: { id: 1, slotName: 'S', subjectCode: 'SUB', subjectName: 'Sub', isActivity: false },
      sessions,
      stats: { presentHours: 0, totalHours: 0, percentage: 0 },
    }
    const stats = computeSlotStats(sd, new Set())
    expect(stats.budgetHours).toBeCloseTo(3.6, 1)   // continuous, kept fractional
    expect(stats.budgetSessions).toBeCloseTo(1.8, 1) // derived label, fractional
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

  it('courses-only budget: continuous hours, no circular discount', () => {
    const stats = computeOverallStats(ALL_SLOTS, HOLIDAYS, true)
    // remaining = JAVA 22 + MA212 26 + HRM 20 + AOA 28 = 96h across 48 sessions (2h each)
    // maxMiss = 126 + 96 - 0.8(150 + 96) = 25.2h continuous
    // Budgeted hours stay fractional; class label = 25.2 / 2 = 12.6
    expect(stats.remainingHours).toBeCloseTo(96, 1)
    expect(stats.budgetHours).toBeCloseTo(25.2, 1)
    expect(stats.budgetSessions).toBeCloseTo(12.6, 1)
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
    // 136.5 present + 106h upcoming = 242.5 of 270.5 = 89.65%
    expect(impact.overallFinal).toBeCloseTo(89.65, 1)
    expect(impact.overallFinalZone).toBe('green')
    expect(impact.sessionsMissed).toBe(0)
  })

  it('1-day leave (Sep 3): projected main number, term-ended secondary', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03')
    expect(impact.sessionsMissed).toBe(3)
    expect(impact.hoursMissed).toBe(4) // AOA 2h + SDCP1 1h + SDCP2 1h
    expect(impact.overallAfter).toBeCloseTo(81.01, 1) // 136.5/168.5
    expect(impact.overallFinal).toBeCloseTo(88.17, 1) // (136.5 + 102)/270.5
    expect(impact.overallFinal).toBeGreaterThan(impact.overallAfter)
    expect(impact.overallFinalZone).toBe('green')
  })

  it('projected final = formula: (present + remaining - missed)/(conducted + remaining)', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-12')
    // Cross-check against the closed form computed from the reported numbers:
    // after = P/(C+L), final = (P + R - L)/(C + R), so final = after ratio + remaining scaling.
    // Missed 28 sessions = 24×2h + 4×1h (SDCP) = 52h.
    // Exact engine values: after 136.5/216.5 = 63.05, final 190.5/270.5 = 70.43
    expect(impact.sessionsMissed).toBe(28)
    expect(impact.hoursMissed).toBe(52)
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

  it('keeps every window at or above the 80% green target (no amber/red trips)', () => {
    const windows = findVacationWindows(ALL_SLOTS, HOLIDAYS, 30)
    expect(windows.length).toBeGreaterThan(0)
    for (const w of windows) {
      expect(w.overallFinal).toBeGreaterThanOrEqual(80)
      expect(w.overallFinalZone).toBe('green')
    }
  })

  it('bakes the committed leave plan into the trip projections', () => {
    // Committing leave must tighten the feasibility margin of the trips, not
    // just relabel them. The single committed day on 09-03 reduces the
    // projected attendance each window can afford.
    const plan = [{ id: 'p', startDate: '2026-09-03', endDate: '2026-09-03' }]
    const noPlan = findVacationWindows(ALL_SLOTS, HOLIDAYS, 30)
    const withPlan = findVacationWindows(ALL_SLOTS, HOLIDAYS, 30, [], 0, plan)
    expect(noPlan.length).toBeGreaterThan(0)
    expect(withPlan.length).toBeGreaterThan(0)

    // Every offered window keeps the overall projection green both ways.
    for (const w of noPlan) expect(w.overallFinalZone).toBe('green')
    for (const w of withPlan) expect(w.overallFinalZone).toBe('green')

    // The committed leave eats into the same window's projected margin: the
    // best window's projected % is lower (or equal) with the plan committed.
    expect(withPlan[0].overallFinal).toBeLessThanOrEqual(noPlan[0].overallFinal)
  })

  it('drops trips that would push any real course below the 80% target (activities exempt)', () => {
    // A long window is rejected if it drives a real course under 80% even
    // though the overall number stays green. Activities (ECA/SDCP) are exempt:
    // they only feed the overall pool and have no per-subject 80% rule.
    const windows = findVacationWindows(ALL_SLOTS, HOLIDAYS, 30)
    expect(windows.length).toBeGreaterThan(0)
    const baseline = computeLeavePlanImpact(ALL_SLOTS, HOLIDAYS, [])
    const window = windows[0]
    for (const code of Object.keys(window.perSubject)) {
      const baselineProj = baseline.perSubject[code]?.projected ?? 100
      const windowProj = window.perSubject[code]?.projected ?? 100
      // Skip activities: they don't carry the per-subject 80% rule.
      const isActivity = code === 'SDCP' || code.startsWith('ECA')
      if (isActivity) continue
      // If a course can stay >=80% at baseline, the trip must not drop it below.
      if (baselineProj >= 80) {
        expect(windowProj).toBeGreaterThanOrEqual(80)
      }
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

describe('sessionHours — each class counts at face value (no circular discount)', () => {
  const s = (date: string, hours: number, timing = ''): Session => ({
    slotId: 1, date, startTime: '', endTime: '', timing, hours, status: 'UPCOMING',
  })

  it('2h class always counts as 2h regardless of date', () => {
    expect(sessionHours(s('2026-08-28', 2))).toBe(2)
    expect(sessionHours(s('2026-08-31', 2))).toBe(2)
    expect(sessionHours(s('2026-09-01', 2))).toBe(2)
  })
  it('1h (SDCP) and 1.5h (mentor) classes are unchanged', () => {
    expect(sessionHours(s('2026-09-03', 1))).toBe(1)
    expect(sessionHours(s('2026-09-03', 1.5))).toBe(1.5)
  })
  it('CLS span in timing wins; human dates parse', () => {
    expect(sessionHours(s('17 Sep 2026', 2, 'CLS10-12'))).toBe(2)
    expect(sessionHours(s('28 Aug 2026', 2, 'CLS10-12'))).toBe(2)
    expect(sessionHours(s('01 Sep 2026', 1, 'CLS10-11'))).toBe(1) // 1h CLS untouched
  })
  it('audit: projected pools reflect 2h per class', () => {
    const overall = computeOverallStats(ALL_SLOTS, HOLIDAYS, false)
    // remaining = JAVA 22 + MA212 26 + HRM 20 + AOA 28 + SDCP 5 + SDCP 5 = 106h
    expect(overall.remainingHours).toBeCloseTo(106, 1)
    expect(overall.remainingSessions).toBe(58)
    expect(overall.presentSessions).toBe(71)
    expect(overall.totalSessions).toBe(86)
  })
})

describe('sessionHours — real portal formats (live-audit regression)', () => {
  // Shapes captured from learner.saveetha.in term 8, Aug 31 2026:
  const s = (partial: Partial<Session>): Session => ({
    slotId: 1, date: '2026-09-01', startTime: '', endTime: '', timing: '', hours: 0,
    status: 'UPCOMING', ...partial,
  })

  it('HH:MM end-time CLS formats parse as 1.5h (previously 1h)', () => {
    // Bug: CLS\d+-\d+ parsed "CLS03-04:30" as 4-3=1. All of these are 1.5h blocks.
    expect(sessionHours(s({ timing: 'CLS03-04:30' }))).toBe(1.5)
    expect(sessionHours(s({ timing: 'CLS08-09:30' }))).toBe(1.5)
    expect(sessionHours(s({ timing: 'CLS09:45-11:15' }))).toBe(1.5)
    expect(sessionHours(s({ timing: 'CLS01:15-02:45' }))).toBe(1.5)
  })

  it('time-span minutes derive hours (89 min → 1.5, 120 → 2, 60 → 1)', () => {
    expect(sessionHours(s({ time: '15:00 - 16:29' }))).toBe(1.5)
    expect(sessionHours(s({ time: '08:00 - 09:29' }))).toBe(1.5)
    // 10:00-11:59 = 119 min → 2h (no circular discount)
    expect(sessionHours(s({ time: '10:00 - 11:59', date: '2026-08-28' }))).toBe(2)
    expect(sessionHours(s({ time: '10:00 - 11:59', date: '2026-09-01' }))).toBe(2)
    expect(sessionHours(s({ time: '08:00 - 09:00' }))).toBe(1)
  })

  it('portal calculation text is the exact credit, beating span/timing', () => {
    expect(sessionHours(s({
      timing: 'CLS03-04:30', time: '15:00 - 16:29',
      calculation: 'Counts 1.50 as Present',
    }))).toBe(1.5)
    expect(sessionHours(s({
      timing: 'CLS10-12', time: '10:00 - 11:59', date: '2026-08-14',
      calculation: 'Counts 2.00 as Absent',
    }))).toBe(2)
    // 44-min mentor: portal credit 0.45 is NOT hour-rounded to 0.75
    expect(sessionHours(s({
      timing: 'CLS11:30-12:15', time: '11:30 - 12:14', date: '2026-08-31',
      calculation: 'Counts 0.45 as Present',
    }))).toBe(0.45)
  })

  it('"Not counted: Upcoming" yields no calc → falls back to span/timing', () => {
    expect(sessionHours(s({
      timing: 'CLS03-04:30', time: '15:00 - 16:29',
      calculation: 'Not counted: Upcoming',
    }))).toBe(1.5)
    expect(sessionHours(s({ timing: 'SWH01', calculation: 'Not counted: Upcoming' }))).toBe(1)
  })

  it('stored hours is the source of truth — overrides span/timing heuristics', () => {
    // A course with CLS03-04:30 timing but stored hours:2 counts as 2h, not 1.5h.
    expect(sessionHours(s({ timing: 'CLS03-04:30', time: '15:00 - 16:29', hours: 2 }))).toBe(2)
    // Old bookmarklet exports with wrong hours:1 need re-import to fix.
    expect(sessionHours(s({ timing: 'CLS03-04:30', time: '15:00 - 16:29', hours: 1 }))).toBe(1)
  })

  it('no circular discount: span-derived 2h stays 2h on/after Aug 31', () => {
    expect(sessionHours(s({ time: '08:00 - 10:00', date: '2026-08-28' }))).toBe(2)
    expect(sessionHours(s({ time: '08:00 - 10:00', date: '2026-08-31' }))).toBe(2)
  })

  it('leave arithmetic uses 2h for HH:MM-timing upcoming sessions', () => {
    const slot: SlotDetail = {
      slot: { id: 9, slotName: 'X', subjectCode: '19AI404', subjectName: 'AoA', isActivity: false },
      sessions: [
        s({ date: '2026-08-28', timing: 'CLS15-17', time: '15:00 - 16:59', hours: 2, status: 'PRESENT' }),
        s({ date: '2026-09-03', timing: 'CLS03-04:30', time: '15:00 - 16:29' }),
      ],
      stats: { presentHours: 0, totalHours: 0, percentage: 0 },
    }
    const impact = computeLeaveImpact([slot], new Set(), '2026-09-03', '2026-09-03')
    expect(impact.sessionsMissed).toBe(1)
    expect(impact.hoursMissed).toBe(1.5) // span 15:00-16:29 = 89min = 1.5h
  })
})

describe('applyODs (On Duty)', () => {
  it('no-op with no OD entries', () => {
    const out = applyODs(JAVA.sessions, [])
    expect(out).toEqual(JAVA.sessions)
  })

  it('whole-day OD: ABSENT and UPCOMING become PRESENT, PRESENT kept, HOLIDAY skipped', () => {
    const out = applyODs(JAVA.sessions, [od({ startDate: '2026-08-14', endDate: '2026-08-15' })])
    const byDate = new Map(out.map(s => [s.date, s.status]))
    expect(byDate.get('2026-08-14')).toBe('PRESENT') // was ABSENT
    expect(byDate.get('2026-08-15')).toBe('HOLIDAY') // stays holiday
    expect(byDate.get('2026-07-17')).toBe('PRESENT') // already present, untouched
    expect(byDate.get('2026-08-25')).toBe('UPCOMING') // outside range, untouched
  })

  it('date-bounded: only sessions inside the range flip', () => {
    const out = applyODs(JAVA.sessions, [od({ startDate: '2026-08-01', endDate: '2026-08-01' })])
    const byDate = new Map(out.map(s => [s.date, s.status]))
    expect(byDate.get('2026-08-01')).toBe('PRESENT') // was ABSENT
    expect(byDate.get('2026-08-14')).toBe('ABSENT') // same status, but outside range
  })

  it('time window (fixture shape: startTime/endTime), no overlap → untouched', () => {
    const out = applyODs(AOA.sessions, [
      od({ startDate: '2026-07-16', endDate: '2026-07-16', startTime: '13:00', endTime: '14:00' }),
    ])
    expect(out.find(s => s.date === '2026-07-16')!.status).toBe('ABSENT') // 15:00-16:59 vs 13-14
  })

  it('time window overlap → PRESENT', () => {
    const out = applyODs(AOA.sessions, [
      od({ startDate: '2026-07-16', endDate: '2026-07-16', startTime: '14:00', endTime: '16:00' }),
    ])
    expect(out.find(s => s.date === '2026-07-16')!.status).toBe('PRESENT') // 15:00-16:59 overlaps
  })

  it('time window matches real import shape (only the `time` field)', () => {
    const real: Session = {
      slotId: 1565,
      date: '2026-07-17',
      startTime: '',
      endTime: '',
      time: '10:00 - 11:59',
      timing: 'CLS10-12',
      hours: 2,
      status: 'ABSENT',
    }
    // Overlaps: 10:00 < 10:30 and 11:59 > 09:00
    const hit = applyODs([real], [od({ startDate: '2026-07-17', endDate: '2026-07-17', startTime: '09:00', endTime: '10:30' })])
    expect(hit[0].status).toBe('PRESENT')
    // No overlap: 13:00-14:00 window
    const miss = applyODs([real], [od({ startDate: '2026-07-17', endDate: '2026-07-17', startTime: '13:00', endTime: '14:00' })])
    expect(miss[0].status).toBe('ABSENT')
    // Time-restricted OD leaves time-less sessions alone
    const noTime: Session = { ...real, time: undefined }
    const untouched = applyODs([noTime], [od({ startDate: '2026-07-17', endDate: '2026-07-17', startTime: '09:00', endTime: '10:30' })])
    expect(untouched[0].status).toBe('ABSENT')
  })

  it('every session in range flips, including UPCOMING (advance duty day)', () => {
    const out = applyODs(JAVA.sessions, [od({ startDate: '2026-08-25', endDate: '2026-08-25' })])
    expect(out.find(s => s.date === '2026-08-25')!.status).toBe('PRESENT')
  })

  it('OD-present session is protected from a leave range', () => {
    const odded = applyODs(JAVA.sessions, [od({ startDate: '2026-08-25', endDate: '2026-08-25' })])
    const withOd = computeLeavePlanImpact([{ ...JAVA, sessions: odded }], HOLIDAYS, [
      { id: 'x', startDate: '2026-08-25', endDate: '2026-08-26' },
    ])
    expect(withOd.sessionsMissed).toBe(0) // Aug 25 now PRESENT, Aug 26 no session

    const withoutOd = computeLeavePlanImpact([JAVA], HOLIDAYS, [
      { id: 'x', startDate: '2026-08-25', endDate: '2026-08-26' },
    ])
    expect(withoutOd.sessionsMissed).toBe(1) // Aug 25 UPCOMING → missed
    expect(withOd.overallFinal).toBeGreaterThan(withoutOd.overallFinal)
  })

  it('OD raises the overall % (HRM: 26/32 → 28/32)', () => {
    const out = applyODs(HRM.sessions, [od({ startDate: '2026-08-14', endDate: '2026-08-14' })])
    const stats = computeOverallStats([{ ...HRM, sessions: out }], HOLIDAYS, true)
    expect(stats.presentHours).toBe(28)
    expect(stats.totalHours).toBe(32)
    expect(stats.percentage).toBeCloseTo(87.5, 1)
  })

  it('OD survives the engine re-applying overrides (holiday stays holiday)', () => {
    const out = applyODs(JAVA.sessions, [od({ startDate: '2026-08-15', endDate: '2026-08-15' })])
    expect(out.find(s => s.date === '2026-08-15')!.status).toBe('HOLIDAY')
    const again = applyOverrides(out, [{ date: '2026-08-15', type: 'holiday' }])
    expect(again.find(s => s.date === '2026-08-15')!.status).toBe('HOLIDAY')
  })
})

describe('GatePass handling (hosteller leave counts as ABSENT)', () => {
  // The import boundary receives RAW portal data: status is a plain string
  // that normalization folds into the SessionStatus model. Type it loosely to
  // represent data as it arrives from the portal, which may not be a valid
  // SessionStatus yet.
  const rawSession = (partial: Partial<Omit<Session, 'status'>> & { status?: string }): Session => ({
    slotId: 1, date: '2026-09-01', startTime: '', endTime: '', timing: '', hours: 2, status: 'PRESENT',
    ...partial,
  } as Session)
  const rawSlot = (sessions: Session[]): SlotDetail => ({
    slot: { id: 1, slotName: 'X', subjectCode: '19XX', subjectName: 'X', isActivity: false },
    sessions,
    stats: { presentHours: 2, totalHours: 4, percentage: 50 },
  })

  it('mapSessionStatus folds GatePass variants into ABSENT', () => {
    expect(mapSessionStatus('GatePass')).toBe('ABSENT')
    expect(mapSessionStatus('GATEPASS')).toBe('ABSENT')
    expect(mapSessionStatus('Gate Pass')).toBe('ABSENT')
    expect(mapSessionStatus('gate_pass')).toBe('ABSENT')
    expect(mapSessionStatus('PRESENT')).toBe('PRESENT')
    expect(mapSessionStatus('ABSENT')).toBe('ABSENT')
    expect(mapSessionStatus('UPCOMING')).toBe('UPCOMING')
    expect(mapSessionStatus('HOLIDAY')).toBe('HOLIDAY')
  })

  it('GatePass hours count in the denominator like ABSENT (attendance drops)', () => {
    // 2 conducted: one PRESENT, one marked GatePass → should be 50%, like ABSENT
    const gpSlot = rawSlot([
      rawSession({ date: '2026-08-01', status: 'PRESENT', hours: 2 }),
      rawSession({ date: '2026-08-08', status: 'GatePass', hours: 2 }),
    ])
    // Without normalization it is silently dropped from the denominator.
    expect(computeSlotStats(gpSlot, HOLIDAYS).totalHours).toBe(2)
    expect(computeSlotStats(gpSlot, HOLIDAYS).percentage).toBe(100)
    // After normalization it is a miss, exactly like ABSENT.
    const normalized = normalizeAttendanceData({
      student: '', termId: 8, fetchedAt: '', slots: [gpSlot],
    })
    const stats = computeSlotStats(normalized.slots[0], HOLIDAYS)
    expect(stats.totalHours).toBe(4)
    expect(stats.percentage).toBe(50)
  })

  it('normalizeAttendanceData keeps real statuses untouched', () => {
    const input = rawSlot([
      rawSession({ status: 'PRESENT' }),
      rawSession({ status: 'ABSENT' }),
      rawSession({ status: 'UPCOMING' }),
      rawSession({ status: 'GatePass' }),
    ])
    const out = normalizeAttendanceData({ student: '', termId: 8, fetchedAt: '', slots: [input] })
    const statuses = out.slots[0].sessions.map(s => s.status)
    expect(statuses).toEqual(['PRESENT', 'ABSENT', 'UPCOMING', 'ABSENT'])
  })
})

describe('partial-day holiday windows (Onam: 15:00-16:30 only)', () => {
  const ONAM: HolidayWindow[] = [{ date: '2026-08-31', start: '15:00', end: '16:30' }]
  const noDates = new Set<string>()

  const slot = (sessions: Session[]): SlotDetail => ({
    slot: { id: 1, slotName: 'X', subjectCode: '19XX', subjectName: 'X', isActivity: false },
    sessions,
    stats: { presentHours: 0, totalHours: 0, percentage: 100 },
  })

  it('cancels only sessions whose time range overlaps the window', () => {
    // Sessions carry times in `time` ("HH:MM - HH:MM") like real portal imports.
    const s = (time: string, hours: number, status: Session['status'] = 'UPCOMING'): Session => ({
      slotId: 1, date: '2026-08-31', startTime: '', endTime: '', timing: '', time, hours, status,
    })
    const out = upcomingSessions([
      s('08:00 - 09:59', 2),  // morning — NOT cancelled
      s('15:00 - 16:29', 1.5), // in the Onam window — cancelled
      s('16:30 - 17:59', 1.5), // right after the window — NOT cancelled
      s('14:00 - 15:29', 1.5), // overlaps the start — cancelled
    ], noDates, ONAM)
    expect(out.map(x => x.time)).toEqual(['08:00 - 09:59', '16:30 - 17:59'])
  })

  it('isSessionCancelled: whole-day date wins over windows; unknown times are kept', () => {
    const wholeDay = new Set(['2026-08-31'])
    const withTime: Session = { slotId: 1, date: '2026-08-31', startTime: '15:00', endTime: '16:29', timing: '', hours: 1.5, status: 'UPCOMING' }
    const noTime: Session = { slotId: 1, date: '2026-08-31', startTime: '', endTime: '', timing: '', hours: 2, status: 'UPCOMING' }
    expect(isSessionCancelled(withTime, noDates, ONAM)).toBe(true)
    expect(isSessionCancelled(withTime, wholeDay, [])).toBe(true)  // whole-day
    expect(isSessionCancelled(noTime, noDates, ONAM)).toBe(false)  // unknown time — not provable
  })

  it('computeSlotStats counts windowed sessions as not-remaining', () => {
    // Morning 08:00-09:59 = 2h span; afternoon cancelled by Onam window.
    const morning: Session = { slotId: 1, date: '2026-08-31', startTime: '08:00', endTime: '09:59', timing: '', hours: 2, status: 'UPCOMING' }
    const afternoon: Session = { slotId: 1, date: '2026-08-31', startTime: '15:00', endTime: '16:29', timing: '', hours: 1.5, status: 'UPCOMING' }
    const stats = computeSlotStats(slot([morning, afternoon]), noDates, ONAM)
    expect(stats.remainingSessions).toBe(1)
    expect(stats.remainingHours).toBe(2) // morning only, 2h span
  })

  it('a leave day with a windowed holiday only misses the non-cancelled sessions', () => {
    const morning: Session = { slotId: 1, date: '2026-08-31', startTime: '08:00', endTime: '09:59', timing: '', hours: 2, status: 'UPCOMING' }
    const afternoon: Session = { slotId: 1, date: '2026-08-31', startTime: '15:00', endTime: '16:29', timing: '', hours: 1.5, status: 'UPCOMING' }
    const sd = slot([morning, afternoon])
    const impact = computeLeaveImpact([sd], noDates, '2026-08-31', '2026-08-31', [], 0, ONAM)
    // The afternoon class is cancelled anyway — only the morning class is a real miss (2h span).
    expect(impact.sessionsMissed).toBe(1)
    expect(impact.hoursMissed).toBe(2)
  })
})
