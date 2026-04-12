"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PlusIcon } from "lucide-react"
import type { Holiday, SchoolEvent } from "@/lib/data/school-data"

interface CPMSLCalendarManagementProps {
  holidays: Holiday[]
  events: SchoolEvent[]
  onAddHoliday: (data: { name: string; date: string }) => void
  onEditHoliday: (id: string, data: { name: string; date: string }) => void
  onDeleteHoliday: (id: string) => void
  onAddEvent: (data: { title: string; date: string; type: SchoolEvent['type'] }) => void
  onEditEvent: (id: string, data: { title: string; date: string; type: SchoolEvent['type'] }) => void
  onDeleteEvent: (id: string) => void
}

export function CPMSLCalendarManagement({ holidays, events, onAddHoliday, onEditHoliday, onDeleteHoliday, onAddEvent, onEditEvent, onDeleteEvent }: CPMSLCalendarManagementProps) {
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '' })

  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null)
  const [eventForm, setEventForm] = useState({ title: '', date: '', type: 'ceremony' as SchoolEvent['type'] })

  const handleOpenHolidayDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday)
      setHolidayForm({ name: holiday.name, date: holiday.date })
    } else {
      setEditingHoliday(null)
      setHolidayForm({ name: '', date: '' })
    }
    setHolidayDialogOpen(true)
  }

  const handleSaveHoliday = () => {
    if (editingHoliday) {
      onEditHoliday(editingHoliday.id, holidayForm)
    } else {
      onAddHoliday(holidayForm)
    }
    setHolidayDialogOpen(false)
  }

  const handleOpenEventDialog = (event?: SchoolEvent) => {
    if (event) {
      setEditingEvent(event)
      setEventForm({ title: event.title, date: event.date, type: event.type })
    } else {
      setEditingEvent(null)
      setEventForm({ title: '', date: '', type: 'ceremony' })
    }
    setEventDialogOpen(true)
  }

  const handleSaveEvent = () => {
    if (editingEvent) {
      onEditEvent(editingEvent.id, eventForm)
    } else {
      onAddEvent(eventForm)
    }
    setEventDialogOpen(false)
  }

  const formatHolidayDate = (date: string) => {
    const [month, day] = date.split('-')
    return `${day}/${month}`
  }

  const formatEventDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getEventTypeBadge = (type: SchoolEvent['type']) => {
    const styles = {
  ceremony: { label: 'Cérémonie', bg: '#E3EFF9', color: '#2B6CB0' },
  meeting:  { label: 'Réunion',   bg: '#FEF6E0', color: '#C48B1A' },
  trip:     { label: 'Sortie',    bg: '#E8F5EC', color: '#2D7D46' },
  other:    { label: 'Autre',     bg: '#F5F4F2', color: '#5C5955' },
  exam:     { label: 'Examen',    bg: '#FDE8E8', color: '#C43C3C' },
  holiday:  { label: 'Congé',     bg: '#F0F4F7', color: '#5A7085' },
}
    const style = styles[type as keyof typeof styles] ?? styles.other
    return <Badge className="border-0" style={{ backgroundColor: style.bg, color: style.color, fontSize: "11px", fontFamily: "var(--font-sans)", fontWeight: 500, borderRadius: "6px" }}>{style.label}</Badge>
  }

  return (
    <div className="space-y-8">
      {/* Section Jours fériés */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }} className="flex items-start justify-between">
          <div>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "12px", marginBottom: "8px" }}>Jours fériés</h3>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))", paddingLeft: "15px" }}>Applicables à toutes les années scolaires (récurrents)</p>
          </div>
          <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenHolidayDialog()} style={{ backgroundColor: "#2C4A6E", color: "#FFFFFF" }}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Ajouter un jour férié
              </Button>
            </DialogTrigger>
            <DialogContent style={{ backgroundColor: "#FFFFFF", borderRadius: "12px" }}>
              <DialogHeader>
                <DialogTitle className="heading-4" style={{ color: "#2A3740" }}>{editingHoliday ? 'Modifier le jour férié' : 'Ajouter un jour férié'}</DialogTitle>
                <DialogDescription className="body-base" style={{ color: "#78756F" }}>Les jours fériés sont récurrents chaque année</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="label-ui" style={{ color: "#1E1A17" }}>Date (JJ/MM)</Label>
                  <Input placeholder="Ex: 01/01" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} style={{ borderColor: "#D1CECC" }} />
                </div>
                <div className="space-y-2">
                  <Label className="label-ui" style={{ color: "#1E1A17" }}>Nom</Label>
                  <Input value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} style={{ borderColor: "#D1CECC" }} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setHolidayDialogOpen(false)} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>Annuler</Button>
                <Button onClick={handleSaveHoliday} style={{ backgroundColor: "#5A7085", color: "#FFFFFF" }}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div style={{ padding: "24px" }}>
          <div style={{ border: "1px solid #E8E6E3", borderRadius: "8px", overflow: "hidden" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                  <TableHead style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>DATE</TableHead>
                  <TableHead style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>NOM</TableHead>
                  <TableHead className="text-center" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id} className="hover:bg-[#FAF8F3]">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatHolidayDate(holiday.date)}
                        <Badge variant="outline" style={{ fontSize: "11px", fontFamily: "var(--font-sans)", fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>Annuel</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleOpenHolidayDialog(holiday)}
                          className="text-sm font-medium hover:underline"
                          style={{ color: "#1f1a18" }}
                        >
                          Modifier
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="text-sm font-medium hover:underline"
                              style={{ color: "#B91C1C" }}
                            >
                              Supprimer
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ color: "#2A3740" }}>Êtes-vous sûr ?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: "#5C5955" }}>
                                Cette action est irréversible. Le jour férié "{holiday.name}" sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel style={{ borderColor: "#D1CECC", color: "#5C5955" }}>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteHoliday(holiday.id)} style={{ backgroundColor: "#C43C3C", color: "#FFFFFF" }}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Section Événements */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }} className="flex items-start justify-between">
          <div>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "12px", marginBottom: "8px" }}>Événements scolaires</h3>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))", paddingLeft: "15px" }}>Spécifiques à l'année scolaire active (2024-2025)</p>
          </div>
          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenEventDialog()} style={{ backgroundColor: "#2C4A6E", color: "#FFFFFF" }}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Ajouter un événement
              </Button>
            </DialogTrigger>
            <DialogContent style={{ backgroundColor: "#FFFFFF", borderRadius: "12px" }}>
              <DialogHeader>
                <DialogTitle className="heading-4" style={{ color: "#2A3740" }}>{editingEvent ? "Modifier l'événement" : 'Ajouter un événement'}</DialogTitle>
                <DialogDescription className="body-base" style={{ color: "#78756F" }}>Les événements sont spécifiques à l'année scolaire en cours</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label style={{ color: "#1E1A17" }}>Date</Label>
                  <Input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} style={{ borderColor: "#D1CECC" }} />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: "#1E1A17" }}>Nom</Label>
                  <Input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} style={{ borderColor: "#D1CECC" }} />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: "#1E1A17" }}>Type</Label>
                  <Select value={eventForm.type} onValueChange={(value: SchoolEvent['type']) => setEventForm({ ...eventForm, type: value })}>
                    <SelectTrigger style={{ borderColor: "#D1CECC" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceremony">Cérémonie</SelectItem>
                      <SelectItem value="meeting">Réunion</SelectItem>
                      <SelectItem value="trip">Sortie</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEventDialogOpen(false)} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>Annuler</Button>
                <Button onClick={handleSaveEvent} style={{ backgroundColor: "#5A7085", color: "#FFFFFF" }}>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div style={{ padding: "24px" }}>
          <div style={{ border: "1px solid #E8E6E3", borderRadius: "8px", overflow: "hidden" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                  <TableHead style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>DATE</TableHead>
                  <TableHead style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>NOM</TableHead>
                  <TableHead style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>TYPE</TableHead>
                  <TableHead className="text-center" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: "#2C4A6E" }}>ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="hover:bg-[#FAF8F3]">
                    <TableCell className="font-medium">{formatEventDate(event.date)}</TableCell>
                    <TableCell>{event.title}</TableCell>
                    <TableCell>{getEventTypeBadge(event.type)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleOpenEventDialog(event)}
                          className="text-sm font-medium hover:underline"
                          style={{ color: "#1f1a18" }}
                        >
                          Modifier
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="text-sm font-medium hover:underline"
                              style={{ color: "#B91C1C" }}
                            >
                              Supprimer
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ color: "#2A3740" }}>Êtes-vous sûr ?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: "#5C5955" }}>
                                Cette action est irréversible. L'événement "{event.title}" sera définitivement supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel style={{ borderColor: "#D1CECC", color: "#5C5955" }}>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteEvent(event.id)} style={{ backgroundColor: "#C43C3C", color: "#FFFFFF" }}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}