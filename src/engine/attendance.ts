import type { Session, SlotDetail, ComputedStats, DateOverride, LeaveImpact, VacationWindow } from './types'

// Zone thresholds
const GREEN_THRESHOLD = 80
const AMBER_THRESHOLD = 75

export function getZone(percentage: number): 'green' | 'amber' | 'red' {
  if (percentage >= GREEN_THRESHOLD) return 'green'
  if (percentage >= AMBER_THRESHOLD) return 'amber'
  return 'red'
}

/** Parse "17 Jul 2026" or "2026-07-17" → ISO date string "2026-07-17" */
export function parseSessionDate(dateStr: string): string {
  // Already ISO format?
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr

  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
  }
  const m = dateStr.match(/(\d+)\s+(\w+)\s+(\d{4})/)
  if (!m) return dateStr
  const [, day, mon, year] = m
  return `${year}-${months[mon] || '01'}-${day.padStart(2, '0')}`
}

/** Format hours as "X classes (Yh)" */
export function formatClasses(hours: number, avgHoursPerClass = 2): string {
  const classes = Math.round(hours / avgHoursPerClass * 10) / 10
  const displayClasses = classes % 1 === 0 ? classes.toString() : classes.toFixed(1)
  return `${displayClasses} classes (${hours}h)`
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
  return sessions.filter(s => {
    if (s.status !== 'UPCOMING') return false
    const isoDate = parseSessionDate(s.date)
    return !holidays.has(isoDate)
  })
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
  const maxMiss = presentHours + remainingHours - 0.8 * (totalHours + remainingHours)
  const budgetHours = Math.max(0, maxMiss)
  // Count actual remaining sessions, not just hours/2
  const avgSessionHours = future.length > 0 ? remainingHours / future.length : 2
  const budgetSessions = Math.floor(budgetHours / avgSessionHours)

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
  let remainingSessions = 0

  for (const sd of filtered) {
    const conducted = conductedSessions(sd.sessions)
    const present = presentSessions(sd.sessions)
    const future = upcomingSessions(sd.sessions, holidays)

    presentHours += present.reduce((sum, s) => sum + s.hours, 0)
    totalHours += conducted.reduce((sum, s) => sum + s.hours, 0)
    remainingHours += future.reduce((sum, s) => sum + s.hours, 0)
    remainingSessions += future.length
  }

  const percentage = totalHours > 0 ? (presentHours / totalHours) * 100 : 100
  const maxMiss = presentHours + remainingHours - 0.8 * (totalHours + remainingHours)
  const budgetHours = Math.max(0, maxMiss)
  const avgSessionHours = remainingSessions > 0 ? remainingHours / remainingSessions : 2

  return {
    presentHours,
    totalHours,
    percentage: Math.round(percentage * 100) / 100,
    remainingHours,
    budgetHours: Math.round(budgetHours * 100) / 100,
    budgetSessions: Math.floor(budgetHours / avgSessionHours),
    zone: getZone(percentage),
  }
}

/** Apply date overrides to sessions (mark holidays/no-class) */
export function applyOverrides(sessions: Session[], overrides: DateOverride[]): Session[] {
  const overrideMap = new Map<string, DateOverride>()
  for (const o of overrides) overrideMap.set(o.date, o)

  return sessions.map(s => {
    const isoDate = parseSessionDate(s.date)
    const override = overrideMap.get(isoDate)
    if (!override) return s

    if (override.type === 'holiday' || override.type === 'no_class') {
      return { ...s, status: 'HOLIDAY' as const }
    }
    if (override.type === 'class_happened') {
      if (s.status === 'HOLIDAY') return { ...s, status: 'ABSENT' as const }
    }
    return s
  })
}

/** Compute impact of a leave window on all subjects + overall.
 *  rpLeaves: number of RP-leave days available — those school days
 *  become PRESENT for ALL subjects (applied to highest-hour days first). */
