import { useState, useMemo } from 'react'
import { useAttendanceStore } from './store/useAttendanceStore'
import { applyODs } from './engine/attendance'
import Dashboard from './components/Dashboard'
import WhatIfCalendar from './components/WhatIfCalendar'
import TripPlanner from './components/TripPlanner'
import ImportExport from './components/ImportExport'

type Tab = 'dashboard' | 'whatif' | 'trip' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const store = useAttendanceStore()

  const holidays = useMemo(() => {
    const h = new Set(['2026-08-26', '2026-09-04', '2026-09-14'])
    store.overrides.forEach(o => {
      if (o.type === 'holiday' || o.type === 'no_class') h.add(o.date)
      if (o.type === 'class_happened') h.delete(o.date)
    })
    return h
  }, [store.overrides])

  // Sessions as the user's world actually is: OD entries are applied once at
  // the boundary so every tab (Dashboard, What-If, Trip) sees them. The leave
  // engine re-applies overrides on top of these and can never un-present an
  // OD-covered session. Dashboard's dates stay "holiday" for upcoming math.
  const effectiveSlots = useMemo(
    () => store.slots.map(sd => ({ ...sd, sessions: applyODs(sd.sessions, store.odEntries) })),
    [store.slots, store.odEntries],
  )

  const importExportProps = {
    onImport: store.importData,
    onClear: store.clearAll,
    onAddOverride: store.addOverride,
    onRemoveOverride: store.removeOverride,
    hasData: store.hasData,
    overrides: store.overrides,
    odEntries: store.odEntries,
    onAddOD: store.addOD,
    onUpdateOD: store.updateOD,
    onRemoveOD: store.removeOD,
  }

  if (!store.hasData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900">SEC Leave Planner</h1>
          <p className="text-xs text-gray-500">Saveetha Engineering College</p>
        </header>
        <main className="max-w-lg mx-auto px-4 py-8">
          <ImportExport {...importExportProps} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">SEC Leave Planner</h1>
            <p className="text-xs text-gray-500">{store.student || 'Student'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {tab === 'dashboard' && <Dashboard slots={effectiveSlots} overrides={store.overrides} />}
        {tab === 'whatif' && (
          <WhatIfCalendar
            slots={effectiveSlots}
            overrides={store.overrides}
            holidays={holidays}
            plan={store.leavePlan}
            onAddRange={store.addLeaveRange}
            onUpdateRange={store.updateLeaveRange}
            onRemoveRange={store.removeLeaveRange}
          />
        )}
        {tab === 'trip' && (
          <TripPlanner
            slots={effectiveSlots}
            overrides={store.overrides}
            holidays={holidays}
            plan={store.leavePlan}
            onAddRange={store.addLeaveRange}
            onRemoveRange={store.removeLeaveRange}
            onEditPlan={() => setTab('whatif')}
          />
        )}
        {tab === 'settings' && <ImportExport {...importExportProps} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-2 py-1 safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-around">
          {([
            ['dashboard', 'Dashboard', 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1'],
            ['whatif', 'What-If', 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'],
            ['trip', 'Trip', 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'],
            ['settings', 'Settings', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
          ] as [Tab, string, string][]).map(([id, label, path]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                tab === id
                  ? 'text-blue-600 bg-blue-50 font-semibold'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={path} />
              </svg>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
