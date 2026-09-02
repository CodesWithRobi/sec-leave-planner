import { useMemo } from 'react'
import type { SlotDetail, DateOverride, HolidayWindow } from '../engine/types'
import { computeSlotStats, computeOverallStats, sessionHours, isSessionCancelled, preloadedHolidays } from '../engine/attendance'

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

function ProgressBar({ percentage }: { percentage: number }) {
  const color = percentage >= 80 ? 'bg-green-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(percentage, 100)}%` }} />
    </div>
  )
}

export default function Dashboard({ slots, overrides }: Props) {
  const holidays = useMemo(() => {
    const { dates, windows } = preloadedHolidays()
    overrides.forEach(o => {
      if (o.type === 'holiday' || o.type === 'no_class') dates.add(o.date)
      if (o.type === 'class_happened') dates.delete(o.date)
    })
    return { dates, windows }
  }, [overrides])
  const holidaySet = holidays.dates
  const holidayWindows: HolidayWindow[] = holidays.windows

  const overall = useMemo(() => computeOverallStats(slots, holidaySet, false, holidayWindows), [slots, holidaySet, holidayWindows])

  // Overall safe misses: sessions you can miss before the 80% floor (count-based)
  const safeMisses = overall.budgetSessions

  // SDCP scenario analysis
  const sdcpScenario = useMemo(() => {
    let allPresent = 0, allConducted = 0, allRemaining = 0
    let sdcpRemaining = 0
    for (const sd of slots) {
      const present = sd.sessions.filter(s => s.status === 'PRESENT')
      const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
      const future = sd.sessions.filter(s => s.status === 'UPCOMING' && !isSessionCancelled(s, holidaySet, holidayWindows))
      const p = present.reduce((sum, s) => sum + sessionHours(s), 0)
      const c = conducted.reduce((sum, s) => sum + sessionHours(s), 0)
      const f = future.reduce((sum, s) => sum + sessionHours(s), 0)
      allPresent += p; allConducted += c; allRemaining += f
      if (sd.slot.subjectCode === 'SDCP' && sd.slot.isActivity) {
        sdcpRemaining += f
      }
    }

    if (sdcpRemaining === 0) return null

    // Max SDCP hours can miss before overall hits 80%
    const maxMissHours = allPresent + allRemaining - 0.8 * (allConducted + allRemaining)
    const maxMissClasses = Math.max(0, Math.floor(maxMissHours))

    // Overall if attend ALL remaining
    const ifAttendAll = Math.round((allPresent + allRemaining) / (allConducted + allRemaining) * 10000) / 100

    // Overall if skip all remaining SDCP
    const ifSkipSdcp = Math.round((allPresent + allRemaining - sdcpRemaining) / (allConducted + allRemaining) * 10000) / 100

    return { maxMissClasses, sdcpRemaining, ifAttendAll, ifSkipSdcp }
  }, [slots, holidaySet, holidayWindows])

  const subjectStats = useMemo(() =>
    slots
      .filter(s => !s.slot.isActivity)
      .map(s => ({
        ...s,
        stats: computeSlotStats(s, holidaySet, holidayWindows),
      }))
      .sort((a, b) => a.stats.percentage - b.stats.percentage),
    [slots, holidaySet, holidayWindows]
  )

  // Activity hours detail
  const activityItems = useMemo(() =>
    slots
      .filter(s => s.slot.isActivity)
      .map(sd => {
        const present = sd.sessions.filter(s => s.status === 'PRESENT')
        const conducted = sd.sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT')
        const future = sd.sessions.filter(s => s.status === 'UPCOMING' && !isSessionCancelled(s, holidaySet, holidayWindows))
        return {
          slot: sd.slot,
          attended: present.reduce((sum, s) => sum + sessionHours(s), 0),
          total: conducted.reduce((sum, s) => sum + sessionHours(s), 0),
          remaining: future.reduce((sum, s) => sum + sessionHours(s), 0),
          remainingClasses: future.length,
        }
      }),
    [slots, holidaySet, holidayWindows]
  )

  return (
    <div className="space-y-5">

      {/* ── Overall Attendance ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-gray-500">Overall Attendance</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${ZONE_COLORS[overall.zone]}`}>
            {overall.zone === 'green' ? 'Safe' : overall.zone === 'amber' ? 'Condonation risk' : 'Detained'}
          </span>
        </div>

        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold ${ZONE_TEXT[overall.zone]}`}>
            {overall.percentage}%
          </span>
        </div>

        <ProgressBar percentage={overall.percentage} />

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Attended</div>
            <div className="font-bold text-sm">{overall.presentSessions} classes ({overall.presentHours}h)</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Left</div>
            <div className="font-bold text-sm">{overall.remainingSessions} classes ({overall.remainingHours}h)</div>
          </div>
          <div className={`rounded-xl p-3 text-center ${overall.budgetHours > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="text-xs text-gray-500 mb-1">Can still miss</div>
            <div className={`font-bold text-sm ${overall.budgetHours > 0 ? 'text-green-700' : 'text-red-700'}`}>
              {safeMisses} classes
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-400 text-center">
          You can miss {safeMisses} more classes and still stay at 80%
        </div>
      </div>

      {/* ── SDCP ── */}
      {sdcpScenario && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-1">SDCP (1hr each)</h2>

          <div className="flex items-end gap-3">
            <span className={`text-4xl font-bold ${sdcpScenario.maxMissClasses <= 2 ? 'text-red-600' : sdcpScenario.maxMissClasses <= 4 ? 'text-amber-600' : 'text-green-600'}`}>
              {sdcpScenario.maxMissClasses}
            </span>
            <span className="text-sm text-gray-400 mb-1">classes you can skip</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">before your overall drops below 80%</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
              <div className="text-xs text-green-600 mb-1">Attend all</div>
              <div className="font-bold text-green-700">{sdcpScenario.ifAttendAll}%</div>
            </div>
            <div className={`rounded-xl p-3 text-center border ${sdcpScenario.ifSkipSdcp >= 80 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
              <div className={`text-xs mb-1 ${sdcpScenario.ifSkipSdcp >= 80 ? 'text-amber-600' : 'text-red-600'}`}>Skip all SDCP</div>
              <div className={`font-bold ${sdcpScenario.ifSkipSdcp >= 80 ? 'text-amber-700' : 'text-red-700'}`}>{sdcpScenario.ifSkipSdcp}%</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-400 text-center">
            If you ditch all {sdcpScenario.sdcpRemaining}h of remaining SDCP, overall becomes {sdcpScenario.ifSkipSdcp}%
          </div>
        </div>
      )}

      {/* ── Per Subject ── */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">Per Subject</h2>
        <div className="grid gap-2.5">
          {subjectStats.map(({ slot: s, stats }) => {
            const sMisses = Math.max(0, stats.budgetSessions)
            const isDanger = stats.percentage < 80
            return (
              <div key={s.id} className={`bg-white rounded-xl p-4 shadow-sm border ${isDanger ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.subjectCode}</span>
                      {isDanger && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">below 80%</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.subjectName}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <span className={`text-lg font-bold ${ZONE_TEXT[stats.zone]}`}>{stats.percentage}%</span>
                      <div className="text-[10px] text-gray-400">
                        {stats.presentSessions} classes ({stats.presentHours}h) / {stats.totalSessions} classes ({stats.totalHours}h)
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {stats.remainingSessions} classes ({stats.remainingHours}h) left
                      </div>
                    </div>
                    <div className={`w-2 h-10 rounded-full ${ZONE_COLORS[stats.zone]}`} />
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar percentage={stats.percentage} />
                  <div className={`text-xs mt-1.5 ${isDanger ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {isDanger
                      ? `At risk — only ${sMisses} classes left to miss`
                      : `${sMisses} classes left to miss`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Activities ── */}
      {activityItems.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-1">Activities</h2>
          <p className="text-xs text-gray-400 mb-3">These don't count per subject, but they boost your overall %</p>
          <div className="grid gap-2">
            {activityItems.map(i => (
              <div key={i.slot.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <div>
                  <span className="text-gray-700 font-medium text-sm">{i.slot.subjectCode}</span>
                  <span className="text-gray-400 ml-2 text-xs">{i.slot.subjectName}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {i.attended}/{i.total}h · {i.remaining > 0 ? `${i.remainingClasses} classes (${i.remaining}h) left` : 'done'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
