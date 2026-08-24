import { useState, useMemo } from 'react'
import type { SlotDetail, DateOverride } from '../engine/types'
import { findVacationWindows } from '../engine/attendance'

interface Props {
  slots: SlotDetail[]
  overrides: DateOverride[]
  holidays: Set<string>
}

export default function TripPlanner({ slots, overrides, holidays }: Props) {
  const [maxDays, setMaxDays] = useState(21)

  const windows = useMemo(() => {
    if (slots.length === 0) return []
    return findVacationWindows(slots, holidays, maxDays, overrides)
  }, [slots, holidays, maxDays, overrides])

  const zoneColors = {
    green: 'border-green-500 bg-green-50',
    amber: 'border-amber-500 bg-amber-50',
    red: 'border-red-500 bg-red-50',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Find Longest Vacation</h2>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Scan up to</label>
          <select
            value={maxDays}
            onChange={e => setMaxDays(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={21}>21 days</option>
            <option value={30}>30 days</option>
          </select>
          <span className="text-sm text-gray-500">ahead from today</span>
        </div>
      </div>

      {windows.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No vacation windows found. Import your data first.
        </div>
      )}

      <div className="space-y-3">
        {windows.map((w) => (
          <div
            key={w.startDate}
            className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${zoneColors[w.overallZone]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">#{w.rank}</span>
                <span className="font-semibold text-sm">
                  {formatDate(w.startDate)} &mdash; {formatDate(w.endDate)}
                </span>
              </div>
              <span className="text-xs text-gray-500">{w.totalCalendarDays} calendar days</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <span>{w.daysCount} school days</span>
              <span>{w.sessionsMissed} sessions missed</span>
              <span>{w.freeDaysBefore}d free before</span>
              <span>{w.freeDaysAfter}d free after</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-gray-400">{w.overallBefore}%</span>
              <span className="text-gray-300">&rarr;</span>
              <span className={`text-sm font-bold ${w.overallZone === 'green' ? 'text-green-600' : w.overallZone === 'amber' ? 'text-amber-600' : 'text-red-600'}`}>
                {w.overallAfter}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}
