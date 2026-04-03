"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { CPMSLSchoolInfoForm } from "@/components/school/cpmsl-school-info-form"
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management"

// ── Types locaux (extraits de school-data, sans la dépendance) ────────────────

interface SchoolInfo {
  name: string
  motto?: string
  foundedYear?: number
  logo?: string
  address?: string
  phone?: string
  email?: string
}

interface Holiday {
  id: string
  name: string
  date: string
}

interface SchoolEvent {
  id: string
  title: string
  date: string
  type: 'exam' | 'holiday' | 'meeting' | 'other'
  academicYearId: string
}

// ── Valeurs par défaut ────────────────────────────────────────────────────────

const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  name: "Cours Privé Mixte Saint Léonard",
  motto: "",
  foundedYear: undefined,
  logo: "",
  address: "",
  phone: "",
  email: "",
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchoolSettingsPage() {
  const { toast } = useToast()
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO)
  const [holidays, setHolidays]     = useState<Holiday[]>([])
  const [events, setEvents]         = useState<SchoolEvent[]>([])

  const handleSaveSchoolInfo = (info: SchoolInfo) => {
    setSchoolInfo(info)
    toast({
      title: "Paramètres enregistrés",
      description: "Les informations de l'établissement ont été mises à jour."
    })
  }

  const handleAddHoliday = (data: { name: string; date: string }) => {
    setHolidays(prev => [...prev, { id: `holiday-${Date.now()}`, ...data }])
  }

  const handleEditHoliday = (id: string, data: { name: string; date: string }) => {
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, ...data } : h))
  }

  const handleDeleteHoliday = (id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id))
  }

  const handleAddEvent = (data: { title: string; date: string; type: SchoolEvent['type'] }) => {
    setEvents(prev => [...prev, { id: `event-${Date.now()}`, ...data, academicYearId: '' }])
  }

  const handleEditEvent = (id: string, data: { title: string; date: string; type: SchoolEvent['type'] }) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  }

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: "#2A3740" }}>
          Établissement
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 400, color: 'hsl(var(--muted-foreground))', marginTop: "4px" }}>
          Paramètres de votre établissement
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Informations générales
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Calendrier scolaire
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <CPMSLSchoolInfoForm schoolInfo={schoolInfo} onSave={handleSaveSchoolInfo} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-8 mt-6">
          <CPMSLCalendarManagement
            holidays={holidays}
            events={events}
            onAddHoliday={handleAddHoliday}
            onEditHoliday={handleEditHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onAddEvent={handleAddEvent}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}