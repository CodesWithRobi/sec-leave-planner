import type { Session, SlotDetail, ComputedStats, DateOverride, LeaveImpact, LeaveRange, ODEntry, VacationWindow } from './types'

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

/** Session start/end times as "HH:MM" strings (24h) or null when unknown.
 *  Real imports store "10:00 - 11:59" in `time`; fixtures use field pairs. */
function sessionTimeRange(s: Session): [string, string] | null {
  if (s.time) {
    const [a, b] = s.time.split(' - ').map(t => t.trim())
    if (a && b && /^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b)) return [a, b]
  }
  if (s.startTime && s.endTime && /^\d{2}:\d{2}$/.test(s.startTime) && /^\d{2}:\d{2}$/.test(s.endTime)) {
    return [s.startTime, s.endTime]
  }
  return null
}

/** Apply On-Duty entries: every session inside an OD's date range (AND, when
 *  the OD has a time window, whose time overlaps it) becomes PRESENT.
 *  Holidays stay holidays; already-PRESENT sessions are unchanged. Sessions
 *  without time info are NOT matched by time-restricted ODs (only by
 *  whole-day ODs). */
export function applyODs(sessions: Session[], ods: ODEntry[]): Session[] {
  if (ods.length === 0) return sessions
  return sessions.map(s => {
    if (s.status === 'HOLIDAY') return s
    const isoDate = parseSessionDate(s.date)
    for (const od of ods) {
      if (!od.startDate || !od.endDate) continue
      if (isoDate < od.startDate || isoDate > od.endDate) continue
      if (od.startTime && od.endTime) {
        const range = sessionTimeRange(s)
        if (!range) continue // can't verify — don't mark
        const [start, end] = range
        if (!(start < od.endTime && end > od.startTime)) continue
      }
      return { ...s, status: 'PRESENT' as const }
    }
    return s
  })
}

/** Union of ISO dates covered by a set of leave ranges (overlaps deduped). */
function collectLeaveDates(ranges: LeaveRange[]): Set<string> {
  const dates = new Set<string>()
  for (const range of ranges) {
    if (!range.startDate || !range.endDate) continue
    const d = new Date(range.startDate + 'T00:00:00')
    const end = new Date(range.endDate + 'T00:00:00')
    while (d <= end) {
      dates.add(toLocalISODate(d))
      d.setDate(d.getDate() + 1)
    }
  }
  return dates
}

function unionBounds(ranges: LeaveRange[]): { startDate: string; endDate: string } {
  let startDate = ''
  let endDate = ''
  for (const r of ranges) {
    if (r.startDate && (!startDate || r.startDate < startDate)) startDate = r.startDate
    if (r.endDate && (!endDate || r.endDate > endDate)) endDate = r.endDate
  }
  return { startDate, endDate }
}

/** Compute impact of a leave PLAN (one or more from-to ranges) on all subjects + overall.
 *
 *  Semantics:
 *  - Only UPCOMING sessions inside the plan are treated as missed. Already-attended
 *    (PRESENT) days are NOT retroactively cancelled — a range overlapping past days
 *    costs nothing. Already-ABSENT sessions are untouched and not double-counted.
 *  - overallAfter  = attendance if the term ended today (no future classes) — secondary.
 *  - overallFinal  = projected attendance assuming EVERY future session outside the
 *    plan is attended — the main number:
 *        (presentHours + remainingHoursAfterLeave) / (conductedHours + remainingHoursAfterLeave)
 *
 *  rpLeaves: number of RP-leave days available — those school days become PRESENT for
 *  ALL subjects (applied to the highest-hour upcoming days first). */