export function computeLeaveImpact(
  slotDetails: SlotDetail[],
  holidays: Set<string>,
  startDate: string,
  endDate: string,
  overrides: DateOverride[] = [],
  rpLeaves: number = 0,
): LeaveImpact {
  // Apply overrides first
  const adjusted = slotDetails.map(sd => ({
    ...sd,
    sessions: applyOverrides(sd.sessions, overrides),
  }))

  // Sessions in the leave window (convert to ISO for comparison)
  const leaveDates = new Set<string>()
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    leaveDates.add(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }

  // Determine which dates get RP-leave coverage (highest total hours first)
  const rpCoveredDates = new Set<string>()
  let rpUsed = 0
  if (rpLeaves > 0) {
    // Count total hours across ALL slots per leave-window date
    const dateHours = new Map<string, number>()
    for (const sd of adjusted) {
      for (const s of sd.sessions) {
        const isoDate = parseSessionDate(s.date)
        if (leaveDates.has(isoDate) && (s.status === 'UPCOMING' || s.status === 'PRESENT')) {
          dateHours.set(isoDate, (dateHours.get(isoDate) || 0) + s.hours)
        }
      }
    }
    // Sort descending by hours — RP-leave covers the most packed days first
    const sortedDates = [...dateHours.entries()].sort((a, b) => b[1] - a[1])
    for (const [date, _hours] of sortedDates) {
      if (rpUsed >= rpLeaves) break
      rpCoveredDates.add(date)
      rpUsed++
    }
  }

  // Compute before stats
  const beforeOverall = computeOverallStats(adjusted, holidays)

  const perSubject: Record<string, { before: number; after: number; zone: import('./types').VerdictZone; missedHours: number; missedClasses: number; remainingBudget: number }> = {}
  let hoursMissed = 0
  let sessionsMissed = 0

  for (const sd of adjusted) {
    const before = computeSlotStats(sd, holidays)

    // Count sessions in leave window (excluding RP-covered dates)
    const missed = sd.sessions.filter(s => {
      const isoDate = parseSessionDate(s.date)
      return leaveDates.has(isoDate) && !rpCoveredDates.has(isoDate) &&
        (s.status === 'UPCOMING' || s.status === 'ABSENT' || s.status === 'PRESENT')
    })

    const missedHours = missed.reduce((sum, s) => sum + s.hours, 0)
    hoursMissed += missedHours
    sessionsMissed += missed.length

    // After: non-RP sessions become ABSENT, RP-covered stay as-is (counted present)
    const adjustedSessions = sd.sessions.map(s => {
      const isoDate = parseSessionDate(s.date)
      if (leaveDates.has(isoDate) && !rpCoveredDates.has(isoDate) && (s.status === 'UPCOMING' || s.status === 'PRESENT')) {
        return { ...s, status: 'ABSENT' as const }
      }
      return s
    })

    const afterStats = computeSlotStats({ ...sd, sessions: adjustedSessions }, holidays)

    const remainingBudget = afterStats.budgetHours

    perSubject[sd.slot.subjectCode] = {
      before: before.percentage,
      after: afterStats.percentage,
      zone: afterStats.zone,
      missedHours,
      missedClasses: Math.round(missedHours / 2 * 10) / 10,
      remainingBudget,
    }
  }

  // Overall after
  const adjustedOverall = slotDetails.map(sd => ({
    ...sd,
    sessions: applyOverrides(sd.sessions, overrides).map(s => {
      const isoDate = parseSessionDate(s.date)
      if (leaveDates.has(isoDate) && !rpCoveredDates.has(isoDate) && (s.status === 'UPCOMING' || s.status === 'PRESENT')) {
        return { ...s, status: 'ABSENT' as const }
      }
      return s
    }),
  }))

  const afterOverall = computeOverallStats(adjustedOverall, holidays)

  return {
    startDate,
    endDate,
    daysCount: leaveDates.size,
    sessionsMissed,
    hoursMissed,
    rpLeavesUsed: rpUsed,
    rpCoveredDates: [...rpCoveredDates].sort(),
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
  overrides: DateOverride[] = [],
  rpLeaves: number = 0,
): VacationWindow[] {
  const windows: VacationWindow[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Scan from today forward
  for (let startOffset = 0; startOffset < maxDays; startOffset++) {
    const start = new Date(today)
    start.setDate(start.getDate() + startOffset)
    const startStr = start.toISOString().slice(0, 10)

    // Try windows of increasing length
    for (let length = 1; length <= maxDays - startOffset; length++) {
      const end = new Date(start)
      end.setDate(end.getDate() + length - 1)
      const endStr = end.toISOString().slice(0, 10)

      const impact = computeLeaveImpact(
        slotDetails,
        holidays,
        startStr,
        endStr,
        overrides,
        rpLeaves
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

  return ranked.slice(0, 10)
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
