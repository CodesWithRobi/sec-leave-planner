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
} from '../engine/attendance'
import { JAVA, MA212, HRM, AOA, SDCP1, HOLIDAYS, ALL_SLOTS } from './fixtures'
import type { Session, ODEntry } from '../engine/types'

const od = (partial: Partial<ODEntry>): ODEntry => ({
  id: 'od-test',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  ...partial,
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
    // 11 upcoming: 3×2h (Aug 25/28/29) + 8×1.5h (Sep, circular 139) = 18h
    expect(stats.remainingHours).toBe(18)
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

  it('courses-only budget: shrinks with 1.5h classes (circular 139)', () => {
    const stats = computeOverallStats(ALL_SLOTS, HOLIDAYS, true)
    // remaining = JAVA 18 + MA212 21 + HRM 16.5 + AOA 23 = 78.5h
    // maxMiss = 126 + 78.5 - 0.8(150 + 78.5) = 21.7h
    expect(stats.remainingHours).toBeCloseTo(78.5, 1)
    expect(stats.budgetHours).toBeGreaterThan(20.5)
    expect(stats.budgetHours).toBeLessThan(23)
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
    // 136.5 present + 88.5 upcoming (1.5h classes from Aug 31) = 225 of 253 = 88.93%
    expect(impact.overallFinal).toBeCloseTo(88.93, 1)
    expect(impact.overallFinalZone).toBe('green')
    expect(impact.sessionsMissed).toBe(0)
  })

  it('1-day leave (Sep 3): projected main number, term-ended secondary', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-09-03', '2026-09-03')
    expect(impact.sessionsMissed).toBe(3)
    expect(impact.hoursMissed).toBe(3.5) // AOA 1.5h (circular) + SDCP1 1h + SDCP2 1h
    expect(impact.overallAfter).toBeCloseTo(81.25, 1) // 136.5/168
    expect(impact.overallFinal).toBeCloseTo(87.55, 1) // (136.5 + 85)/253
    expect(impact.overallFinal).toBeGreaterThan(impact.overallAfter)
    expect(impact.overallFinalZone).toBe('green')
  })

  it('projected final = formula: (present + remaining - missed)/(conducted + remaining)', () => {
    const impact = computeLeaveImpact(ALL_SLOTS, HOLIDAYS, '2026-08-31', '2026-09-12')
    // Cross-check against the closed form computed from the reported numbers:
    // after = (P)/(C+L), final = (P + R - L)/(C + R), so final = after ratio + remaining scaling.
    // Missed 28 sessions = 24×1.5h (circular 139) + 4×1h (SDCP) = 40h.
    // Exact engine values: after 136.5/204.5 = 66.75, final 185/253 = 73.12
    expect(impact.sessionsMissed).toBe(28)
    expect(impact.hoursMissed).toBe(40)
    expect(impact.overallAfter).toBeCloseTo(66.75, 1)
    expect(impact.overallFinal).toBeCloseTo(73.12, 1)
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

describe('sessionHours (circular 139: every 2h class from 2026-08-31 = 1.5h)', () => {
  const s = (date: string, hours: number, timing = ''): Session => ({
    slotId: 1, date, startTime: '', endTime: '', timing, hours, status: 'UPCOMING',
  })

  it('2h class before the date stays 2h', () => {
    expect(sessionHours(s('2026-08-28', 2))).toBe(2)
  })
  it('2h class on the date becomes 1.5h (boundary: Aug 31 included)', () => {
    expect(sessionHours(s('2026-08-31', 2))).toBe(1.5)
  })
  it('2h class after the date becomes 1.5h', () => {
    expect(sessionHours(s('2026-09-01', 2))).toBe(1.5)
  })
  it('1h (SDCP) and 1.5h (mentor) classes are unchanged', () => {
    expect(sessionHours(s('2026-09-03', 1))).toBe(1)
    expect(sessionHours(s('2026-09-03', 1.5))).toBe(1.5)
  })
  it('CLS span in timing wins; human dates parse', () => {
    expect(sessionHours(s('17 Sep 2026', 2, 'CLS10-12'))).toBe(1.5)
    expect(sessionHours(s('28 Aug 2026', 2, 'CLS10-12'))).toBe(2)
    expect(sessionHours(s('01 Sep 2026', 1, 'CLS10-11'))).toBe(1) // 1h CLS untouched
  })
  it('audit: projected pools reflect the rule', () => {
    const overall = computeOverallStats(ALL_SLOTS, HOLIDAYS, false)
    // remaining = JAVA 18 + MA212 21 + HRM 16.5 + AOA 23 + SDCP 5 + SDCP 5 = 88.5h
    expect(overall.remainingHours).toBeCloseTo(88.5, 1)
    expect(overall.remainingSessions).toBe(58)
    expect(overall.presentSessions).toBe(71)
    expect(overall.totalSessions).toBe(86)
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
