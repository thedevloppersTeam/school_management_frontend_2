"use client"

import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return n !== null && n !== undefined ? n.toFixed(2) : "—"
}

function noteColor(n: number | null | undefined): string {
  if (n === null || n === undefined) return "text-slate-400"
  if (n < 5.0) return "text-rose-600"           // Échec
  if (n < 6.0) return "text-amber-600"          // Passable
  if (n < 8.0) return "text-emerald-700"        // Satisfaisant
  return "text-blue-700"                         // Excellent
}

// Échelle d'appréciation — alignée sur les seuils de getAppreciation()
// dans lib/api/bulletin.ts (notes sur 10). "tier" pilote la mise en évidence
// visuelle : "ok" = neutre, "warn" = jaune, "alert" = orange, "fail" = rouge.
const APPRECIATION_SCALE = [
  { range: "9,0 – 10",  grade: "A+", label: "Excellent",  tier: "ok" },
  { range: "8,5 – 8,9", grade: "A",  label: "Excellent",  tier: "ok" },
  { range: "7,8 – 8,4", grade: "B+", label: "Très bien",  tier: "ok" },
  { range: "7,5 – 7,7", grade: "B",  label: "Très bien",  tier: "ok" },
  { range: "6,9 – 7,4", grade: "C+", label: "Bien",       tier: "ok" },
  { range: "6,0 – 6,8", grade: "C",  label: "Assez bien", tier: "warn" },
  { range: "5,1 – 5,9", grade: "D",  label: "Déficient",  tier: "alert" },
  { range: "< 5,1",     grade: "E",  label: "Échec",      tier: "fail" },
] as const

function legendTierClass(tier: typeof APPRECIATION_SCALE[number]["tier"]): string {
  switch (tier) {
    case "warn":  return "border border-amber-400 bg-amber-50 text-amber-800 font-semibold"
    case "alert": return "border border-orange-500 bg-orange-50 text-orange-800 font-semibold"
    case "fail":  return "border border-rose-600 bg-rose-50 text-rose-700 font-semibold"
    default:      return "text-slate-700"
  }
}

function appreciationColor(grade: string): string {
  if (grade.startsWith("A")) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (grade.startsWith("B")) return "bg-blue-50 text-blue-700 border-blue-200"
  if (grade.startsWith("C")) return "bg-amber-50 text-amber-700 border-amber-200"
  if (grade.startsWith("D")) return "bg-orange-50 text-orange-700 border-orange-200"
  return "bg-rose-50 text-rose-700 border-rose-200"
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RubriqueCard({
  name,
  poids,
  entries,
  moy,
  accent,
}: {
  name: string
  poids: string
  entries: RubriqueEntry[]
  moy: number | null
  accent: "blue" | "emerald" | "amber"
}) {
  const accentBar = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
  }[accent]
  const accentText = {
    blue: "text-blue-900",
    emerald: "text-emerald-900",
    amber: "text-amber-900",
  }[accent]
  const accentBg = {
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50",
  }[accent]

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 break-inside-avoid">
      <div className={cn("flex items-center justify-between px-3 py-2", accentBg)}>
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", accentText)}>{name}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", accentBar)}>
          {poids}
        </span>
      </div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60">
            <th className="px-2 py-1 text-left font-semibold text-slate-600">Matière</th>
            <th className="w-14 px-1 py-1 text-center font-semibold text-slate-600">Note</th>
            <th className="w-12 px-1 py-1 text-center font-semibold text-slate-600">Coeff.</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-2 py-3 text-center text-[10px] italic text-slate-400">
                Aucune matière
              </td>
            </tr>
          ) : (
            entries.map((entry, i) =>
              entry.isParent ? (
                <tr key={i} className="bg-slate-100/70 border-t border-slate-200">
                  <td colSpan={3} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                    {entry.name}
                  </td>
                </tr>
              ) : (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-2 py-1 pl-4 text-slate-800">{entry.name}</td>
                  <td className={cn("px-1 py-1 text-center font-semibold tabular-nums", noteColor(entry.note))}>
                    {fmt(entry.note ?? null)}
                  </td>
                  <td className="px-1 py-1 text-center tabular-nums text-slate-600">{entry.coeff ?? ""}</td>
                </tr>
              )
            )
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50">
            <td className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">Moyenne</td>
            <td className={cn("px-1 py-1.5 text-center text-[11px] font-bold tabular-nums", noteColor(moy))}>
              {fmt(moy)}
            </td>
            <td className="px-1 py-1.5 text-center text-[10px] text-slate-500 tabular-nums">/10</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CheckboxMark({ checked }: { checked: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[10px] leading-none",
        checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-transparent"
      )}
    >
      ✓
    </span>
  )
}

