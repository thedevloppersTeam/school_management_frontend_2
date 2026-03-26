"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { CPMSLSchoolInfoForm } from "@/components/school/cpmsl-school-info-form"
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management"
import { schoolInfo as defaultSchoolInfo, holidays as defaultHolidays, schoolEvents as defaultEvents, type SchoolInfo, type Holiday, type SchoolEvent } from "@/lib/data/school-data"

export default function SchoolSettingsPage() {
  const { toast } = useToast()
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(defaultSchoolInfo)
  const [holidays, setHolidays] = useState<Holiday[]>(defaultHolidays)
  const [events, setEvents] = useState<SchoolEvent[]>(defaultEvents)

  const handleSaveSchoolInfo = (info: SchoolInfo) => {
    setSchoolInfo(info)
    toast({
      title: "Paramètres enregistrés",
      description: "Les informations de l'établissement ont été mises à jour."
    })
  }

  const handleAddHoliday = (data: { name: string; date: string }) => {
    const newHoliday: Holiday = { id: `holiday-${Date.now()}`, ...data }
    setHolidays([...holidays, newHoliday])
  }

  const handleEditHoliday = (id: string, data: { name: string; date: string }) => {
    setHolidays(holidays.map(h => h.id === id ? { ...h, ...data } : h))
  }

  const handleDeleteHoliday = (id: string) => {
    setHolidays(holidays.filter(h => h.id !== id))
  }

  const handleAddEvent = (data: { title: string; date: string; type: SchoolEvent['type'] }) => {
    const newEvent: SchoolEvent = { id: `event-${Date.now()}`, ...data, academicYearId: 'ay-2024' }
    setEvents([...events, newEvent])
  }

  const handleEditEvent = (id: string, data: { title: string; date: string; type: SchoolEvent['type'] }) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...data } : e))
  }

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: "#2A3740" }}>Établissement</h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 400, color: 'hsl(var(--muted-foreground))', marginTop: "4px" }}>Paramètres de votre établissement</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          <TabsTrigger value="general" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Informations générales</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Calendrier scolaire</span>
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
