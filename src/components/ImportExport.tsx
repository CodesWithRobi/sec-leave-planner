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

// The bookmarklet as a javascript: URL — drag this to your bookmarks bar
const BOOKMARKLET_URL = `javascript:void ` + `(async function(){var T=8;var r=await fetch("/academics/calculate-my-attendance/slots/?term_id="+T);var j=await r.json();var s=[];for(var i of j.results){var p=await fetch("/academics/calculate-my-attendance/?term_id="+T+"&slot_id="+i.id+"&action=calculate");var h=await p.text();var d=new DOMParser().parseFromString(h,"text/html");var rows=[...d.querySelectorAll("table tbody tr")];function calcHours(t){if(t.startsWith("MENTOR MEET"))return 1.5;if(t.startsWith("SWH"))return 1;var m=t.match(/CLS(\\d+)-(\\d+)/);if(m)return parseInt(m[2])-parseInt(m[1]);return 2;}var sess=rows.map(function(row){var c=[...row.querySelectorAll("td")].map(function(td){return td.innerText.trim()});return{date:c[0],time:c[1],timing:c[2]||"",location:c[3],status:c[4],calculation:c[5]}});var pr=sess.filter(function(x){return x.status==="PRESENT"});var cd=sess.filter(function(x){return x.status==="PRESENT"||x.status==="ABSENT"});s.push({slot:{id:i.id,slotName:i.slot_name,subjectCode:i.subject_code,subjectName:i.subject_name,isActivity:i.subject_code.startsWith("ECA")||i.subject_code.startsWith("SDCP")},sessions:sess.map(function(x){return Object.assign({},x,{hours:calcHours(x.timing)})}),stats:{presentHours:pr.reduce(function(a,x){return a+calcHours(x.timing)},0),totalHours:cd.reduce(function(a,x){return a+calcHours(x.timing)},0),percentage:0}});}var pf=document.body.innerText;var rm=pf.match(/Ref2:\\s*(\\d+)/);var st=rm?rm[1]:"unknown";var data={student:st,termId:T,fetchedAt:new Date().toISOString(),slots:s};var json=JSON.stringify(data,null,2);var ta=document.createElement("textarea");ta.value=json;ta.style.cssText="position:fixed;left:-9999px;top:-9999px;";document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,json.length);document.execCommand("copy");document.body.removeChild(ta);var toast=document.createElement("div");toast.textContent="Copied! Paste in SEC Leave Planner ("+s.length+" subjects)";toast.style.cssText="position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);";document.body.appendChild(toast);setTimeout(function(){toast.remove()},4000);})()`

export default function ImportExport({ onImport, onClear, hasData, overrides, onAddOverride, onRemoveOverride }: Props) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [newHoliday, setNewHoliday] = useState('')
  const [newReason, setNewReason] = useState('')

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
            <span>A green toast appears — your data is now on the clipboard</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-gray-900">6.</span>
            <span>Come back here and paste (<strong>Ctrl+V</strong>) into the box below</span>
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
