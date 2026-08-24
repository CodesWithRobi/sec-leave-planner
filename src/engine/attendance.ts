import type { Session, SlotDetail, ComputedStats, DateOverride, LeaveImpact, VacationWindow } from './types'

// Zone thresholds
const GREEN_THRESHOLD = 80
const AMBER_THRESHOLD = 75

export function getZone(percentage: number): 'green' | 'amber' | 'red' {
  if (percentage >= GREEN_THRESHOLD) return 'green'
  if (percentage >= AMBER_THRESHOLD) return 'amber'
  return 'red'
}

/** Filter sessions: exclude HOLIDAY and UPCOMING, keep PRESENT/ABSENT */
export function conductedSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
}

/** Filter sessions: only PRESENT */
export function presentSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => s.status === 'PRESENT')
}

/** Filter future sessions (UPCOMING) excluding given holiday dates */
export function upcomingSessions(sessions: Session[], holidays: Set<string>): Session[] {
  return sessions.filter(s => s.status === 'UPCOMING' && !holidays.has(s.date))
}

/** Compute stats for one slot */
export function computeSlotStats(slotDetail: SlotDetail, holidays: Set<string>): ComputedStats {
  const conducted = conductedSessions(slotDetail.sessions)
  const present = presentSessions(slotDetail.sessions)
  const future = upcomingSessions(slotDetail.sessions, holidays)

  const presentHours = present.reduce((sum, s) => sum + s.hours, 0)
  const totalHours = conducted.reduce((sum, s) => sum + s.hours, 0)
  const remainingHours = future.reduce((sum, s) => sum + s.hours, 0)

  const percentage = totalHours > 0 ? (presentHours / totalHours) * 100 : 100

  // Budget: max hours may miss at >=80%
  // presentHours + (remainingHours - miss) >= 0.8 * (totalHours + remainingHours)
  // miss <= presentHours + remainingHours - 0.8 * (totalHours + remainingHours)
  const maxMiss = presentHours + remainingHours - 0.8 * (totalHours + remainingHours)
  const budgetHours = Math.max(0, maxMiss)
  const budgetSessions = Math.floor(budgetHours / 2) // assume 2h per session

  return {
    presentHours,
    totalHours,
    percentage: Math.round(percentage * 100) / 100,
    remainingHours,
    budgetHours: Math.round(budgetHours * 100) / 100,
    budgetSessions,
    zone: getZone(percentage),
  }
}

/** Compute overall stats (pooled hours across all counted slots) */
export function computeOverallStats(
  slotDetails: SlotDetail[],
  holidays: Set<string>,
  excludeActivities: boolean = false
): ComputedStats {
  const filtered = excludeActivities
    ? slotDetails.filter(sd => !sd.slot.isActivity)
    : slotDetails

  let presentHours = 0
  let totalHours = 0
  let remainingHours = 0

  for (const sd of filtered) {
    const conducted = conductedSessions(sd.sessions)
    const present = presentSessions(sd.sessions)
    const future = upcomingSessions(sd.sessions, holidays)

    presentHours += present.reduce((sum, s) => sum + s.hours, 0)
    totalHours += conducted.reduce((sum, s) => sum + s.hours, 0)
    remainingHours += future.reduce((sum, s) => sum + s.hours, 0)
  }

  const percentage = totalHours > 0 ? (presentHours / totalHours) * 100 : 100
  const maxMiss = presentHours + remainingHours - 0.8 * (totalHours + remainingHours)
  const budgetHours = Math.max(0, maxMiss)

  return {
    presentHours,
    totalHours,
    percentage: Math.round(percentage * 100) / 100,
    remainingHours,
    budgetHours: Math.round(budgetHours * 100) / 100,
    budgetSessions: Math.floor(budgetHours / 2),
    zone: getZone(percentage),
  }
}

/** Apply date overrides to sessions (mark holidays/no-class) */
export function applyOverrides(sessions: Session[], overrides: DateOverride[]): Session[] {
  const overrideMap = new Map<string, DateOverride>()
  for (const o of overrides) overrideMap.set(o.date, o)

  return sessions.map(s => {
    const override = overrideMap.get(s.date)
    if (!override) return s

    if (override.type === 'holiday' || override.type === 'no_class') {
      return { ...s, status: 'HOLIDAY' as const }
    }
    if (override.type === 'class_happened') {
      // If class happened despite holiday, mark as ABSENT (student wasn't there)
      if (s.status === 'HOLIDAY') return { ...s, status: 'ABSENT' as const }
    }
    return s
  })
}

