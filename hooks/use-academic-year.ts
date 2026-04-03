// hooks/use-academic-year.ts
import { useState, useEffect } from "react"
import { academicYearsApi } from "@/services/api"
import type { AcademicYear } from "@/types"

export function useAcademicYear(yearId: string) {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [isArchived, setIsArchived] = useState(false)

  useEffect(() => {
    async function fetchAcademicYear() {
      try {
        const year = await academicYearsApi.getById(yearId)
        setAcademicYear(year)
        
        // Vérifier si l'année est archivée
        const now = new Date()
        const endDate = new Date(year.endDate)
        setIsArchived(now > endDate && !year.isCurrent)
      } catch (error) {
        console.error("Error fetching academic year:", error)
      } finally {
        setLoading(false)
      }
    }
    
    if (yearId) {
      fetchAcademicYear()
    }
  }, [yearId])

  return { academicYear, loading, isArchived }
}