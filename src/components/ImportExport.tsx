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

// The bookmarklet — formatted for readability, minified at runtime
const BOOKMARKLET_RAW = `
(async function() {
  const TERM_ID = 8;

  // 1. Fetch slot list
  const slotsResp = await fetch('/academics/calculate-my-attendance/slots/?term_id=' + TERM_ID);
  const slotsJson = await slotsResp.json();

  const slots = [];

  for (const sl of slotsJson.results) {
    // 2. Fetch each slot's attendance page (HTML)
    const pageResp = await fetch(
      '/academics/calculate-my-attendance/?term_id=' + TERM_ID +
      '&slot_id=' + sl.id + '&action=calculate'
    );
    const html = await pageResp.text();

    // 3. Parse the HTML table
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table tbody tr')];

    const sessions = rows.map(row => {
      const cells = [...row.querySelectorAll('td')].map(td => td.innerText.trim());
      const timing = cells[2] || '';
      return {
        date: cells[0],       // "17 Jul 2026"
        time: cells[1],       // "10:00 - 11:59"
        timing: timing,       // "CLS10-12"
        location: cells[3],   // "6731"
        status: cells[4],     // "PRESENT" / "ABSENT" / "HOLIDAY" / "UPCOMING"
        calculation: cells[5] // "Counts 2.00 as Present"
      };
    });

    // 4. Compute hours from timing code
    function calcHours(t) {
      if (t.startsWith('MENTOR MEET')) return 1.5;
      if (t.startsWith('SWH')) return 1;
      const m = t.match(/CLS(\\d+)-(\\d+)/);
      if (m) return parseInt(m[2]) - parseInt(m[1]);
      return 2;
    }

    const present = sessions.filter(s => s.status === 'PRESENT');
    const conducted = sessions.filter(s => s.status === 'PRESENT' || s.status === 'ABSENT');
    const presentHours = present.reduce((sum, s) => sum + calcHours(s.timing), 0);
    const totalHours = conducted.reduce((sum, s) => sum + calcHours(s.timing), 0);

    slots.push({
      slot: {
        id: sl.id,
        slotName: sl.slot_name,
        subjectCode: sl.subject_code,
        subjectName: sl.subject_name,
        isActivity: sl.subject_code.startsWith('ECA') || sl.subject_code.startsWith('SDCP')
      },
      sessions: sessions.map(s => ({
        ...s,
        hours: calcHours(s.timing)
      })),
      stats: {
        presentHours: presentHours,
        totalHours: totalHours,
        percentage: totalHours > 0 ? Math.round(presentHours / totalHours * 10000) / 100 : 100
      }
    });
  }

  // 5. Build final JSON
  var data = {
    student: '23014011',
    termId: TERM_ID,
    fetchedAt: new Date().toISOString(),
    slots: slots
  };

  // 6. Inject textarea with JSON pre-selected for easy copy
  var ta = document.createElement('textarea');
  ta.value = JSON.stringify(data, null, 2);
  ta.style.cssText = 'position:fixed;top:10px;left:10px;width:90vw;height:80vh;z-index:999999;font-size:12px;padding:8px;border:2px solid #333;background:#fff;color:#000;';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  alert(
    'Attendance exported!\\n\\n' +
    'A text box with your JSON is on the page.\\n' +
    'Press Ctrl+A then Ctrl+C to copy it.\\n\\n' +
    'Then go to SEC Leave Planner -> Settings -> Paste JSON to import.\\n\\n' +
    'Tip: If Chrome shows "Allow pasting" when you try to paste code\\n' +
    'in the console, type "allow pasting" and press Enter first.'
  );
})();
`.trim()

// Minify for actual execution
const BOOKMARKLET_MINIFIED = 'javascript:void ' + BOOKMARKLET_RAW
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\n\s*/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()

export default function ImportExport({ onImport, onClear, hasData, overrides, onAddOverride, onRemoveOverride }: Props) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [newHoliday, setNewHoliday] = useState('')
  const [newReason, setNewReason] = useState('')
  const [showCode, setShowCode] = useState(false)

  const handlePaste = () => {
    setError('')
    try {
      const data = JSON.parse(pasteText) as AttendanceData
      if (!data.slots || !Array.isArray(data.slots)) throw new Error('Invalid format')
      onImport(data)
      setPasteText('')
    } catch (e: any) {
      setError(e.message || 'Failed to parse pasted data')
    }
  }

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET_MINIFIED)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select textarea
      const ta = document.createElement('textarea')
      ta.value = BOOKMARKLET_MINIFIED
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
      {/* Bookmarklet */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Import from learner.saveetha.in</h2>

        <div className="space-y-3 text-xs text-gray-600">
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">1.</span>
            <span>Open <a href="https://learner.saveetha.in/academics/calculate-my-attendance/" target="_blank" className="text-blue-600 underline">learner.saveetha.in/attendance</a> and log in</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">2.</span>
            <span>Open browser console (F12 → Console tab)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">3.</span>
            <span>Paste the code below and press Enter. <strong>If Chrome shows "Allow pasting", type <code className="bg-gray-100 px-1 rounded">allow pasting</code> and press Enter first</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">4.</span>
            <span>A text box appears with your JSON. Select all (Ctrl+A), copy (Ctrl+C)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">5.</span>
            <span>Come back here and paste (Ctrl+V) into the box below</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={copyBookmarklet}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {copied ? 'Copied!' : 'Copy bookmarklet code'}
          </button>
          <button
            onClick={() => setShowCode(!showCode)}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            {showCode ? 'Hide code' : 'Show code'}
          </button>
        </div>

        {showCode && (
          <pre className="mt-3 bg-gray-900 text-gray-100 rounded-lg p-4 text-[11px] leading-relaxed overflow-x-auto max-h-96 overflow-y-auto">
            <code>{BOOKMARKLET_RAW}</code>
          </pre>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Works only on learner.saveetha.in (same-origin). Fetches all 7 slots, parses tables, exports JSON.
        </p>
      </div>

      {/* Paste */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Paste JSON</h2>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder='Paste the JSON from clipboard here (Ctrl+V)...'
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
