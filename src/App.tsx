import { useState, useMemo } from 'react'
import { useAttendanceStore } from './store/useAttendanceStore'
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

  const importExportProps = {
    onImport: store.importData,
    onClear: store.clearAll,
    onAddOverride: store.addOverride,
    onRemoveOverride: store.removeOverride,
    hasData: store.hasData,
    overrides: store.overrides,
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
        {tab === 'dashboard' && <Dashboard slots={store.slots} overrides={store.overrides} />}
        {tab === 'whatif' && <WhatIfCalendar slots={store.slots} overrides={store.overrides} holidays={holidays} />}
        {tab === 'trip' && <TripPlanner slots={store.slots} overrides={store.overrides} holidays={holidays} />}
        {tab === 'settings' && <ImportExport {...importExportProps} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-2">
        <div className="max-w-lg mx-auto flex justify-around">
          {([
            ['dashboard', 'Dashboard'],
            ['whatif', 'What-If'],
            ['trip', 'Trip'],
            ['settings', 'Settings'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center px-3 py-1 text-xs rounded-lg ${
                tab === id ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
