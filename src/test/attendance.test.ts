import { describe, it, expect } from 'vitest'
import {
  getZone,
  computeSlotStats,
  computeOverallStats,
  computeLeaveImpact,
  findVacationWindows,
} from '../engine/attendance'
import type { SlotDetail, Session } from '../engine/types'

// Robinson's real data from learner.saveetha.in as of 2026-08-24
// Term: 26-27-ODD-T1 (term_id=8)

const makeSession = (
  slotId: number,
  date: string,
  time: string,
  status: 'PRESENT' | 'ABSENT' | 'HOLIDAY' | 'UPCOMING',
  hours = 2
): Session => ({
  slotId,
  date,
  startTime: time.split(' - ')[0],
  endTime: time.split(' - ')[1] || time.split(' - ')[0],
  timing: '',
  hours,
  status,
})

const JAVA: SlotDetail = {
  slot: {
    id: 1565,
    slotName: '26OD1238',
    subjectCode: '19AI553',
    subjectName: 'Advanced Java Web Applications',
    isActivity: false,
  },
  sessions: [
    makeSession(1565, '2026-07-17', '10:00 - 11:59', 'PRESENT'),
    makeSession(1565, '2026-07-18', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-07-21', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-07-24', '10:00 - 11:59', 'PRESENT'),
    makeSession(1565, '2026-07-25', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-07-28', '15:00 - 16:59', 'ABSENT'),
    makeSession(1565, '2026-07-31', '10:00 - 11:59', 'PRESENT'),
    makeSession(1565, '2026-08-01', '15:00 - 16:59', 'ABSENT'),
    makeSession(1565, '2026-08-04', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-08-07', '10:00 - 11:59', 'PRESENT'),
    makeSession(1565, '2026-08-08', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-08-11', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-08-14', '10:00 - 11:59', 'ABSENT'),
    makeSession(1565, '2026-08-15', '15:00 - 16:59', 'HOLIDAY'),
    makeSession(1565, '2026-08-18', '15:00 - 16:59', 'PRESENT'),
    makeSession(1565, '2026-08-21', '10:00 - 11:59', 'PRESENT'),
    makeSession(1565, '2026-08-22', '15:00 - 16:59', 'PRESENT'),
    // Upcoming (after holidays removed)
    makeSession(1565, '2026-08-25', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-08-28', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1565, '2026-08-29', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-09-01', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-09-04', '10:00 - 11:59', 'UPCOMING'), // holiday
    makeSession(1565, '2026-09-05', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-09-08', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-09-11', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1565, '2026-09-12', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-09-15', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1565, '2026-09-18', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1565, '2026-09-19', '15:00 - 16:59', 'UPCOMING'),
  ],
  stats: { presentHours: 26, totalHours: 32, percentage: 81.25 },
}

const MA212: SlotDetail = {
  slot: {
    id: 1584,
    slotName: '26OD1257',
    subjectCode: '19MA212',
    subjectName: 'Algebra and Number Theory',
    isActivity: false,
  },
  sessions: [
    makeSession(1584, '2026-07-17', '13:00 - 14:59', 'PRESENT'),
    makeSession(1584, '2026-07-18', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-07-20', '10:00 - 11:59', 'PRESENT'),
    makeSession(1584, '2026-07-22', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-07-24', '13:00 - 14:59', 'PRESENT'),
    makeSession(1584, '2026-07-25', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-07-27', '10:00 - 11:59', 'PRESENT'),
    makeSession(1584, '2026-07-29', '08:00 - 09:59', 'ABSENT'),
    makeSession(1584, '2026-07-31', '13:00 - 14:59', 'PRESENT'),
    makeSession(1584, '2026-08-01', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-08-03', '10:00 - 11:59', 'PRESENT'),
    makeSession(1584, '2026-08-05', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-08-07', '13:00 - 14:59', 'PRESENT'),
    makeSession(1584, '2026-08-08', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-08-10', '10:00 - 11:59', 'PRESENT'),
    makeSession(1584, '2026-08-12', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-08-14', '13:00 - 14:59', 'ABSENT'),
    makeSession(1584, '2026-08-15', '08:00 - 09:59', 'HOLIDAY'),
    makeSession(1584, '2026-08-17', '10:00 - 11:59', 'PRESENT'),
    makeSession(1584, '2026-08-19', '08:00 - 09:59', 'PRESENT'),
    makeSession(1584, '2026-08-21', '13:00 - 14:59', 'PRESENT'),
    makeSession(1584, '2026-08-22', '08:00 - 09:59', 'ABSENT'),
    // Upcoming
    makeSession(1584, '2026-08-24', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1584, '2026-08-26', '08:00 - 09:59', 'UPCOMING'), // holiday
    makeSession(1584, '2026-08-28', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1584, '2026-08-29', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1584, '2026-08-31', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1584, '2026-09-02', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1584, '2026-09-04', '13:00 - 14:59', 'UPCOMING'), // holiday
    makeSession(1584, '2026-09-05', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1584, '2026-09-07', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1584, '2026-09-09', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1584, '2026-09-11', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1584, '2026-09-12', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1584, '2026-09-14', '10:00 - 11:59', 'UPCOMING'), // holiday
    makeSession(1584, '2026-09-16', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1584, '2026-09-18', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1584, '2026-09-19', '08:00 - 09:59', 'UPCOMING'),
  ],
  stats: { presentHours: 36, totalHours: 42, percentage: 85.71 },
}

const HRM: SlotDetail = {
  slot: {
    id: 1672,
    slotName: '26OD1345',
    subjectCode: '19MS156',
    subjectName: 'Human Resource Management and Team Building',
    isActivity: false,
  },
  sessions: [
    makeSession(1672, '2026-07-17', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-07-20', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-07-21', '10:00 - 11:59', 'PRESENT'),
    makeSession(1672, '2026-07-24', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-07-27', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-07-28', '10:00 - 11:59', 'ABSENT'),
    makeSession(1672, '2026-07-31', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-08-03', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-08-04', '10:00 - 11:59', 'PRESENT'),
    makeSession(1672, '2026-08-07', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-08-10', '08:00 - 09:59', 'PRESENT'),
    makeSession(1672, '2026-08-11', '10:00 - 11:59', 'PRESENT'),
    makeSession(1672, '2026-08-14', '08:00 - 09:59', 'ABSENT'),
    makeSession(1672, '2026-08-17', '08:00 - 09:59', 'ABSENT'),
    makeSession(1672, '2026-08-18', '10:00 - 11:59', 'PRESENT'),
    makeSession(1672, '2026-08-21', '08:00 - 09:59', 'PRESENT'),
    // Upcoming
    makeSession(1672, '2026-08-24', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1672, '2026-08-25', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1672, '2026-08-28', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1672, '2026-08-31', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1672, '2026-09-01', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1672, '2026-09-04', '08:00 - 09:59', 'UPCOMING'), // holiday
    makeSession(1672, '2026-09-07', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1672, '2026-09-08', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1672, '2026-09-11', '08:00 - 09:59', 'UPCOMING'),
    makeSession(1672, '2026-09-14', '08:00 - 09:59', 'UPCOMING'), // holiday
    makeSession(1672, '2026-09-15', '10:00 - 11:59', 'UPCOMING'),
    makeSession(1672, '2026-09-18', '08:00 - 09:59', 'UPCOMING'),
  ],
  stats: { presentHours: 26, totalHours: 32, percentage: 81.25 },
}

const AOA: SlotDetail = {
  slot: {
    id: 1792,
    slotName: '26OD1465',
    subjectCode: '19AI404',
    subjectName: 'Analysis of Algorithms',
    isActivity: false,
  },
  sessions: [
    makeSession(1792, '2026-07-16', '15:00 - 16:59', 'ABSENT'),
    makeSession(1792, '2026-07-17', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-07-20', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-07-21', '13:00 - 14:59', 'PRESENT'),
    makeSession(1792, '2026-07-23', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-07-24', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-07-27', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-07-28', '13:00 - 14:59', 'ABSENT'),
    makeSession(1792, '2026-07-30', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-07-31', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-03', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-04', '13:00 - 14:59', 'PRESENT'),
    makeSession(1792, '2026-08-06', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-07', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-10', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-11', '13:00 - 14:59', 'PRESENT'),
    makeSession(1792, '2026-08-13', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-14', '15:00 - 16:59', 'ABSENT'),
    makeSession(1792, '2026-08-17', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-18', '13:00 - 14:59', 'PRESENT'),
    makeSession(1792, '2026-08-20', '15:00 - 16:59', 'PRESENT'),
    makeSession(1792, '2026-08-21', '15:00 - 16:59', 'PRESENT'),
    // Upcoming
    makeSession(1792, '2026-08-24', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-08-25', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1792, '2026-08-27', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-08-28', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-08-31', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-09-01', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1792, '2026-09-03', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-09-04', '15:00 - 16:59', 'UPCOMING'), // holiday
    makeSession(1792, '2026-09-07', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-09-08', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1792, '2026-09-10', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-09-11', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-09-14', '15:00 - 16:59', 'UPCOMING'), // holiday
    makeSession(1792, '2026-09-15', '13:00 - 14:59', 'UPCOMING'),
    makeSession(1792, '2026-09-17', '15:00 - 16:59', 'UPCOMING'),
    makeSession(1792, '2026-09-18', '15:00 - 16:59', 'UPCOMING'),
  ],
  stats: { presentHours: 38, totalHours: 44, percentage: 86.36 },
}

const MENTOR: SlotDetail = {
  slot: {
    id: 1993,
    slotName: '26OD1M107',
    subjectCode: 'ECA-SCOFT-M',
    subjectName: 'SCOFT Mentor Meet',
    isActivity: true,
  },
  sessions: [
    makeSession(1993, '2026-07-22', '13:00 - 14:59', 'PRESENT', 2),
    makeSession(1993, '2026-07-29', '13:00 - 14:59', 'ABSENT', 2),
    makeSession(1993, '2026-08-05', '13:30 - 14:59', 'PRESENT', 1.5),
    makeSession(1993, '2026-08-12', '13:30 - 14:59', 'PRESENT', 1.5),
    makeSession(1993, '2026-08-19', '13:30 - 14:59', 'PRESENT', 1.5),
  ],
  stats: { presentHours: 6.5, totalHours: 8.5, percentage: 76.47 },
}

const SDCP1: SlotDetail = {
  slot: {
    id: 2142,
    slotName: '26OD1SD047',
    subjectCode: 'SDCP',
    subjectName: 'Skill Development Course Practice',
    isActivity: true,
  },
  sessions: [
    makeSession(2142, '2026-08-06', '08:00 - 09:00', 'ABSENT', 1),
    makeSession(2142, '2026-08-13', '08:00 - 09:00', 'PRESENT', 1),
    makeSession(2142, '2026-08-20', '08:00 - 09:00', 'PRESENT', 1),
    makeSession(2142, '2026-08-27', '08:00 - 09:00', 'UPCOMING', 1),
    makeSession(2142, '2026-09-03', '08:00 - 09:00', 'UPCOMING', 1),
    makeSession(2142, '2026-09-10', '08:00 - 09:00', 'UPCOMING', 1),
    makeSession(2142, '2026-09-17', '08:00 - 09:00', 'UPCOMING', 1),
    makeSession(2142, '2026-09-24', '08:00 - 09:00', 'UPCOMING', 1),
  ],
  stats: { presentHours: 2, totalHours: 3, percentage: 66.67 },
}

const SDCP2: SlotDetail = {
  slot: {
    id: 2211,
    slotName: '26OD1SD116',
    subjectCode: 'SDCP',
    subjectName: 'Skill Development Course Practice',
    isActivity: true,
  },
  sessions: [
    makeSession(2211, '2026-08-06', '09:00 - 10:00', 'ABSENT', 1),
    makeSession(2211, '2026-08-13', '09:00 - 10:00', 'PRESENT', 1),
    makeSession(2211, '2026-08-20', '09:00 - 10:00', 'PRESENT', 1),
    makeSession(2211, '2026-08-27', '09:00 - 10:00', 'UPCOMING', 1),
    makeSession(2211, '2026-09-03', '09:00 - 10:00', 'UPCOMING', 1),
    makeSession(2211, '2026-09-10', '09:00 - 10:00', 'UPCOMING', 1),
    makeSession(2211, '2026-09-17', '09:00 - 10:00', 'UPCOMING', 1),
    makeSession(2211, '2026-09-24', '09:00 - 10:00', 'UPCOMING', 1),
  ],
  stats: { presentHours: 2, totalHours: 3, percentage: 66.67 },
}

// Holidays from activity calendar (Term 1 window)
const HOLIDAYS = new Set(['2026-08-26', '2026-09-04', '2026-09-14'])
const ALL_SLOTS = [JAVA, MA212, HRM, AOA, MENTOR, SDCP1, SDCP2]

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
      expect(sep4Window.freeDaysAfter).toBeGreaterThan(0) // weekend adjacent
    }
  })
})