export function computeLeavePlanImpact(
  slotDetails: SlotDetail[],
  holidays: Set<string>,
  ranges: LeaveRange[],
  overrides: DateOverride[] = [],
  rpLeaves: number = 0,
): LeaveImpact {
  // Apply overrides first
  const adjusted = slotDetails.map(sd => ({
    ...sd,
    sessions: applyOverrides(sd.sessions, overrides),
  }))

  // Union of all leave dates in the plan (overlaps deduped)
  const leaveDates = collectLeaveDates(ranges)
  const bounds = unionBounds(ranges)

  // Determine which dates get RP-leave coverage (highest total upcoming hours first)
  const rpCoveredDates = new Set<string>()
  let rpUsed = 0
  if (rpLeaves > 0) {
    const dateHours = new Map<string, number>()
    for (const sd of adjusted) {
      for (const s of sd.sessions) {
        const isoDate = parseSessionDate(s.date)
        // Only upcoming classes can be covered — a leave affects only future days
        if (leaveDates.has(isoDate) && !holidays.has(isoDate) && s.status === 'UPCOMING') {
          dateHours.set(isoDate, (dateHours.get(isoDate) || 0) + s.hours)
        }
      }
    }
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

    // Only UPCOMING sessions in the plan are missed (RP-covered + holidays excluded)
    const missed = sd.sessions.filter(s => {
      const isoDate = parseSessionDate(s.date)
      return leaveDates.has(isoDate) && !rpCoveredDates.has(isoDate) && !holidays.has(isoDate) &&
        s.status === 'UPCOMING'
    })

    const missedHours = missed.reduce((sum, s) => sum + s.hours, 0)
    hoursMissed += missedHours
    sessionsMissed += missed.length

    // After: leave-marked upcoming sessions become ABSENT; PRESENT/ABSENT untouched
    const adjustedSessions = sd.sessions.map(s => {
      const isoDate = parseSessionDate(s.date)
      if (leaveDates.has(isoDate) && !rpCoveredDates.has(isoDate) && !holidays.has(isoDate) && s.status === 'UPCOMING') {
        return { ...s, status: 'ABSENT' as const }
      }
      return s
    })

    const afterStats = computeSlotStats({ ...sd, sessions: adjustedSessions }, holidays)

    perSubject[sd.slot.subjectCode] = {
      before: before.percentage,
      after: afterStats.percentage,
      zone: afterStats.zone,
      missedHours,
      missedClasses: Math.round(missedHours / 2 * 10) / 10,
      remainingBudget: afterStats.budgetHours,
    }
  }

  // Overall after (term ended today) + projected final (attend everything else)
  const adjustedOverall = slotDetails.map(sd => ({
    ...sd,
    sessions: applyOverrides(sd.sessions, overrides).map(s => {
      const isoDate = parseSessionDate(s.date)
      if (leaveDates.has(isoDate) && !rpCoveredDates.has(isoDate) && !holidays.has(isoDate) && s.status === 'UPCOMING') {
        return { ...s, status: 'ABSENT' as const }
      }
      return s
    }),
  }))

  const afterOverall = computeOverallStats(adjustedOverall, holidays)

  // Future hours still to be attended after the leave plan (holidays excluded already)
  let remainingAfter = 0
  for (const sd of adjustedOverall) {
    remainingAfter += upcomingSessions(sd.sessions, holidays).reduce((sum, s) => sum + s.hours, 0)
  }

  const denominator = afterOverall.totalHours + remainingAfter
  const overallFinal = denominator > 0
    ? ((afterOverall.presentHours + remainingAfter) / denominator) * 100
    : afterOverall.percentage

  return {
    ranges: ranges.map(r => ({ ...r })),
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    daysCount: leaveDates.size,
    sessionsMissed,
    hoursMissed,
    rpLeavesUsed: rpUsed,
    rpCoveredDates: [...rpCoveredDates].sort(),
    perSubject,
    overallBefore: beforeOverall.percentage,
    overallAfter: afterOverall.percentage,
    overallFinal: Math.round(overallFinal * 100) / 100,
    overallZone: afterOverall.zone,
    overallFinalZone: getZone(overallFinal),
  }
}

/** Compute impact of a single leave window (wrapper around computeLeavePlanImpact). */
export function computeLeaveImpact(
  slotDetails: SlotDetail[],
  holidays: Set<string>,
  startDate: string,
  endDate: string,
  overrides: DateOverride[] = [],
  rpLeaves: number = 0,
): LeaveImpact {
  return computeLeavePlanImpact(slotDetails, holidays, [{ id: 'window', startDate, endDate }], overrides, rpLeaves)
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
    const startStr = toLocalISODate(start)

    // Try windows of increasing length
    for (let length = 1; length <= maxDays - startOffset; length++) {
      const end = new Date(start)
      end.setDate(end.getDate() + length - 1)
      const endStr = toLocalISODate(end)

      const impact = computeLeaveImpact(
        slotDetails,
        holidays,
        startStr,
        endStr,
        overrides,
        rpLeaves
      )

      // Stop extending if projected overall drops below 75% (hard danger)
      if (impact.overallFinalZone === 'red') break

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

  // Sort by total calendar days desc, then by projected margin desc
  const ranked = [...bestByStart.values()]
    .sort((a, b) =>
      b.totalCalendarDays - a.totalCalendarDays ||
      (b.overallFinal - a.overallFinal)
    )
    .map((w, i) => ({ ...w, rank: i + 1 }))

  return ranked.slice(0, 10)
}

function countFreeDaysBefore(date: Date, holidays: Set<string>): number {
  let count = 0
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  while (isWeekend(d) || holidays.has(toLocalISODate(d))) {
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
  while (isWeekend(d) || holidays.has(toLocalISODate(d))) {
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

/** Convert a Date to local YYYY-MM-DD (avoids toISOString() UTC shift) */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