function ComportementCol({ items }: { items: ComportementItem[] }) {
  if (items.length === 0) return <div className="text-[10px] italic text-slate-400">—</div>
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1.5 pb-0.5">
        <span className="w-6 text-center text-[9px] font-bold uppercase text-slate-500">Oui</span>
        <span className="w-6 text-center text-[9px] font-bold uppercase text-slate-500">Non</span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-800">{it.label}</span>
          <div className="flex flex-shrink-0 gap-1.5">
            <span className="w-6 text-center">
              <CheckboxMark checked={it.oui === true} />
            </span>
            <span className="w-6 text-center">
              <CheckboxMark checked={it.oui === false} />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main printable component ──────────────────────────────────────────────────

export function BulletinPrintable({ data }: { data: BulletinData }) {
  const { etablissement: etab, comportement: comp } = data
  const col1 = comp.items.filter((c) => c.col === 1)
  const col2 = comp.items.filter((c) => c.col === 2)
  const col3 = comp.items.filter((c) => c.col === 3)
  const moyenneNum = parseFloat(data.moyenneEtape)
  const appreciation = data.appreciation || "—"

  return (
    <article
      className="bulletin-print mx-auto bg-white text-slate-900 print:m-0 print:shadow-none"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "12mm",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header className="flex items-stretch gap-4 rounded-md border border-slate-300 p-3">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
          {etab.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={etab.logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">Logo</span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {etab.nomLigne1}
          </p>
          <h1 className="mt-0.5 text-lg font-bold tracking-wide text-[#2C4A6E]">{etab.nomLigne2}</h1>
          <div className="mt-1 w-full border-t border-b border-slate-300 py-1">
            <p className="text-base font-bold tracking-[0.3em] text-slate-900">BULLETIN SCOLAIRE</p>
          </div>
          <p className="mt-1 text-[10px] tracking-wider text-slate-600">
            Année scolaire <span className="font-semibold text-slate-800">{data.anneeScolaire}</span>
            <span className="mx-2">·</span>
            <span className="font-semibold text-slate-800">{data.periode}</span>
          </p>
        </div>

        <div className="flex h-24 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-slate-300 bg-slate-50">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt={`${data.prenoms} ${data.nom}`} className="h-full w-full object-cover" />
          ) : (
            <div className="text-center text-[9px] text-slate-400">
              Photo
              <br />
              élève
            </div>
          )}
        </div>
      </header>

      {/* Student info */}
      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-slate-200 bg-slate-50/40 px-4 py-2 text-[11px]">
        <InfoRow label="Prénom(s)" value={data.prenoms} bold />
        <InfoRow label="Niveau" value={data.niveau} />
        <InfoRow label="Nom" value={data.nom} bold />
        <InfoRow label="Filière" value={data.filiere || "—"} />
        <InfoRow label="Sexe" value={data.sexe} />
        <InfoRow label="Date de naissance" value={data.dateNaissance} />
        <InfoRow label="Code élève" value={data.code} mono />
        <InfoRow label="NISU" value={data.nisu} mono />
      </section>

      {/* Rubriques */}
      <section className="mt-3 grid grid-cols-3 gap-2">
        <RubriqueCard
          name={data.rubrique1Name}
          poids={data.rubrique1Poids}
          entries={data.rubrique1}
          moy={data.moyR1}
          accent="blue"
        />
        <RubriqueCard
          name={data.rubrique2Name}
          poids={data.rubrique2Poids}
          entries={data.rubrique2}
          moy={data.moyR2}
          accent="emerald"
        />
        <RubriqueCard
          name={data.rubrique3Name}
          poids={data.rubrique3Poids}
          entries={data.rubrique3}
          moy={data.moyR3}
          accent="amber"
        />
      </section>

      {/* Results banner */}
      <section className="mt-3 grid grid-cols-3 gap-2 break-inside-avoid">
        <div className="rounded-md border-2 border-[#2C4A6E] bg-[#2C4A6E] p-3 text-white">
          <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Moyenne de l&apos;étape</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{fmt(isNaN(moyenneNum) ? null : moyenneNum)}</p>
          <p className="text-[10px] opacity-80">sur 10</p>
        </div>
        <div className={cn("rounded-md border-2 p-3", appreciationColor(appreciation))}>
          <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Appréciation</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{appreciation}</p>
          <p className="text-[10px] opacity-80">classement</p>
        </div>
        <div className="rounded-md border-2 border-slate-300 bg-slate-50 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Moyenne de la classe</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{data.moyenneClasse || "—"}</p>
          <p className="text-[10px] text-slate-500">sur 10</p>
        </div>
      </section>

      {/* Comportement */}
      <section className="mt-3 rounded-md border border-slate-300 break-inside-avoid">
        <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-700">Vie scolaire</h2>
        </header>

        <div className="grid grid-cols-4 gap-3 px-3 py-2 text-[10px]">
          <Counter label="Absences" value={comp.absences} />
          <Counter label="Retards" value={comp.retards} />
          <Counter label="Devoirs non remis" value={comp.devoirsNonRemis} />
          <Counter label="Leçons non sues" value={comp.leconsNonSues} />
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-slate-200 px-3 py-2">
          <ComportementCol items={col1} />
          <ComportementCol items={col2} />
          <ComportementCol items={col3} />
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-slate-200 px-3 py-2 text-[10px] sm:grid-cols-3">
          <TextBlock label="Points forts" value={comp.pointsForts} />
          <TextBlock label="Défis" value={comp.defis} />
          <TextBlock label="Remarque" value={comp.remarque} />
        </div>
      </section>

      {/* Légende — une seule ligne compacte, à la MENFP */}
      <section className="mt-3 break-inside-avoid space-y-1 text-[10px] text-slate-800">
        <p className="leading-relaxed">
          <span className="font-bold text-slate-900">Légende :</span>{" "}
          {APPRECIATION_SCALE.map((row, i) => {
            const tierClass = legendTierClass(row.tier)
            const inner = (
              <>
                <span className="font-mono tabular-nums">{row.range}</span>
                {" : "}
                <span className="font-bold">{row.grade}</span>{" "}
                <span>{row.label}</span>
              </>
            )
            return (
              <span key={row.grade}>
                {row.tier === "ok" ? (
                  <span className={tierClass}>{inner}</span>
                ) : (
                  <span className={cn("inline-block rounded px-1 py-[1px]", tierClass)}>{inner}</span>
                )}
                {i < APPRECIATION_SCALE.length - 1 && (
                  <span className="mx-1.5 text-slate-400">|</span>
                )}
              </span>
            )
          })}
        </p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-900">Seuil de promotion :</span>{" "}
          <span className="font-mono tabular-nums">7,00 / 10</span>
          <span className="mx-2 text-slate-400">—</span>
          <span className="font-bold text-slate-900">Formule :</span>{" "}
          <span>
            {data.rubrique1Poids} {data.rubrique1Name}{" + "}
            {data.rubrique2Poids} {data.rubrique2Name}{" + "}
            {data.rubrique3Poids} {data.rubrique3Name}
          </span>
        </p>
      </section>

      {/* Footer / signature */}
      <footer className="mt-4 grid grid-cols-3 gap-4 text-[10px] text-slate-600 break-inside-avoid">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Établissement</p>
          <p className="text-slate-800">{etab.adresse}</p>
          <p className="text-slate-800">Tél : {etab.telephone}</p>
          <p className="text-slate-800">{etab.email}</p>
        </div>
        <div className="col-span-2 flex items-end justify-end">
          <div className="text-center">
            <div className="h-10 w-44 border-b border-slate-400"></div>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Signature de la direction
            </p>
          </div>
        </div>
      </footer>
    </article>
  )
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function InfoRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label} :</span>
      <span
        className={cn(
          "text-[11px] text-slate-900",
          bold && "font-semibold",
          mono && "font-mono text-[10px]"
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-1.5 text-center">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value || "0"}</p>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-slate-800 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  )
}
