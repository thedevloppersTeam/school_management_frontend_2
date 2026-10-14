// hooks/use-academic-year.ts
import { useState, useEffect } from "react"
import { clientFetch } from "@/lib/client-fetch"
import type { AcademicYear } from "@/types"
import { estArchivee } from "@/lib/academic-years/status"

export function useAcademicYear(yearId: string) {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [isArchived, setIsArchived] = useState(false)

  useEffect(() => {
    async function fetchAcademicYear() {
      try {
        const year = await clientFetch<AcademicYear>(`/api/academic-years/${yearId}`)
        setAcademicYear(year)
        
        // Meme regle que partout ailleurs. Elle etait ici reecrite a
        // l'envers (`now > endDate && !isCurrent`) et sans garde sur une
        // date illisible.
        setIsArchived(estArchivee(year))
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
