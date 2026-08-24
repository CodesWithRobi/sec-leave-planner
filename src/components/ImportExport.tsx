import { useRef, useState } from 'react'
import type { AttendanceData, DateOverride } from '../engine/types'

interface Props {
  onImport: (data: AttendanceData) => void
  onClear: () => void
  hasData: boolean
  overrides: DateOverride[]
  onAddOverride: (o: DateOverride) => void
  onRemoveOverride: (date: string) => void
}

export default function ImportExport({ onImport, onClear, hasData, overrides, onAddOverride, onRemoveOverride }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [newHoliday, setNewHoliday] = useState('')
  const [newReason, setNewReason] = useState('')

  const handleFile = (file: File) => {
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as AttendanceData
        if (!data.slots || !Array.isArray(data.slots)) throw new Error('Invalid format')
        onImport(data)
      } catch (e: any) {
        setError(e.message || 'Failed to parse file')
      }
    }
    reader.readAsText(file)
  }

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
        <p className="text-xs text-gray-500 mb-4">
          Log into learner.saveetha.in, open browser console (F12), paste and run this bookmarklet:
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto">
          {BOOKMARKLET_CODE.slice(0, 120)}...
        </div>
        <p className="text-xs text-gray-400 mt-2">
          It copies JSON to clipboard and downloads a file. Then paste or upload below.
        </p>
      </div>

      {/* Paste */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Paste JSON</h2>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder='{"student":"23014011", "slots":[...]}'
          className="w-full h-32 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handlePaste}
          disabled={!pasteText.trim()}
          className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Import
        </button>
      </div>

      {/* File upload */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Upload JSON file</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
        >
          Choose file
        </button>
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
          <div>Aug 26 (Wed) &mdash; Milad-un-Nabi</div>
          <div>Sep 4 (Fri) &mdash; Krishna Jayanthi</div>
          <div>Sep 14 (Mon) &mdash; Vinayagar Chathurthi</div>
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

const BOOKMARKLET_CODE = `javascript:void fetch('/academics/calculate-my-attendance/slots/?term_id=8').then(r=>r.json()).then(async s=>{const slots=[];for(const sl of s.results){const p=new DOMParser();const d=await fetch('/academics/calculate-my-attendance/?term_id=8&slot_id='+sl.id+'&action=calculate').then(r=>r.text());const doc=p.parseFromString(d,'text/html');const rows=[...doc.querySelectorAll('table tbody tr')];const sessions=rows.map(r=>{const c=[...r.querySelectorAll('td')].map(t=>t.innerText.trim());return{date:c[0],time:c[1],timing:c[2],location:c[3],status:c[4],calculation:c[5]}});const present=sessions.filter(s=>s.status==='PRESENT').length;const total=sessions.filter(s=>['PRESENT','ABSENT'].includes(s.status)).length;slots.push({slot:{id:sl.id,slotName:sl.slot_name,subjectCode:sl.subject_code,subjectName:sl.subject_name},sessions,stats:{presentHours:present*2,totalHours:total*2,percentage:total?Math.round(present/total*10000)/100:0}})};const data={student:'23014011',termId:8,fetchedAt:new Date().toISOString(),slots};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='attendance.json';a.click();navigator.clipboard.writeText(JSON.stringify(data));alert('Attendance exported! JSON copied to clipboard and file downloaded.')})`