/** Compute impact of a leave window on all subjects + overall */
export function computeLeaveImpact(
  slotDetails: SlotDetail[],
  holidays: Set<string>,
  startDate: string,
  endDate: string,
  overrides: DateOverride[] = []
): LeaveImpact {
  // Apply overrides first
  const adjusted = slotDetails.map(sd => ({
    ...sd,
    sessions: applyOverrides(sd.sessions, overrides),
  }))

  // Sessions in the leave window
  const leaveDates = new Set<string>()
  const d = new Date(startDate)
  const end = new Date(endDate)
  while (d <= end) {
    leaveDates.add(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }

  // Compute before stats
  const beforeOverall = computeOverallStats(adjusted, holidays)

  const perSubject: Record<string, { before: number; after: number; zone: import('./types').VerdictZone }> = {}
  let hoursMissed = 0
  let sessionsMissed = 0

  for (const sd of adjusted) {
    const before = computeSlotStats(sd, holidays)

    // Count sessions in leave window
    const missed = sd.sessions.filter(s =>
      leaveDates.has(s.date) &&
      (s.status === 'UPCOMING' || s.status === 'ABSENT' || s.status === 'PRESENT')
    )

    const missedHours = missed.reduce((sum, s) => sum + s.hours, 0)
    hoursMissed += missedHours
    sessionsMissed += missed.length

    // After: those sessions become ABSENT
    const adjustedSessions = sd.sessions.map(s =>
      leaveDates.has(s.date) && (s.status === 'UPCOMING' || s.status === 'PRESENT')
        ? { ...s, status: 'ABSENT' as const }
        : s
    )

    const afterStats = computeSlotStats({ ...sd, sessions: adjustedSessions }, holidays)

    perSubject[sd.slot.subjectCode] = {
      before: before.percentage,
      after: afterStats.percentage,
      zone: afterStats.zone,
    }
  }

  // Overall after
  const adjustedOverall = slotDetails.map(sd => ({
    ...sd,
    sessions: applyOverrides(sd.sessions, overrides).map(s =>
      leaveDates.has(s.date) && (s.status === 'UPCOMING' || s.status === 'PRESENT')
        ? { ...s, status: 'ABSENT' as const }
        : s
    ),
  }))

  const afterOverall = computeOverallStats(adjustedOverall, holidays)

  return {
    startDate,
    endDate,
    daysCount: leaveDates.size,
    sessionsMissed,
    hoursMissed,
    perSubject,
    overallBefore: beforeOverall.percentage,
    overallAfter: afterOverall.percentage,
    overallZone: afterOverall.zone,
  }
}

/** Find ranked vacation windows */
export function findVacationWindows(
  slotDetails: SlotDetail[],
  holidays: Set<string>,
  maxDays: number = 30,
  overrides: DateOverride[] = []
): VacationWindow[] {
  const windows: VacationWindow[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Scan from today forward
  for (let startOffset = 0; startOffset < maxDays; startOffset++) {
    const start = new Date(today)
    start.setDate(start.getDate() + startOffset)

    // Try windows of increasing length
    for (let length = 1; length <= maxDays - startOffset; length++) {
      const end = new Date(start)
      end.setDate(end.getDate() + length - 1)

      const impact = computeLeaveImpact(
        slotDetails,
        holidays,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10),
        overrides
      )

      // Stop extending if overall drops below 75% (hard danger)
      if (impact.overallZone === 'red') break

      // Count free days before/after
      const freeBefore = countFreeDaysBefore(start, holidays)
      const freeAfter = countFreeDaysAfter(end, holidays)

      windows.push({
        ...impact,
        rank: 0,
        freeDaysBefore: freeBefore,
        freeDaysAfter: freeAfter,
        totalCalendarDays: length + freeBefore + freeAfter,
      })
    }
  }

  // Deduplicate: keep only the best window for each start date
  const bestByStart = new Map<string, VacationWindow>()
  for (const w of windows) {
    const existing = bestByStart.get(w.startDate)
    if (!existing || w.totalCalendarDays > existing.totalCalendarDays) {
      bestByStart.set(w.startDate, w)
    }
  }

  // Sort by total calendar days desc, then by overall margin desc
  const ranked = [...bestByStart.values()]
    .sort((a, b) =>
      b.totalCalendarDays - a.totalCalendarDays ||
      (b.overallAfter - a.overallAfter)
    )
    .map((w, i) => ({ ...w, rank: i + 1 }))

  return ranked.slice(0, 10) // top 10
}

function countFreeDaysBefore(date: Date, holidays: Set<string>): number {
  let count = 0
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  while (isWeekend(d) || holidays.has(d.toISOString().slice(0, 10))) {
    count++
    d.setDate(d.getDate() - 1)
    if (count > 30) break
  }
  return count
}

function countFreeDaysAfter(date: Date, holidays: Set<string>): number {
  let count = 0
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  while (isWeekend(d) || holidays.has(d.toISOString().slice(0, 10))) {
    count++
    d.setDate(d.getDate() + 1)
    if (count > 30) break
  }
  return count
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}
