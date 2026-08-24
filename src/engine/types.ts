// Core domain types for SEC Leave Planner

/** Academic term identifier */
export interface Term {
  id: number
  label: string // e.g. "26-27-ODD-T1"
}

/** Subject slot (one enrolled course/activity) */
export interface Slot {
  id: number
  slotName: string      // e.g. "26OD1238"
  subjectCode: string   // e.g. "19AI553"
  subjectName: string   // e.g. "Advanced Java Web Applications"
  isActivity: boolean   // true for ECA-*, SDCP* etc. (no per-subject rule)
}

/** Status of a session in the portal */
export type SessionStatus = 'PRESENT' | 'ABSENT' | 'HOLIDAY' | 'UPCOMING'

/** One scheduled meeting of a slot */
export interface Session {
  slotId: number
  date: string          // "2026-08-25" (ISO date)
  startTime: string     // "10:00"
  endTime: string       // "12:00"
  timing: string        // "CLS10-12"
  hours: number         // 2.0 for regular, 1.5 for mentor meet, 1.0 for SDCP
  status: SessionStatus
}

/** Full import data from bookmarklet or manual entry */
export interface AttendanceData {
  student: string       // name or reg number
  termId: number
  fetchedAt: string     // ISO timestamp
  slots: SlotDetail[]
}

export interface SlotDetail {
  slot: Slot
  sessions: Session[]
  stats: {
    presentHours: number
    totalHours: number
    percentage: number
  }
}

/** Holiday or override for a date */
export interface DateOverride {
  date: string          // "2026-09-04"
  type: 'holiday' | 'no_class' | 'class_happened'
  reason?: string       // "Krishna Jayanthi", "Rain holiday"
}

/** Verdict zone */
export type VerdictZone = 'green' | 'amber' | 'red'

/** Computed stats for one slot or overall */
export interface ComputedStats {
  presentHours: number
  totalHours: number
  percentage: number
  remainingHours: number
  budgetHours: number   // max hours may miss at >=80%
  budgetSessions: number // same but in session count
  zone: VerdictZone
}

/** Leave window result */
export interface LeaveImpact {
  startDate: string
  endDate: string
  daysCount: number
  sessionsMissed: number
  hoursMissed: number
  perSubject: Record<string, { before: number; after: number; zone: VerdictZone }>
  overallBefore: number
  overallAfter: number
  overallZone: VerdictZone
}

/** Vacation window (ranked) */
export interface VacationWindow extends LeaveImpact {
  rank: number
  freeDaysBefore: number  // weekends/holidays adjacent
  freeDaysAfter: number
  totalCalendarDays: number
}
