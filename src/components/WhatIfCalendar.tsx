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
  const [rpLeaves, setRpLeaves] = useState<number>(0)

  const impact = useMemo(() => {
    if (!selectedStart || !selectedEnd) return null
    if (selectedStart > selectedEnd) return null
    const slotsToUse = excludeActivities ? slots.filter(s => !s.slot.isActivity) : slots
    return computeLeaveImpact(slotsToUse, holidays, selectedStart, selectedEnd, overrides, rpLeaves)
  }, [slots, holidays, selectedStart, selectedEnd, overrides, excludeActivities, rpLeaves])

  // Map subject code → name for display
  const subjectNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const sd of slots) map[sd.slot.subjectCode] = sd.slot.subjectName
    return map
  }, [slots])

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

        <div className="mt-4 flex flex-col gap-3">
          {/* RP leave */}
          <div className="flex items-center gap-3">
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
            {rpLeaves > 0 && (
              <span className="text-xs text-blue-600">covers busiest days first</span>
            )}
          </div>

          {/* Skip activities toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeActivities}
              onChange={e => setExcludeActivities(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Skip all activities (assume ECA/SDCP are absent)</span>
          </label>
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
                {impact.rpLeavesUsed > 0 && <span className="text-blue-600 ml-1">· {impact.rpLeavesUsed} RP used</span>}
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

          {/* RP-leave covered dates */}
          {impact.rpLeavesUsed > 0 && (
            <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
              RP-leave covers: {impact.rpCoveredDates.join(', ')}
            </div>
          )}

          {/* Per-subject breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Per Subject</h3>
            <div className="space-y-3">
              {Object.entries(impact.perSubject).map(([code, data]) => {
                const unrecoverable = data.remainingBudget <= 0 && data.after < 80
                return (
                  <div key={code} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{code}</span>
                        {subjectNames[code] && (
                          <span className="text-xs text-gray-400 ml-2">{subjectNames[code]}</span>
                        )}
                      </div>
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
                      {unrecoverable ? (
                        <span className="ml-2 font-bold text-red-600">💀 UNRECOVERABLE</span>
                      ) : data.after < 80 && data.zone === 'red' ? (
                        <span className="ml-2 font-medium text-red-600">⚠ DETAINED</span>
                      ) : data.after < 80 ? (
                        <span className="ml-2 font-medium text-amber-600">⚠ CONDONATION</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
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
