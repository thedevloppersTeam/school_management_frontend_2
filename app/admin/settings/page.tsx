// app/(dashboard)/settings/school/page.tsx
"use client"

import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CPMSLSchoolInfoForm }      from "@/components/school/cpmsl-school-info-form"
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management"

// ── Internal: hook + modals + tab-content components ──────────────────────────
import { useSchoolSettings, getSectionCycles, CYCLES_MENFP } from "@/app/admin/settings/school/_hooks/use-school-settings"
import { RubricModal, SubjectModal, SectionModal, AttitudeModal, ClassModal } from "@/app/admin/settings/school/_components/school-modals"
import { ReferentielTab } from "@/app/admin/settings/school/_components/referentiel-tab"
import { ClassesTab }     from "@/app/admin/settings/school/_components/classes-tab"
import { AttitudesTab }   from "@/app/admin/settings/school/_components/attitudes-tab"

// ── Tab label map ─────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, string> = {
  general:     'Informations générales',
  calendar:    'Calendrier scolaire',
  referentiel: 'Matières & Rubriques',
  classes:     'Classes',
  attitudes:   'Attitudes',
}

// ── Page ──────────────────────────────────────────────────────────────────────
// Cognitive complexity: ≤ 5
//  - onValueChange callback    → 0 (no branch)
//  - Object.keys().map()       → 0 (no branch)
//  - 5 modal <open> props      → 0 (no branch — JSX prop passing)
//
// All branching logic lives in: useSchoolSettings (each fn independent)
//                               tab-content components
//                               modal components

export default function SchoolSettingsPage() {
  const s = useSchoolSettings()          // all state + handlers

  return (
    <div className="space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'36px', lineHeight:1.15, letterSpacing:'-0.03em', fontWeight:700, color:"#2A3740" }}>
          Établissement
        </h1>
        <p style={{ fontFamily:'var(--font-sans)', fontSize:'13px', color:'hsl(var(--muted-foreground))', marginTop:"4px" }}>
          Paramètres et référentiel de votre établissement
        </p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="general" className="w-full" onValueChange={s.setActiveTab}>

        <TabsList style={{ backgroundColor:"#F0F4F7", borderRadius:"8px", padding:"4px" }}>
          {Object.entries(TAB_LABELS).map(([value, label]) => (
            <TabsTrigger key={value} value={value}
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              style={{ borderRadius:"6px" }}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Général ─────────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <CPMSLSchoolInfoForm
            schoolInfo={s.schoolInfo}
            onSave={s.handleSaveSchoolInfo}
            loading={s.loadingSchoolInfo}
          />
        </TabsContent>

        {/* ── Calendrier ──────────────────────────────────────────────────── */}
        <TabsContent value="calendar" className="space-y-8 mt-6">
          <CPMSLCalendarManagement
            holidays={s.holidays}   events={s.events}
            onAddHoliday={s.handleAddHoliday}     onEditHoliday={s.handleEditHoliday}     onDeleteHoliday={s.handleDeleteHoliday}
            onAddEvent={s.handleAddEvent}         onEditEvent={s.handleEditEvent}         onDeleteEvent={s.handleDeleteEvent}
          />
        </TabsContent>

        {/* ── Matières & Rubriques ─────────────────────────────────────────── */}
        <TabsContent value="referentiel" className="space-y-6 mt-6">
          <ReferentielTab
            loading={s.loadingRef}
            rubrics={s.rubrics}
            subjects={s.subjects}
            expandedSubjects={s.expandedSubjects}
            onCreateRubric={s.openCreateRubric}
            onEditRubric={s.openEditRubric}
            onCreateSubject={s.openCreateSubject}
            onEditSubject={s.openEditSubject}
            onCreateSection={s.openCreateSection}
            onToggleExpand={s.toggleExpand}
          />
        </TabsContent>

        {/* ── Classes ─────────────────────────────────────────────────────── */}
        <TabsContent value="classes" className="space-y-6 mt-6">
          <ClassesTab
            loading={s.loadingClasses}
            classTypes={s.classTypes}
            classes={s.classes}
            initializing={s.initializing}
            onInitialize={s.handleInitializeClasses}
            onEditClass={s.openEditClass}
          />
        </TabsContent>

        {/* ── Attitudes ────────────────────────────────────────────────────── */}
        <TabsContent value="attitudes" className="space-y-6 mt-6">
          <AttitudesTab
            loading={s.loadingAttitudes}
            attitudes={s.attitudes}
            currentYearId={s.currentYearId}
            onCreateAttitude={s.openCreateAttitude}
            onEditAttitude={s.openEditAttitude}
            onDeleteAttitude={s.handleDeleteAttitude}
          />
        </TabsContent>

      </Tabs>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      <RubricModal
        open={s.rubricModal}   onOpenChange={s.setRubricModal}
        editing={s.editingRubric}
        form={s.rubricForm}    setForm={s.setRubricForm}
        onSave={s.handleSaveRubric} submitting={s.submitting}
      />

      <SubjectModal
        open={s.subjectModal}  onOpenChange={s.setSubjectModal}
        editing={s.editingSubject} rubrics={s.rubrics}
        form={s.subjectForm}   setForm={s.setSubjectForm}
        subjectCount={s.subjects.length}
        onSave={s.handleSaveSubject} submitting={s.submitting}
      />

      <SectionModal
        open={s.sectionModal}  onOpenChange={s.setSectionModal}
        parentSectionCount={s.subjects.find(sub => sub.id === s.sectionParentId)?.sections?.length ?? 0}
        form={s.sectionForm}   setForm={s.setSectionForm}
        onSave={s.handleSaveSection} submitting={s.submitting}
      />

      <AttitudeModal
        open={s.attitudeModal} onOpenChange={s.setAttitudeModal}
        editing={s.editingAttitude}
        label={s.attitudeLabel} setLabel={s.setAttitudeLabel}
        onSave={s.handleSaveAttitude} submitting={s.submitting}
      />

      <ClassModal
        open={s.classModal}    onOpenChange={s.setClassModal}
        editing={s.editingClass}
        form={s.classForm}     setForm={s.setClassForm}
        onSave={s.handleSaveClass} submitting={s.submitting}
      />

    </div>
  )
}