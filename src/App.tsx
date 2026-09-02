import { useState, useMemo } from 'react'
import { useAttendanceStore } from './store/useAttendanceStore'
import { applyODs, preloadedHolidays } from './engine/attendance'
import Dashboard from './components/Dashboard'
import WhatIfCalendar from './components/WhatIfCalendar'
import TripPlanner from './components/TripPlanner'
import ImportExport from './components/ImportExport'

type Tab = 'dashboard' | 'whatif' | 'trip' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const store = useAttendanceStore()

  const holidays = useMemo(() => {
    const h = preloadedHolidays()
    store.overrides.forEach(o => {
      if (o.type === 'holiday' || o.type === 'no_class') h.dates.add(o.date)
      if (o.type === 'class_happened') h.dates.delete(o.date)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">SEC Leave Planner</h1>
            <p className="text-xs text-gray-500">Saveetha Engineering College</p>
          </div>
          <SocialLinks />
        </div>
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
          <SocialLinks />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {tab === 'dashboard' && <Dashboard slots={effectiveSlots} overrides={store.overrides} />}
        {tab === 'whatif' && (
          <WhatIfCalendar
            slots={effectiveSlots}
            overrides={store.overrides}
            holidays={holidays.dates}
            holidayWindows={holidays.windows}
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
            holidays={holidays.dates}
            holidayWindows={holidays.windows}
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

function SocialLinks() {
  return (
    <div className="flex items-center gap-2">
      <a
        href="https://www.linkedin.com/in/codeswithrobi/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="LinkedIn"
        title="LinkedIn"
        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent transition-colors"
      >
        <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>
      <a
        href="https://github.com/codesWithRobi"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
        title="GitHub"
        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-transparent transition-colors"
      >
        <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
    </div>
  )
}
