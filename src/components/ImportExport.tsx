import { useState } from 'react'
import type { AttendanceData, DateOverride } from '../engine/types'

interface Props {
  onImport: (data: AttendanceData) => void
  onClear: () => void
  hasData: boolean
  overrides: DateOverride[]
  onAddOverride: (o: DateOverride) => void
  onRemoveOverride: (date: string) => void
}

// The bookmark is a TINY loader — it injects the real logic from /bookmarklet.js
// on GitHub Pages. Small URL = no truncation/encoding issues, and logic updates
// reach every user without re-dragging the bookmark.
const BOOKMARKLET_SCRIPT = '(function(){var s=document.createElement("script");s.src="https://codeswithrobi.github.io/sec-leave-planner/bookmarklet.js?v=1";s.onerror=function(){alert("SEC Attendance: could not load script from GitHub Pages. Check your internet connection.");};document.body.appendChild(s);})();'

// URL-encoded for maximum browser compatibility (see research: unencoded
// bookmarklets fail silently on special characters in some browsers)
const BOOKMARKLET_URL = 'javascript:' + encodeURIComponent(BOOKMARKLET_SCRIPT)

export default function ImportExport({ onImport, onClear, hasData, overrides, onAddOverride, onRemoveOverride }: Props) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [newHoliday, setNewHoliday] = useState('')
  const [newReason, setNewReason] = useState('')
  const [urlCopied, setUrlCopied] = useState(false)

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
            href={BOOKMARKLET_URL}
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
            <span>No toast? A red toast shows the error — tell us what it says. If a blue box opens instead, select all (Ctrl+A) and copy (Ctrl+C).</span>
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
        <div className="flex gap-2 mb-3">
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
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={addHoliday}
            disabled={!newHoliday}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
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

      {/* Preloaded holidays */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Preloaded Holidays (Term 1)</h2>
        <div className="text-sm space-y-1">
          <div>Aug 26 (Wed) — Milad-un-Nabi</div>
          <div>Sep 4 (Fri) — Krishna Jayanthi</div>
          <div>Sep 14 (Mon) — Vinayagar Chathurthi</div>
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