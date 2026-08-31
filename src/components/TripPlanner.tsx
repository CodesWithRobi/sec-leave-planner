import { useState, useMemo } from 'react'
import type { SlotDetail, DateOverride, LeaveRange } from '../engine/types'
import { findVacationWindows, computeLeavePlanImpact } from '../engine/attendance'

const MAX_PLAN_RANGES = 5

interface Props {
  slots: SlotDetail[]
  overrides: DateOverride[]
  holidays: Set<string>
  plan: LeaveRange[]
  onAddRange: (range: Omit<LeaveRange, 'id'>) => void
  onRemoveRange: (id: string) => void
  onEditPlan: () => void
}

export default function TripPlanner({ slots, overrides, holidays, plan, onAddRange, onRemoveRange, onEditPlan }: Props) {
  const [maxDays, setMaxDays] = useState(21)
  const [rpLeaves, setRpLeaves] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  const validPlan = useMemo(
    () => plan.filter(r => r.startDate && r.endDate && r.startDate <= r.endDate),
    [plan]
  )

  const windows = useMemo(() => {
    if (slots.length === 0) return []
    return findVacationWindows(slots, holidays, maxDays, overrides, rpLeaves, validPlan)
  }, [slots, holidays, maxDays, overrides, rpLeaves, validPlan])

  const planImpact = useMemo(
    () => validPlan.length > 0
      ? computeLeavePlanImpact(slots, holidays, validPlan, overrides, rpLeaves)
      : null,
    [slots, holidays, validPlan, overrides, rpLeaves]
  )
  const planHasOverlaps = useMemo(() => {
    for (let i = 0; i < validPlan.length; i++) {
      for (let j = i + 1; j < validPlan.length; j++) {
        if (validPlan[i].startDate <= validPlan[j].endDate && validPlan[j].startDate <= validPlan[i].endDate) {
          return true
        }
      }
    }
    return false
  }, [validPlan])

  const zoneTextColors = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }
  const zoneCardColors = {
    green: 'border-green-500 bg-green-50',
    amber: 'border-amber-500 bg-amber-50',
    red: 'border-red-500 bg-red-50',
  }

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key)
  }

  const isAlreadyInPlan = (startDate: string, endDate: string) =>
    validPlan.some(r => r.startDate === startDate && r.endDate === endDate)

  return (
    <div className="space-y-6">
      {/* Pinned: My leave plan */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">My leave plan</h2>
          {planImpact && (
            <div className="text-right">
              <span className={`text-lg font-bold ${zoneTextColors[planImpact.overallFinalZone]}`}>
                {planImpact.overallFinal}%
              </span>
              <span className="text-xs text-gray-400 ml-1">projected</span>
            </div>
          )}
        </div>

        {validPlan.length === 0 ? (
          <p className="text-xs text-gray-400">
            No leave plan yet — pick a window below and tap “Add to plan”.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {validPlan.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-700">
                    {formatDate(r.startDate)} &mdash; {formatDate(r.endDate)}
                  </span>
                  <button
                    onClick={() => onRemoveRange(r.id)}
                    className="ml-auto text-gray-400 hover:text-red-600 transition-colors"
                    aria-label={`Remove range ${r.startDate} to ${r.endDate} from plan`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {planHasOverlaps && (
              <p className="mt-2 text-xs text-amber-600">
                Some ranges overlap — overlapping dates are counted once.
              </p>
            )}
            {planImpact && (
              <p className="mt-1 text-xs text-gray-400">
                Combined {planImpact.daysCount} days · {planImpact.sessionsMissed} sessions missed ·{' '}
                {planImpact.overallAfter}% if term ended today
              </p>
            )}
            <button
              onClick={onEditPlan}
              className="mt-3 w-full px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              Edit plan in What-If
            </button>
          </>
        )}
      </div>

      {/* Search controls */}
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
        <div className="space-y-3">
          {windows.map((w) => {
            const key = `${w.startDate}-${w.endDate}`
            const isExpanded = expanded === key
            const inPlan = isAlreadyInPlan(w.startDate, w.endDate)
            const planFull = validPlan.length >= MAX_PLAN_RANGES

            return (
              <div
                key={key}
                className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${zoneCardColors[w.overallFinalZone]}`}
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
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm text-gray-400">{w.overallBefore}%</span>
                  <span className="text-gray-300">&rarr;</span>
                  <span className={`text-sm font-bold ${zoneTextColors[w.overallFinalZone]}`}>
                    {w.overallFinal}%
                  </span>
                  <span className="text-xs text-gray-400">
                    (if term ended: {w.overallAfter}%) · {w.sessionsMissed} sessions · {w.hoursMissed}h missed
                  </span>
                  <button
                    onClick={() => onAddRange({ startDate: w.startDate, endDate: w.endDate })}
                    disabled={inPlan || planFull}
                    className={`ml-auto text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                      inPlan
                        ? 'bg-green-50 text-green-600'
                        : planFull
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {inPlan ? '✓ In plan' : planFull ? 'Plan full' : '+ Add to plan'}
                  </button>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800"
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
                      const projZone = data.projected >= 80 ? 'green' : data.projected >= 75 ? 'amber' : 'red'
                      return (
                        <div key={code} className="flex items-center justify-between py-1 text-xs">
                          <span className="font-medium">{code}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">{data.before}%</span>
                            <span className="text-gray-300">&rarr;</span>
                            {isActivity ? (
                              <span className="font-bold px-2 py-0.5 rounded text-gray-500 bg-gray-50">
                                {data.projected}%
                              </span>
                            ) : (
                              <span className={`font-bold px-2 py-0.5 rounded ${
                                projZone === 'green' ? 'text-green-600 bg-green-50' :
                                projZone === 'amber' ? 'text-amber-600 bg-amber-50' :
                                'text-red-600 bg-red-50'
                              }`}>
                                {data.projected}%
                              </span>
                            )}
                            <span className="text-gray-400 w-20 text-right">
                              miss {data.missedClasses} classes ({data.missedHours}h)
                            </span>
                            {!isActivity && (
                              <span className="text-gray-400 w-28 text-right">
                                budget {data.remainingBudgetSessions} classes ({data.remainingBudget}h)
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-[11px] text-gray-400 pt-1">
                      % shown is the projected attendance if you attend every non-leave class. A subject that
                      stays ≥80% before the trip is never offered with a trip that drops it below 80%.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
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