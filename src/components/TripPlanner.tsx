import { useState, useMemo } from 'react'
import type { SlotDetail, DateOverride } from '../engine/types'
import { findVacationWindows, formatClasses } from '../engine/attendance'

interface Props {
  slots: SlotDetail[]
  overrides: DateOverride[]
  holidays: Set<string>
}

export default function TripPlanner({ slots, overrides, holidays }: Props) {
  const [maxDays, setMaxDays] = useState(21)
  const [rpLeaves, setRpLeaves] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  const windows = useMemo(() => {
    if (slots.length === 0) return []
    return findVacationWindows(slots, holidays, maxDays, overrides, rpLeaves)
  }, [slots, holidays, maxDays, overrides, rpLeaves])

  const zoneColors = {
    green: 'border-green-500 bg-green-50',
    amber: 'border-amber-500 bg-amber-50',
    red: 'border-red-500 bg-red-50',
  }

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Find Longest Vacation</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
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
            <span className="text-sm text-gray-500">ahead</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">RP leaves</label>
            <input
              type="number"
              min={0}
              max={10}
              value={rpLeaves}
              onChange={e => setRpLeaves(Math.max(0, Number(e.target.value)))}
              className="w-16 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">days</span>
          </div>
        </div>
        {rpLeaves > 0 && (
          <p className="mt-2 text-xs text-blue-600">
            RP leaves cover the busiest school days first — those sessions stay present for all subjects.
          </p>
        )}
      </div>

      {windows.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No vacation windows found. Import your data first.
        </div>
      )}

      <div className="space-y-3">
        {windows.map((w) => {
          const key = `${w.startDate}-${w.endDate}`
          const isExpanded = expanded === key

          return (
            <div
              key={key}
              className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${zoneColors[w.overallZone]}`}
            >
              <div
                className="flex items-center justify-between mb-2 cursor-pointer"
                onClick={() => toggleExpand(key)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">#{w.rank}</span>
                  <span className="font-semibold text-sm">
                    {formatDate(w.startDate)} &mdash; {formatDate(w.endDate)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{w.totalCalendarDays} calendar days</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-gray-500 flex-wrap">
                <span>{w.daysCount} school days</span>
                <span>{w.sessionsMissed} sessions missed</span>
                {w.rpLeavesUsed > 0 && (
                  <span className="text-blue-600 font-medium">{w.rpLeavesUsed} RP-leave used</span>
                )}
                <span>{w.freeDaysBefore}d free before</span>
                <span>{w.freeDaysAfter}d free after</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-gray-400">{w.overallBefore}%</span>
                <span className="text-gray-300">&rarr;</span>
                <span className={`text-sm font-bold ${w.overallZone === 'green' ? 'text-green-600' : w.overallZone === 'amber' ? 'text-amber-600' : 'text-red-600'}`}>
                  {w.overallAfter}%
                </span>
                <span className="text-xs text-gray-400">({formatClasses(w.hoursMissed)} missed)</span>
                <button
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                  onClick={() => toggleExpand(key)}
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>
              </div>

              {/* RP-leave covered dates */}
              {w.rpLeavesUsed > 0 && (
                <div className="mt-2 text-xs text-blue-600">
                  RP-leave covers: {w.rpCoveredDates.map(d => formatShortDate(d)).join(', ')}
                </div>
              )}

              {/* Per-subject breakdown */}
              {isExpanded && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">Per-subject impact</div>
                  {Object.entries(w.perSubject).map(([code, data]) => {
                    const isActivity = code === 'SDCP' || code.startsWith('ECA')
                    return (
                      <div key={code} className="flex items-center justify-between py-1 text-xs">
                        <span className="font-medium">{code}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400">{data.before}%</span>
                          <span className="text-gray-300">&rarr;</span>
                          {isActivity ? (
                            <span className="font-bold px-2 py-0.5 rounded text-gray-500 bg-gray-50">
                              {data.after}%
                            </span>
                          ) : (
                            <span className={`font-bold px-2 py-0.5 rounded ${
                              data.zone === 'green' ? 'text-green-600 bg-green-50' :
                              data.zone === 'amber' ? 'text-amber-600 bg-amber-50' :
                              'text-red-600 bg-red-50'
                            }`}>
                              {data.after}%
                            </span>
                          )}
                          <span className="text-gray-400 w-20 text-right">
                            miss {formatClasses(data.missedHours)}
                          </span>
                          {!isActivity && (
                            <span className="text-gray-400 w-28 text-right">
                              budget {formatClasses(data.remainingBudget)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })
}
