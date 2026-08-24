import { useMemo } from 'react'
import type { SlotDetail, DateOverride } from '../engine/types'
import { computeSlotStats, computeOverallStats, formatClasses, parseSessionDate } from '../engine/attendance'

interface Props {
  slots: SlotDetail[]
  overrides: DateOverride[]
}

const ZONE_COLORS = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

const ZONE_TEXT = {
  green: 'text-green-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
}

const ZONE_LABELS = {
  green: 'Safe',
  amber: 'Condonation risk',
  red: 'Detained',
}

function budgetColor(hours: number, percentage: number): string {
  // Unrecoverable: budget is 0 and below 80% — even perfect attendance can't save you
  if (hours <= 0 && percentage < 80) return 'text-red-600 font-bold'
  if (hours === 0) return 'text-red-600 font-bold'
  if (hours <= 2) return 'text-amber-600 font-medium'
  return 'text-green-600 font-medium'
}

function budgetLabel(hours: number, percentage: number): string {
  if (hours <= 0 && percentage < 80) return ' 💀'
  if (hours <= 0) return ''
  return ''
}

export default function Dashboard({ slots, overrides }: Props) {
  const holidays = useMemo(() => {
    const h = new Set(['2026-08-26', '2026-09-04', '2026-09-14'])
    overrides.forEach(o => {
      if (o.type === 'holiday' || o.type === 'no_class') h.add(o.date)
      if (o.type === 'class_happened') h.delete(o.date)
    })
    return h
  }, [overrides])

  const overall = useMemo(() => computeOverallStats(slots, holidays), [slots, holidays])

  // SDCP miss budget: how many 1hr SDCP classes can I miss before OVERALL drops to 80%?
  // Assumes no other courses are missed.
  const sdcpBudget = useMemo(() => {
    const sdcpSlots = slots.filter(s => s.slot.subjectCode === 'SDCP' && s.slot.isActivity)
    const courseSlots = slots.filter(s => !s.slot.isActivity)

    // Courses-only present/total (the baseline we're protecting)
    let coursePresent = 0
    let courseTotal = 0
    for (const sd of courseSlots) {
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      coursePresent += present.reduce((sum, s) => sum + s.hours, 0)
      courseTotal += conducted.reduce((sum, s) => sum + s.hours, 0)
    }

    // SDCP present/conducted/remaining
    let sdcpPresent = 0
    let sdcpConducted = 0
    let sdcpRemaining = 0
    for (const sd of sdcpSlots) {
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      const future = sd.sessions.filter(s => s.status === 'UPCOMING' && !holidays.has(parseSessionDate(s.date)))
      sdcpPresent += present.reduce((sum, s) => sum + s.hours, 0)
      sdcpConducted += conducted.reduce((sum, s) => sum + s.hours, 0)
      sdcpRemaining += future.reduce((sum, s) => sum + s.hours, 0)
    }

    if (sdcpConducted === 0 && sdcpRemaining === 0) return null

    // If all SDCP attended, overall = (coursePresent + sdcpPresent + sdcpRemaining) / (courseTotal + sdcpConducted + sdcpRemaining)
    // If we miss x hours of SDCP: (coursePresent + sdcpPresent + (sdcpRemaining - x)) / (courseTotal + sdcpConducted + sdcpRemaining) >= 0.8
    // Solve: x <= coursePresent + sdcpPresent + sdcpRemaining - 0.8 * (courseTotal + sdcpConducted + sdcpRemaining)
    const maxMissHours = coursePresent + sdcpPresent + sdcpRemaining - 0.8 * (courseTotal + sdcpConducted + sdcpRemaining)
    const maxMissClasses = Math.max(0, Math.floor(maxMissHours))

    // What overall is if all SDCP attended
    const overallIfAllAttended = Math.round((coursePresent + sdcpPresent + sdcpRemaining) / (courseTotal + sdcpConducted + sdcpRemaining) * 10000) / 100

    return {
      sdcpPresent,
      sdcpTotal: sdcpConducted,
      sdcpRemaining,
      maxMissClasses,
      maxMissHours: Math.round(maxMissHours * 100) / 100,
      overallIfAllAttended,
    }
  }, [slots, holidays])

  const subjectStats = useMemo(() =>
    slots
      .filter(s => !s.slot.isActivity)
      .map(s => ({
        ...s,
        stats: computeSlotStats(s, holidays),
      }))
      .sort((a, b) => a.stats.percentage - b.stats.percentage),
    [slots, holidays]
  )

  const activityStats = useMemo(() =>
    slots
      .filter(s => s.slot.isActivity)
      .map(s => ({
        ...s,
        stats: computeSlotStats(s, holidays),
      })),
    [slots, holidays]
  )

  // Activity impact: what do they add to overall, and what if you skip them?
  const activityImpact = useMemo(() => {
    const courseSlots = slots.filter(s => !s.slot.isActivity)
    const actSlots = slots.filter(s => s.slot.isActivity)

    let coursePresent = 0, courseTotal = 0
    for (const sd of courseSlots) {
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      coursePresent += present.reduce((sum, s) => sum + s.hours, 0)
      courseTotal += conducted.reduce((sum, s) => sum + s.hours, 0)
    }

    const items = actSlots.map(sd => {
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const future = sd.sessions.filter(s => s.status === 'UPCOMING' && !holidays.has(parseSessionDate(s.date)))
      const attended = present.reduce((sum, s) => sum + s.hours, 0)
      const total = conducted.reduce((sum, s) => sum + s.hours, 0)
      const remaining = future.reduce((sum, s) => sum + s.hours, 0)
      return { slot: sd.slot, attended, total, remaining }
    })

    const totalActAttended = items.reduce((sum, i) => sum + i.attended, 0)
    const totalActRemaining = items.reduce((sum, i) => sum + i.remaining, 0)

    const withAll = Math.round((coursePresent + totalActAttended + totalActRemaining) / (courseTotal + totalActAttended + totalActRemaining) * 10000) / 100
    const withoutRemaining = Math.round((coursePresent + totalActAttended) / (courseTotal + totalActAttended) * 10000) / 100

    return { items, withAll, withoutRemaining }
  }, [slots, holidays])

  return (
    <div className="space-y-6">
      {/* Overall gauge */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Overall Attendance</h2>
        <div className="flex items-end gap-4">
          <span className={`text-5xl font-bold ${ZONE_TEXT[overall.zone]}`}>
            {overall.percentage}%
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${ZONE_COLORS[overall.zone]}`}>
            {ZONE_LABELS[overall.zone]}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Present</div>
            <div className="font-semibold">{formatClasses(overall.presentHours)}</div>
          </div>
          <div>
            <div className="text-gray-500">Remaining</div>
            <div className="font-semibold">{formatClasses(overall.remainingHours)}</div>
          </div>
          <div>
            <div className="text-gray-500">Safe misses</div>
            <div className={`font-semibold ${budgetColor(overall.budgetHours, overall.percentage)}`}>
              {formatClasses(overall.budgetHours)}{budgetLabel(overall.budgetHours, overall.percentage)}
            </div>
          </div>
        </div>
      </div>

      {/* SDCP card */}
      {sdcpBudget && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-3">SDCP Classes (1hr each)</h2>
          <div className="flex items-end gap-4">
            <div>
              <span className={`text-4xl font-bold ${sdcpBudget.maxMissClasses <= 2 ? 'text-red-600' : sdcpBudget.maxMissClasses <= 4 ? 'text-amber-600' : 'text-green-600'}`}>
                {sdcpBudget.maxMissClasses}
              </span>
              <span className="text-lg text-gray-400 ml-1">classes</span>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            you can miss before overall drops below 80%
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span>Attended: </span>
              <span className="font-medium">{sdcpBudget.sdcpPresent}h / {sdcpBudget.sdcpTotal}h</span>
            </div>
            <div>
              <span>Remaining: </span>
              <span className="font-medium">{sdcpBudget.sdcpRemaining}h</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            If you attend all remaining: overall {sdcpBudget.overallIfAllAttended}%
          </div>
        </div>
      )}

      {/* Subject cards */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">Per Subject</h2>
        <div className="grid gap-3">
          {subjectStats.map(({ slot: s, stats }) => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{s.subjectCode}</div>
                <div className="text-xs text-gray-500 truncate">{s.subjectName}</div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="text-right text-xs">
                  <div className="text-gray-500">{formatClasses(stats.presentHours)} / {formatClasses(stats.totalHours)}</div>
                  <div className={budgetColor(stats.budgetHours, stats.percentage)}>
                    miss {formatClasses(stats.budgetHours)}{budgetLabel(stats.budgetHours, stats.percentage)}
                  </div>
                </div>
                <div className={`w-14 text-center`}>
                  <span className={`text-lg font-bold ${ZONE_TEXT[stats.zone]}`}>
                    {stats.percentage}%
                  </span>
                </div>
                <div className={`w-2 h-8 rounded-full ${ZONE_COLORS[stats.zone]}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activities */}
      {activityImpact.items.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-1">Activities</h2>
          <p className="text-xs text-gray-400 mb-4">Not per-subject rule, but they feed the overall pool</p>

          <div className="flex items-center gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-500">With all: </span>
              <span className="font-semibold text-green-600">{activityImpact.withAll}%</span>
            </div>
            <div>
              <span className="text-gray-500">Skip remaining: </span>
              <span className={`font-semibold ${activityImpact.withoutRemaining < 80 ? 'text-red-600' : 'text-amber-600'}`}>
                {activityImpact.withoutRemaining}%
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            {activityImpact.items.map(i => (
              <div key={i.slot.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="text-gray-700 font-medium">{i.slot.subjectCode}</span>
                  <span className="text-gray-400 ml-2 text-xs">{i.slot.subjectName}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {i.attended}/{i.total}h · {i.remaining}h left
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
