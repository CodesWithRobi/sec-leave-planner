import { useState, useMemo } from 'react'
import type { SlotDetail, DateOverride } from '../engine/types'
import { computeLeaveImpact, formatClasses } from '../engine/attendance'

interface Props {
  slots: SlotDetail[]
  overrides: DateOverride[]
  holidays: Set<string>
}

export default function WhatIfCalendar({ slots, overrides, holidays }: Props) {
  const [selectedStart, setSelectedStart] = useState<string>('')
  const [selectedEnd, setSelectedEnd] = useState<string>('')
  const [excludeActivities, setExcludeActivities] = useState<boolean>(false)

  const impact = useMemo(() => {
    if (!selectedStart || !selectedEnd) return null
    if (selectedStart > selectedEnd) return null
    const slotsToUse = excludeActivities ? slots.filter(s => !s.slot.isActivity) : slots
    return computeLeaveImpact(slotsToUse, holidays, selectedStart, selectedEnd, overrides)
  }, [slots, holidays, selectedStart, selectedEnd, overrides, excludeActivities])

  const zoneColors = {
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
  }

  return (
    <div className="space-y-6">
      {/* Date inputs */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">What if I take leave?</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={selectedStart}
              onChange={e => setSelectedStart(e.target.value)}
              min="2026-08-25"
              max="2026-09-19"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={selectedEnd}
              onChange={e => setSelectedEnd(e.target.value)}
              min={selectedStart || '2026-08-25'}
              max="2026-09-19"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {selectedStart && selectedEnd && selectedStart > selectedEnd && (
          <p className="mt-2 text-xs text-red-500">End date must be after start date</p>
        )}

        {/* Skip activities toggle */}
        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeActivities}
              onChange={e => setExcludeActivities(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Skip all activities (assume ECA/SDCP are absent)</span>
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6">Removes activity hours from the overall pool</p>
        </div>
      </div>

      {/* Impact results */}
      {impact && (
        <div className="space-y-4">
          {/* Overall verdict */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Overall Impact</h3>
              <span className="text-xs text-gray-400">
                {impact.daysCount} days · {impact.sessionsMissed} sessions · {formatClasses(impact.hoursMissed)} missed
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{impact.overallBefore}%</div>
                <div className="text-xs text-gray-500">Before</div>
              </div>
              <div className="text-2xl text-gray-300">&rarr;</div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${impact.overallZone === 'green' ? 'text-green-600' : impact.overallZone === 'amber' ? 'text-amber-600' : 'text-red-600'}`}>
                  {impact.overallAfter}%
                </div>
                <div className="text-xs text-gray-500">After</div>
              </div>
            </div>
            {impact.overallZone === 'red' && (
              <div className="mt-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                This leave drops you below 75%. You may be detained.
              </div>
            )}
            {impact.overallZone === 'amber' && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                Condonation risk. At course end, only medical OD can add percentage.
              </div>
            )}
          </div>

          {/* Per-subject breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Per Subject</h3>
            <div className="space-y-3">
              {Object.entries(impact.perSubject).map(([code, data]) => (
                <div key={code} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{code}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{data.before}%</span>
                      <span className="text-gray-300">&rarr;</span>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${zoneColors[data.zone]}`}>
                        {data.after}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 ml-2">
                    Missed: {formatClasses(data.missedHours)} · Remaining budget: {formatClasses(data.remainingBudget)}
                    {data.after < 80 && (
                      <span className={`ml-2 font-medium ${data.zone === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                        {data.zone === 'red' ? '⚠ DETAINED' : '⚠ CONDONATION'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedStart && !selectedEnd && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Pick a date range above to see the impact
        </div>
      )}
    </div>
  )
}
