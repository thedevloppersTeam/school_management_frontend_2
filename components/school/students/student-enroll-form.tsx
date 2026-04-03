"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangleIcon, CheckCircle2Icon, LoaderIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassSessionOption {
  id: string
  name: string
}

interface StudentEnrollFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  academicYearId: string
  onSuccess: () => void
  trigger?: React.ReactNode
}

interface FormState {
  nisu: string
  firstName: string
  lastName: string
  birthDate: string
  classSessionId: string
  password: string
  address: string
  fatherName: string
  motherName: string
  phone1: string
}

const EMPTY_FORM: FormState = {
  nisu: "", firstName: "", lastName: "", birthDate: "",
  classSessionId: "", password: "",
  address: "",
  fatherName: "", motherName: "", phone1: "",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
}

function generateUsername(firstName: string, lastName: string): string {
  return `${normalize(firstName)}.${normalize(lastName)}.${new Date().getFullYear()}`
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? `Erreur ${res.status}`)
  return data
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentEnrollForm({
  open,
  onOpenChange,
  academicYearId,
  onSuccess,
  trigger,
}: StudentEnrollFormProps) {
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [apiError, setApiError]       = useState<string | null>(null)
  const [successMsg, setSuccessMsg]   = useState<string | null>(null)
  const [classSessions, setClassSessions] = useState<ClassSessionOption[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)

  useEffect(() => {
    if (!open || !academicYearId) return
    setLoadingClasses(true)
    fetch(`/api/class-sessions?academicYearId=${academicYearId}`, { credentials: "include" })
      .then(r => r.json())
      .then((data: Array<{ id: string; class: { classType: { name: string }; letter: string; track?: { code: string } | null } }>) => {
        console.log(data)
        setClassSessions(
          data
            .map(s => ({
              id: s.id,
              name: `${s.class.classType.name} ${s.class.letter}${s.class.track ? ` ${s.class.track.code}` : ""}`,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      })
      .catch(() => setClassSessions([]))
      .finally(() => setLoadingClasses(false))
  }, [open, academicYearId])

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const nisuValid = /^[A-Z0-9]{13,}$/i.test(form.nisu)

  const canSubmit =
    nisuValid &&
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.birthDate !== "" &&
    form.classSessionId !== "" &&
    form.password.length >= 6

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setApiError(null)
    setSuccessMsg(null)

    const username = generateUsername(form.firstName, form.lastName)

    console.log("=== DONNÉES ENVOYÉES ===", {
      step1_user: {
        firstname: form.firstName.trim(),
        lastname:  form.lastName.trim(),
        birthDate: form.birthDate,
        username,
        password:  form.password,
        type:      "STUDENT",
      },
      step2_student: {
        nisu:       form.nisu.toUpperCase(),
        address:    form.address.trim(),
        fatherName: form.fatherName || undefined,
        motherName: form.motherName || undefined,
        phone1:     form.phone1 || undefined,
      },
      step3_enrollment: {
        classSessionId: form.classSessionId,
        notes:          "Nouvelle inscription",
      }
    })
    try {
      // 1. Créer le user
      const userRes = await apiFetch<{ user: { id: string } }>("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: form.firstName.trim(),
          lastname:  form.lastName.trim(),
          birthDate: form.birthDate,
          username,
          password:  form.password,
          type:      "STUDENT",
        }),
      })
      console.log("User created:", userRes.user.id);

      // 2. Créer le profil student
      const studentRes = await apiFetch<{ student: { id: string } }>("/api/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:     userRes.user.id,
          nisu:       form.nisu.toUpperCase(),
          address:    form.address.trim(),
          ...(form.fatherName && { fatherName: form.fatherName.trim() }),
          ...(form.motherName && { motherName: form.motherName.trim() }),
          ...(form.phone1     && { phone1:     form.phone1.trim() }),
        }),
      })
      console.log("Student profile created:", studentRes.student.id);

      // 3. Inscrire dans la classe
      await apiFetch("/api/enrollments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId:      studentRes.student.id,
          classSessionId: form.classSessionId,
          notes:          "Nouvelle inscription",
        }),
      })

      setSuccessMsg(`${form.firstName} ${form.lastName} inscrit avec succès. Username : ${username}`)
      setForm(EMPTY_FORM)
      onSuccess()

    } catch (err: unknown) {
      console.error("ERREUR INSCRIPTION:", err)
      setApiError(err instanceof Error ? err.message : "Une erreur est survenue.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = (v: boolean) => {
    if (!v) { setApiError(null); setSuccessMsg(null) }
    onOpenChange(v)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="font-serif"
            style={{ fontSize: "24px", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em", color: "#1f1a18" }}
          >
            Inscrire un élève
          </DialogTitle>
          <DialogDescription
            className="font-sans"
            style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}
          >
            Remplissez les informations de l'élève
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">

          {/* Succès */}
          {successMsg && (
            <div className="flex items-start gap-2 rounded-lg p-3 font-sans"
              style={{ backgroundColor: "#E8F5EC", fontSize: "13px", color: "#2D7D46" }}>
              <CheckCircle2Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Erreur API */}
          {apiError && (
            <div className="flex items-start gap-2 rounded-lg p-3 font-sans"
              style={{ backgroundColor: "#FDE8E8", fontSize: "13px", color: "#C43C3C" }}>
              <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* ── Section Identité ── */}
          <div className="space-y-3">
            <h3 className="font-serif"
              style={{ fontSize: "15px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "8px" }}>
              Identité
            </h3>
            <div className="space-y-3">

              {/* NISU */}
              <div className="space-y-1.5">
                <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>
                  NISU <span className="text-destructive">*</span>
                  <span className="font-sans ml-2" style={{ fontSize: "11px", color: "#78756F", fontWeight: 400 }}>
                    13 caractères alphanumériques minimum
                  </span>
                </Label>
                <Input
                  type="text"
                  placeholder="Ex: 1111114211111"
                  value={form.nisu}
                  onChange={e => setForm(f => ({ ...f, nisu: e.target.value.toUpperCase() }))}
                  className={cn("h-9 font-mono", form.nisu && !nisuValid && "border-destructive")}
                  style={{ letterSpacing: "0.05em" }}
                />
                {form.nisu && !nisuValid && (
                  <p className="text-xs text-destructive">13 caractères alphanumériques minimum requis</p>
                )}
                {nisuValid && (
                  <p className="text-xs" style={{ color: "#2D7D46" }}>✓ NISU valide</p>
                )}
              </div>

              {/* Nom + Prénom */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>
                    Nom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="PIERRE"
                    value={form.lastName}
                    onChange={set("lastName")}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>
                    Prénom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Jean"
                    value={form.firstName}
                    onChange={set("firstName")}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Date de naissance */}
              <div className="space-y-1.5">
                <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>
                  Date de naissance <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={set("birthDate")}
                  className="h-9"
                />
              </div>

              {/* Username preview */}
              {form.firstName.trim() && form.lastName.trim() && (
                <div className="font-sans rounded-lg px-3 py-2"
                  style={{ backgroundColor: "#F0F4F7", fontSize: "12px", color: "#78756F" }}>
                  Username généré :&nbsp;
                  <span style={{ fontWeight: 600, color: "#3A4A57" }}>
                    {generateUsername(form.firstName, form.lastName)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Section Scolarité ── */}
          <div className="space-y-3">
            <h3 className="font-serif"
              style={{ fontSize: "15px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "8px" }}>
              Scolarité
            </h3>
            <div className="space-y-1.5">
              <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>
                Classe <span className="text-destructive">*</span>
              </Label>
              <Select value={form.classSessionId} onValueChange={v => setForm(f => ({ ...f, classSessionId: v }))} disabled={loadingClasses}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingClasses ? "Chargement..." : "Sélectionnez une classe"} />
                </SelectTrigger>
                <SelectContent>
                  {classSessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Section Accès ── */}
          <div className="space-y-3">
            <h3 className="font-serif"
              style={{ fontSize: "15px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "8px" }}>
              Accès
            </h3>
            <div className="space-y-1.5">
              <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>
                Mot de passe initial <span className="text-destructive">*</span>
                <span className="font-sans ml-2" style={{ fontSize: "11px", color: "#78756F", fontWeight: 400 }}>
                  6 caractères minimum
                </span>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  className={cn("h-9 pr-10", form.password && form.password.length < 6 && "border-destructive")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#A8A5A2" }}
                >
                  {showPassword
                    ? <EyeOffIcon style={{ width: 16, height: 16 }} />
                    : <EyeIcon    style={{ width: 16, height: 16 }} />
                  }
                </button>
              </div>
              {form.password && form.password.length < 6 && (
                <p className="text-xs text-destructive">6 caractères minimum requis</p>
              )}
            </div>
          </div>

          {/* ── Section Contact (optionnel) ── */}
          <div className="space-y-3">
            <h3 className="font-serif"
              style={{ fontSize: "15px", fontWeight: 600, color: "#2C4A6E", borderLeft: "3px solid #2C4A6E", paddingLeft: "8px" }}>
              Contact
              <span className="font-sans ml-2" style={{ fontSize: "11px", fontWeight: 400, color: "#A8A5A2" }}>
                optionnel
              </span>
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>Adresse</Label>
                <Input type="text" placeholder="123 Rue Principale, Port-au-Prince" value={form.address} onChange={set("address")} className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>Nom du père</Label>
                  <Input type="text" placeholder="Paul Pierre" value={form.fatherName} onChange={set("fatherName")} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>Nom de la mère</Label>
                  <Input type="text" placeholder="Marie Pierre" value={form.motherName} onChange={set("motherName")} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-sans" style={{ fontSize: "13px", fontWeight: 500 }}>Téléphone</Label>
                <Input type="text" placeholder="+509 XX XX XXXX" value={form.phone1} onChange={set("phone1")} className="h-9" />
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="border-0 disabled:opacity-100"
            style={{
              backgroundColor: canSubmit && !submitting ? "#2C4A6E" : "#9CA3AF",
              color: "#ffffff",
            }}
          >
            {submitting
              ? <><LoaderIcon className="h-4 w-4 mr-2" style={{ animation: "spin 1s linear infinite" }} />Inscription...</>
              : "Enregistrer"
            }
          </Button>
        </DialogFooter>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </DialogContent>
    </Dialog>
  )
}