"use client"

import { useId } from "react"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { AcademicYear } from "@/lib/api/dashboard"

/** Choix de l'année scolaire, étiqueté (plan B.1). */
export function SelecteurAnnee({
  annees,
  valeur,
  onChange,
}: {
  annees: AcademicYear[] | null
  valeur: string | null
  onChange: (id: string) => void
}) {
  const id = useId()
  if (!annees) return <Skeleton className="h-9 w-48" />
  return (
    <Field className="w-auto">
      <FieldLabel htmlFor={id}>Année</FieldLabel>
      <Select value={valeur ?? undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-48">
          <SelectValue placeholder="Choisir une année" />
        </SelectTrigger>
        <SelectContent>
          {annees.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.yearString || a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
