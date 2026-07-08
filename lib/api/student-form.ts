// lib/api/student-form.ts
// Types + fetch helpers for the dynamic student enrollment form schema.

export type CustomFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "RADIO"           // Single choice from a list, rendered as radio buttons
  | "CHECKBOX"        // Single boolean — yes/no
  | "MULTI_CHECKBOX"  // List of options, multiple selections allowed
  | "IMAGE"

export interface FieldConfig {
  // For SELECT
  options?: string[]
  // For NUMBER
  min?: number
  max?: number
  step?: number
}

export interface ApiCustomField {
  id: string
  groupId: string
  label: string
  type: CustomFieldType
  required: boolean
  placeholder?: string | null
  helpText?: string | null
  config?: FieldConfig | null
  displayOrder: number
  // Visibilité conditionnelle. Si parentFieldId est défini, ce champ
  // n'apparaît que lorsque la case parent (toujours CHECKBOX) vaut
  // showWhenTrue.
  parentFieldId?: string | null
  showWhenTrue?: boolean | null
}

export interface ApiFieldGroup {
  id: string
  name: string
  description?: string | null
  displayOrder: number
  fields: ApiCustomField[]
}

// Saved value coming back from the backend
export interface ApiCustomValue {
  id: string
  studentId: string
  fieldId: string
  textValue: string | null
  numberValue: unknown
  dateValue: string | null
  boolValue: boolean | null
  imageUrl: string | null
  jsonValue: unknown
  field?: ApiCustomField
}

// Payload shape used when SAVING values for a student
export interface CustomValuePayload {
  fieldId: string
  textValue?: string | null
  numberValue?: number | null
  dateValue?: string | null
  boolValue?: boolean | null
  imageUrl?: string | null
  jsonValue?: unknown
}

export const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  TEXT:           "Texte",
  TEXTAREA:       "Zone de texte",
  NUMBER:         "Nombre",
  DATE:           "Date",
  SELECT:         "Liste déroulante",
  RADIO:          "Boutons radio (un seul choix)",
  CHECKBOX:       "Case à cocher (Oui / Non)",
  MULTI_CHECKBOX: "Plusieurs cases à cocher",
  IMAGE:          "Image",
}
