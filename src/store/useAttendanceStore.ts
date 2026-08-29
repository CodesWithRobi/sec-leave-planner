import { useState, useCallback, useEffect } from 'react'
import type { SlotDetail, DateOverride, AttendanceData, LeaveRange, ODEntry } from '../engine/types'

const STORAGE_KEY = 'sec-leave-planner-data'
const OVERRIDES_KEY = 'sec-leave-overrides'
const LEAVE_PLAN_KEY = 'sec-leave-plan'
const OD_KEY = 'sec-leave-od'

function newRangeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r${Date.now()}-${Math.random().toString(36).slice(2)}`
}

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

  const [leavePlan, setLeavePlan] = useState<LeaveRange[]>(() => {
    try {
      const raw = localStorage.getItem(LEAVE_PLAN_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const [odEntries, setOdEntries] = useState<ODEntry[]>(() => {
    try {
      const raw = localStorage.getItem(OD_KEY)
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
    localStorage.setItem(LEAVE_PLAN_KEY, JSON.stringify(leavePlan))
  }, [leavePlan])

  useEffect(() => {
    localStorage.setItem(OD_KEY, JSON.stringify(odEntries))
  }, [odEntries])

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

  const addLeaveRange = useCallback((range: Omit<LeaveRange, 'id'>) => {
    setLeavePlan(prev => [...prev, { ...range, id: newRangeId() }])
  }, [])

  const updateLeaveRange = useCallback((range: LeaveRange) => {
    setLeavePlan(prev => prev.map(r => (r.id === range.id ? range : r)))
  }, [])

  const removeLeaveRange = useCallback((id: string) => {
    setLeavePlan(prev => prev.filter(r => r.id !== id))
  }, [])

  const addOD = useCallback((od: Omit<ODEntry, 'id'>) => {
    setOdEntries(prev => [...prev, { ...od, id: newRangeId() }])
  }, [])

  const updateOD = useCallback((od: ODEntry) => {
    setOdEntries(prev => prev.map(o => (o.id === od.id ? od : o)))
  }, [])

  const removeOD = useCallback((id: string) => {
    setOdEntries(prev => prev.filter(o => o.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setSlots([])
    setOverrides([])
    setLeavePlan([])
    setOdEntries([])
    setStudent('')
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(OVERRIDES_KEY)
    localStorage.removeItem(LEAVE_PLAN_KEY)
    localStorage.removeItem(OD_KEY)
    localStorage.removeItem('sec-leave-student')
  }, [])

  return {
    slots,
    overrides,
    leavePlan,
    odEntries,
    student,
    importData,
    addOverride,
    removeOverride,
    addLeaveRange,
    updateLeaveRange,
    removeLeaveRange,
    addOD,
    updateOD,
    removeOD,
    clearAll,
    hasData: slots.length > 0,
  }
}
