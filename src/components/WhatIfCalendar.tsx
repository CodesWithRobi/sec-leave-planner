import { useMemo, useState } from 'react'
import type { SlotDetail, DateOverride, LeaveRange } from '../engine/types'
import { computeLeavePlanImpact } from '../engine/attendance'

const MAX_PLAN_RANGES = 5
const TERM_MIN = '2026-08-25'
const TERM_MAX = '2026-09-19'

interface Props {
  slots: SlotDetail[]
  overrides: DateOverride[]
  holidays: Set<string>
  plan: LeaveRange[]
  onAddRange: (range: Omit<LeaveRange, 'id'>) => void
  onUpdateRange: (range: LeaveRange) => void
  onRemoveRange: (id: string) => void
}

export default function WhatIfCalendar({ slots, overrides, holidays, plan, onAddRange, onUpdateRange, onRemoveRange }: Props) {
  const [excludeActivities, setExcludeActivities] = useState<boolean>(false)
  const [rpLeaves, setRpLeaves] = useState<number>(0)

  const validRanges = useMemo(
    () => plan.filter(r => r.startDate && r.endDate && r.startDate <= r.endDate),
    [plan]
  )

  const impact = useMemo(() => {
    if (validRanges.length === 0) return null
    const slotsToUse = excludeActivities ? slots.filter(s => !s.slot.isActivity) : slots
    return computeLeavePlanImpact(slotsToUse, holidays, validRanges, overrides, rpLeaves)
  }, [slots, holidays, validRanges, overrides, excludeActivities, rpLeaves])

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
  const zoneTextColors = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Leave plan editor */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">What if I take leave?</h2>
        <p className="text-xs text-gray-400 mb-3">
          Stack multiple from-to ranges. Only upcoming classes in these dates count as missed.
        </p>

        {plan.map((range) => {
          const invalid = range.startDate && range.endDate && range.startDate > range.endDate
          return (
            <div key={range.id} className="mb-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={range.startDate}
                    onChange={e => onUpdateRange({ ...range, startDate: e.target.value })}
                    min={TERM_MIN}
                    max={TERM_MAX}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={range.endDate}
                      onChange={e => onUpdateRange({ ...range, endDate: e.target.value })}
                      min={range.startDate || TERM_MIN}
                      max={TERM_MAX}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => onRemoveRange(range.id)}
                    className="px-2.5 py-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label={`Remove leave range ${range.startDate} to ${range.endDate}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {invalid && (
                <p className="mt-1 text-xs text-red-500">End date must be after start date</p>
              )}
            </div>
          )
        })}

        {plan.length < MAX_PLAN_RANGES ? (
          <button
            onClick={() => onAddRange({ startDate: '', endDate: '' })}
            className="mt-1 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add leave range
          </button>
        ) : (
          <p className="mt-1 text-xs text-gray-400">{MAX_PLAN_RANGES} range limit reached — remove one to add more.</p>
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
                {impact.daysCount} days · {impact.sessionsMissed} sessions missed ({impact.hoursMissed}h)
                {impact.rpLeavesUsed > 0 && <span className="text-blue-600 ml-1">· {impact.rpLeavesUsed} RP used</span>}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-400">{impact.overallBefore}%</div>
                <div className="text-xs text-gray-500">Now</div>
              </div>
              <div className="text-2xl text-gray-300">&rarr;</div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${zoneTextColors[impact.overallFinalZone]}`}>
                  {impact.overallFinal}%
                </div>
                <div className="text-xs text-gray-500 max-w-[180px]">
                  if you attend every other future class
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              If the term ended today: <span className="font-medium text-gray-600">{impact.overallAfter}%</span>
            </div>
            {impact.overallFinalZone === 'red' && (
              <div className="mt-3 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                This leave drops you below 75%. You may be detained.
              </div>
            )}
            {impact.overallFinalZone === 'amber' && (
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
                const isActivity = code === 'SDCP' || code.startsWith('ECA')
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
                        {isActivity ? (
                          <span className="text-sm font-bold px-2 py-0.5 rounded text-gray-500 bg-gray-50">
                            {data.after}%
                          </span>
                        ) : (
                          <span className={`text-sm font-bold px-2 py-0.5 rounded ${zoneColors[data.zone]}`}>
                            {data.after}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 ml-2">
                      Missed: {data.missedClasses} classes ({data.missedHours}h)
                      {!isActivity && (
                        <> · Remaining budget: {data.remainingBudgetSessions} classes ({data.remainingBudget}h)</>
                      )}
                      {!isActivity && (
                        unrecoverable ? (
                          <span className="ml-2 font-bold text-red-600">💀 UNRECOVERABLE</span>
                        ) : data.after < 80 && data.zone === 'red' ? (
                          <span className="ml-2 font-medium text-red-600">⚠ DETAINED</span>
                        ) : data.after < 80 ? (
                          <span className="ml-2 font-medium text-amber-600">⚠ CONDONATION</span>
                        ) : null
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!impact && (
        <div className="text-center py-12 text-gray-400 text-sm">
          {plan.length === 0
            ? 'Add a leave range above to see the impact'
            : 'Fill both dates on a range above to see the impact'}
        </div>
      )}
    </div>
  )
}