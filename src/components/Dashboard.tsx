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
  // Also computes: what's the overall if I attend all remaining vs skip all SDCP?
  const sdcpBudget = useMemo(() => {
    // Totals across ALL slots (courses + activities)
    let allPresent = 0, allConducted = 0, allRemaining = 0
    let sdcpPresent = 0, sdcpConducted = 0, sdcpRemaining = 0
    for (const sd of slots) {
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const future = sd.sessions.filter(s => s.status === 'UPCOMING' && !holidays.has(parseSessionDate(s.date)))
      const p = present.reduce((sum, s) => sum + s.hours, 0)
      const c = conducted.reduce((sum, s) => sum + s.hours, 0)
      const f = future.reduce((sum, s) => sum + s.hours, 0)
      allPresent += p; allConducted += c; allRemaining += f
      if (sd.slot.subjectCode === 'SDCP' && sd.slot.isActivity) {
        sdcpPresent += p; sdcpConducted += c; sdcpRemaining += f
      }
    }

    if (sdcpConducted === 0 && sdcpRemaining === 0) return null

    // Max SDCP hours can miss before overall hits 80%
    const maxMissHours = allPresent + allRemaining - 0.8 * (allConducted + allRemaining)
    const maxMissClasses = Math.max(0, Math.floor(maxMissHours))

    // Overall if attend ALL remaining (courses + ECA + SDCP)
    const ifAttendAll = Math.round((allPresent + allRemaining) / (allConducted + allRemaining) * 10000) / 100

    // Overall if skip all remaining SDCP (attend all courses + ECA)
    const ifSkipSdcp = Math.round((allPresent + allRemaining - sdcpRemaining) / (allConducted + allRemaining) * 10000) / 100

    return {
      sdcpPresent,
      sdcpTotal: sdcpConducted,
      sdcpRemaining,
      maxMissClasses,
      ifAttendAll,
      ifSkipSdcp,
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

  // Activity impact: what do they add to overall?
  const activityImpact = useMemo(() => {
    const actSlots = slots.filter(s => s.slot.isActivity)

    // Per-activity detail
    const items = actSlots.map(sd => {
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const future = sd.sessions.filter(s => s.status === 'UPCOMING' && !holidays.has(parseSessionDate(s.date)))
      const attended = present.reduce((sum, s) => sum + s.hours, 0)
      const total = conducted.reduce((sum, s) => sum + s.hours, 0)
      const remaining = future.reduce((sum, s) => sum + s.hours, 0)
      return { slot: sd.slot, attended, total, remaining }
    })

    return { items }
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
          <div className="mt-3 text-sm">
            <div>
              <span className="text-gray-500">Attend all remaining: </span>
              <span className="font-bold text-green-600">{sdcpBudget.ifAttendAll}%</span>
            </div>
            <div>
              <span className="text-gray-500">Skip all SDCP: </span>
              <span className={`font-bold ${sdcpBudget.ifSkipSdcp < 80 ? 'text-red-600' : 'text-amber-600'}`}>
                {sdcpBudget.ifSkipSdcp}%
              </span>
            </div>
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
