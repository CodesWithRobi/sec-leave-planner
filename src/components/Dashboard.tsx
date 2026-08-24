import { useMemo } from 'react'
import type { SlotDetail, DateOverride } from '../engine/types'
import { computeSlotStats, computeOverallStats, formatClasses } from '../engine/attendance'

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
  const coursesOnly = useMemo(() => computeOverallStats(slots, holidays, true), [slots, holidays])

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

      {/* Courses only */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Courses Only (no activities)</h2>
        <div className="flex items-end gap-4">
          <span className={`text-3xl font-bold ${ZONE_TEXT[coursesOnly.zone]}`}>
            {coursesOnly.percentage}%
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${ZONE_COLORS[coursesOnly.zone]}`}>
            {ZONE_LABELS[coursesOnly.zone]}
          </span>
        </div>
        <div className="mt-2 text-sm">
          <span className="text-gray-500">Safe misses: </span>
          <span className={budgetColor(coursesOnly.budgetHours, coursesOnly.percentage)}>
            {formatClasses(coursesOnly.budgetHours)}{budgetLabel(coursesOnly.budgetHours, coursesOnly.percentage)}
          </span>
        </div>
      </div>

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
      {activityStats.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Activities (not per-subject rule)</h2>
          <div className="grid gap-2">
            {activityStats.map(({ slot: s, stats }) => (
              <div key={s.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between text-sm">
                <span className="text-gray-700">{s.subjectCode}</span>
                <span className={`font-medium ${ZONE_TEXT[stats.zone]}`}>{stats.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
