import { useLayoutEffect, useRef, useState } from 'react'
import { BOOKMARKLET_URL } from '../bookmarklet'
import { DEFAULT_HOLIDAYS } from '../engine/attendance'
import type { AttendanceData, DateOverride, ODEntry } from '../engine/types'

interface Props {
  onImport: (data: AttendanceData) => void
  onClear: () => void
  hasData: boolean
  overrides: DateOverride[]
  onAddOverride: (o: DateOverride) => void
  onRemoveOverride: (date: string) => void
  odEntries: ODEntry[]
  onAddOD: (o: Omit<ODEntry, 'id'>) => void
  onUpdateOD: (o: ODEntry) => void
  onRemoveOD: (id: string) => void
}

const MAX_OD = 10

export default function ImportExport({ onImport, onClear, hasData, overrides, onAddOverride, onRemoveOverride, odEntries, onAddOD, onUpdateOD, onRemoveOD }: Props) {
  // React 19 blocks javascript: URLs as JSX href props (rewrites them to a
  // thrown security error — which is exactly what got dragged to the user's
  // bookmarks bar). So the href is injected directly into the DOM via
  // setAttribute, outside React's prop system.
  const bookmarkletRef = useRef<HTMLAnchorElement>(null)
  useLayoutEffect(() => {
    bookmarkletRef.current?.setAttribute('href', BOOKMARKLET_URL)
  }, [])

  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [newHoliday, setNewHoliday] = useState('')
  const [newReason, setNewReason] = useState('')
  const [urlCopied, setUrlCopied] = useState(false)
  const [newOD, setNewOD] = useState({ startDate: '', endDate: '', startTime: '', endTime: '' })
  const [odError, setOdError] = useState('')

  const odValid = (o: { startDate: string; endDate: string; startTime: string; endTime: string }) => {
    if (!o.startDate || !o.endDate) return false
    if (o.startDate > o.endDate) return false
    if ((o.startTime && !o.endTime) || (!o.startTime && o.endTime)) return false // both or neither
    if (o.startTime && o.endTime && o.startTime >= o.endTime) return false
    return true
  }

  const addOD = () => {
    setOdError('')
    if (!odValid(newOD)) {
      setOdError('Enter a valid range: dates required (start before end) and either both times or no times.')
      return
    }
    onAddOD({
      startDate: newOD.startDate,
      endDate: newOD.endDate,
      startTime: newOD.startTime || undefined,
      endTime: newOD.endTime || undefined,
    })
    setNewOD({ startDate: '', endDate: '', startTime: '', endTime: '' })
  }

  const handlePaste = () => {
    setError('')
    try {
      const data = JSON.parse(pasteText) as AttendanceData
      if (!data.slots || !Array.isArray(data.slots)) {
        setError('Invalid format: missing slots array')
        return
      }
      onImport(data)
      setPasteText('')
    } catch (e: any) {
      setError(e.message || 'Failed to parse JSON')
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_URL)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    } catch {
      setError('Could not copy URL — select it manually below')
    }
  }

  const addHoliday = () => {
    if (!newHoliday) return
    onAddOverride({
      date: newHoliday,
      type: 'holiday',
      reason: newReason || undefined,
    })
    setNewHoliday('')
    setNewReason('')
  }

  return (
    <div className="space-y-6">
      {/* Bookmarklet — drag to bookmarks bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Import from learner.saveetha.in</h2>

        <div className="space-y-3 text-xs text-gray-600">
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">1.</span>
            <span>Make sure your bookmarks bar is visible (<strong>Ctrl+Shift+B</strong>)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">2.</span>
            <span><strong>Drag</strong> this button to your bookmarks bar:</span>
          </div>
        </div>

        {/* Draggable bookmarklet link */}
        <div className="mt-3 ml-6">
          <a
            ref={bookmarkletRef}
            className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 cursor-grab active:cursor-grabbing select-none"
            title="Drag me to your bookmarks bar"
            onClick={e => e.preventDefault()}
          >
            📋 SEC Attendance
          </a>
          <span className="ml-3 text-xs text-gray-400">← drag this to bookmarks bar</span>
        </div>

        <div className="space-y-3 text-xs text-gray-600 mt-4">
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">3.</span>
            <span>Open <a href="https://learner.saveetha.in/academics/calculate-my-attendance/" target="_blank" className="text-blue-600 underline" rel="noopener noreferrer">learner.saveetha.in/attendance</a> and log in</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">4.</span>
            <span>Click the <strong>"📋 SEC Attendance"</strong> bookmark in your bar</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">5.</span>
            <span>A <strong>green toast</strong> appears: "Copied to clipboard! Paste in SEC Leave Planner"</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">6.</span>
            <span>Come back here and paste (<strong>Ctrl+V</strong>) into the box below</span>
          </div>
          <div className="flex items-start gap-2 text-gray-500">
            <span className="font-bold text-gray-900">Tip:</span>
            <span>A <strong>blue "Extracting attendance…"</strong> toast appears the instant you click — the green "Copied" toast follows when it's done. If you see no blue toast, the bookmarklet didn't run (re-drag it). Double-clicking just shows an orange "already running" note — the export won't restart.</span>
          </div>
        </div>

        {/* Manual setup for mobile / no bookmarks bar */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            Mobile or no bookmarks bar? Copy the bookmark URL, create any bookmark, then edit it and paste this as the URL:
          </p>
          <div className="flex gap-2 items-start">
            <input
              readOnly
              value={BOOKMARKLET_URL}
              onFocus={e => e.target.select()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-500 bg-gray-50"
            />
            <button
              onClick={copyUrl}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 whitespace-nowrap"
            >
              {urlCopied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>
      </div>

      {/* Paste */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Paste JSON</h2>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder="Paste the JSON from clipboard here (Ctrl+V)..."
          className="w-full h-32 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={handlePaste}
            disabled={!pasteText.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Import
          </button>
          {pasteText && (
            <button
              onClick={() => { setPasteText(''); setError('') }}
              className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Holiday overrides */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Holiday Overrides</h2>
        <p className="text-xs text-gray-500 mb-3">
          Add holidays that aren't in the portal (rain holidays, event days, cancelled classes).
        </p>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 mb-3">
          <input
            type="date"
            value={newHoliday}
            onChange={e => setNewHoliday(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            value={newReason}
            onChange={e => setNewReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={addHoliday}
            disabled={!newHoliday}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </div>
        {overrides.length > 0 && (
          <div className="space-y-1">
            {overrides.map(o => (
              <div key={o.date} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {o.date} {o.reason && <span className="text-gray-400">({o.reason})</span>}
                </span>
                <button
                  onClick={() => onRemoveOverride(o.date)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* On Duty (OD) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">On Duty (OD)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Mark sessions as <strong>present</strong> for a date range — optionally limited to a time
          window. Works for past <em>and</em> future sessions (e.g. a known duty day). Holidays stay
          holidays.
        </p>

        {odEntries.length > 0 && (
          <div className="space-y-3 mb-4">
            {odEntries.map(od => {
              const invalid = od.startDate && od.endDate && od.startDate > od.endDate
              return (
                <div key={od.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        value={od.startDate}
                        onChange={e => onUpdateOD({ ...od, startDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="date"
                          value={od.endDate}
                          onChange={e => onUpdateOD({ ...od, endDate: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => onRemoveOD(od.id)}
                        className="px-2.5 py-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                        aria-label={`Remove OD ${od.startDate} to ${od.endDate}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">Time</span>
                    <input
                      type="time"
                      value={od.startTime || ''}
                      onChange={e => onUpdateOD({ ...od, startTime: e.target.value || undefined })}
                      title="Time window start (optional)"
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400 text-xs shrink-0">–</span>
                    <input
                      type="time"
                      value={od.endTime || ''}
                      onChange={e => onUpdateOD({ ...od, endTime: e.target.value || undefined })}
                      title="Time window end (optional)"
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {invalid && <p className="mt-1 text-xs text-red-500">Start must be before end</p>}
                </div>
              )
            })}
          </div>
        )}

        {odEntries.length < MAX_OD && (
          <div className="border border-dashed border-gray-300 rounded-xl p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={newOD.startDate}
                  onChange={e => setNewOD(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={newOD.endDate}
                    onChange={e => setNewOD(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={addOD}
                  disabled={!newOD.startDate || !newOD.endDate}
                  className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">Time</span>
              <input
                type="time"
                value={newOD.startTime}
                onChange={e => setNewOD(prev => ({ ...prev, startTime: e.target.value }))}
                title="Time window start (optional)"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs shrink-0">–</span>
              <input
                type="time"
                value={newOD.endTime}
                onChange={e => setNewOD(prev => ({ ...prev, endTime: e.target.value }))}
                title="Time window end (optional)"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Leave the time empty to cover whole days. Up to {MAX_OD} entries.
            </p>
          </div>
        )}

        {odError && <div className="mt-2 bg-red-50 rounded-xl p-3 text-sm text-red-700">{odError}</div>}
      </div>

      {/* Preloaded holidays */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Preloaded Holidays (Term 1)</h2>
        <div className="text-sm space-y-1">
          {DEFAULT_HOLIDAYS.map(d => <div key={d.date}>{d.label}</div>)}
        </div>
      </div>

      {hasData && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Data Management</h2>
          <button
            onClick={onClear}
            className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"
          >
            Clear all data
          </button>
        </div>
      )}
    </div>
  )
}