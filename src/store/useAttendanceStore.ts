import { useState, useCallback, useEffect } from 'react'
import type { SlotDetail, DateOverride, AttendanceData } from '../engine/types'

const STORAGE_KEY = 'sec-leave-planner-data'
const OVERRIDES_KEY = 'sec-leave-overrides'

export function useAttendanceStore() {
  const [slots, setSlots] = useState<SlotDetail[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const [overrides, setOverrides] = useState<DateOverride[]>(() => {
    try {
      const raw = localStorage.getItem(OVERRIDES_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const [student, setStudent] = useState<string>(() => {
    return localStorage.getItem('sec-leave-student') || ''
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
  }, [slots])

  useEffect(() => {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
  }, [overrides])

  useEffect(() => {
    localStorage.setItem('sec-leave-student', student)
  }, [student])

  const importData = useCallback((data: AttendanceData) => {
    setSlots(data.slots)
    setStudent(data.student)
  }, [])

  const addOverride = useCallback((override: DateOverride) => {
    setOverrides(prev => {
      const filtered = prev.filter(o => o.date !== override.date)
      return [...filtered, override]
    })
  }, [])

  const removeOverride = useCallback((date: string) => {
    setOverrides(prev => prev.filter(o => o.date !== date))
  }, [])

  const clearAll = useCallback(() => {
    setSlots([])
    setOverrides([])
    setStudent('')
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(OVERRIDES_KEY)
    localStorage.removeItem('sec-leave-student')
  }, [])

  return {
    slots,
    overrides,
    student,
    importData,
    addOverride,
    removeOverride,
    clearAll,
    hasData: slots.length > 0,
  }
}
