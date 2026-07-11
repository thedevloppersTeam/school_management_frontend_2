"use client"

import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"
import { calculateRubriqueTotals, formatBulletinNumber } from "@/lib/bulletin-calculations"
import { normalizeUploadUrl } from "@/lib/upload-url"
import { useLayoutEffect, useRef } from "react"

// -----------------------------------------------------------------------------
// Bulletin imprimable — design fidèle au template bulletin-scolaire.html
// (CPMSL Saint Léonard). Consomme la structure BulletinData ; les moyennes
// sont calculées en amont par lib/api/bulletin.ts (Σnotes/Σmaxscores ×10).
// -----------------------------------------------------------------------------

const fmtC = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : String(n)

/** Couleur de la note selon le pourcentage (note/coeff). */
function colorClass(note: number | null | undefined, coeff: number | null | undefined): string {
  if (note === null || note === undefined || !coeff) return ""
  const pct = (note / coeff) * 100
  if (pct <= 50) return "red"
  if (pct < 60) return "orange"
  if (pct < 69) return "green"
  return ""
}

function parseDisplayNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null

  const parsed = Number.parseFloat(value.replace(",", ".").replace("/10", "").trim())
  return Number.isFinite(parsed) ? parsed : null
}

function cleanBehaviorRemark(value: string | null | undefined): string {
  if (!value) return ""

  return value
    .replace(
      /\[\[\s*(LECONS_NON_SUES|RESPECT_UNIFORME|DISCIPLINE)\s*=\s*[^\]]*\]\]\s*/gi,
      "",
    )
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() !== "" || (index > 0 && index < lines.length - 1))
    .join("\n")
    .trim()
}

function displayBehaviorMetric(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  const text = String(value).trim()
  return text === "" ? "—" : text
}



const PDF_HEADER_SERIF_FONT =
  '"Times New Roman", "Liberation Serif", Times, serif'

const PDF_HEADER_STUDENT_FONT =
  '"Monotype Corsiva", var(--font-cookie), "Cookie", cursive'

const PDF_HEADER_FOUNDED_FONT =
  'var(--font-lobster), "Lobster", cursive'

type PdfTextAlign = "start" | "middle" | "end"

function resolveTextY(value: string, height: number): number {
  const normalizedValue = value.trim()

  if (normalizedValue.endsWith("%")) {
    const percentage = Number.parseFloat(normalizedValue)

    return Number.isFinite(percentage)
      ? height * (percentage / 100)
      : height * 0.44
  }

  const pixels = Number.parseFloat(normalizedValue)

  return Number.isFinite(pixels)
    ? pixels
    : height * 0.44
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="

function PdfSvgTextLine({
  value,
  align = "start",
  y = "44%",
  fontFamily = PDF_HEADER_SERIF_FONT,
}: Readonly<{
  value: string
  align?: PdfTextAlign
  y?: string
  fontFamily?: string
}>) {
  const imageRef = useRef<HTMLImageElement>(null)

  useLayoutEffect(() => {
    const image = imageRef.current

    if (!image) {
      return
    }

    let disposed = false
    let animationFrame = 0

    const renderBitmap = () => {
      if (disposed) {
        return
      }

      const width = Math.max(1, image.clientWidth)
      const height = Math.max(1, image.clientHeight)
      const computedStyle = window.getComputedStyle(image)

      const pixelRatio = Math.max(
        2,
        Math.min(4, window.devicePixelRatio || 1),
      )

      const canvasFont = [
        computedStyle.fontStyle,
        computedStyle.fontWeight,
        computedStyle.fontSize,
        computedStyle.fontFamily,
      ].join(" ")

      const canvas = document.createElement("canvas")
      canvas.width = Math.ceil(width * pixelRatio)
      canvas.height = Math.ceil(height * pixelRatio)

      const context = canvas.getContext("2d")

      if (!context) {
        return
      }

      context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
      )

      context.clearRect(0, 0, width, height)
      context.font = canvasFont
      context.fillStyle = computedStyle.color
      context.textBaseline = "middle"

      context.textAlign =
        align === "start"
          ? "left"
          : align === "middle"
            ? "center"
            : "right"

      const x =
        align === "start"
          ? 0
          : align === "middle"
            ? width / 2
            : width

      context.fillText(
        value,
        x,
        resolveTextY(y, height),
      )

      /*
       * Une image data URL conserve son bitmap lors de cloneNode(true).
       * Le texte de l'en-tête garde donc exactement la police utilisée par
       * Chromium lorsque html2canvas capture le clone destiné au PDF.
       */
      image.src = canvas.toDataURL("image/png")
      image.dataset.pdfTextReady = "true"
    }

    const scheduleDraw = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(renderBitmap)
    }

    const loadFontAndRedraw = async () => {
      const computedStyle = window.getComputedStyle(image)
      const canvasFont = [
        computedStyle.fontStyle,
        computedStyle.fontWeight,
        computedStyle.fontSize,
        computedStyle.fontFamily,
      ].join(" ")

      image.dataset.pdfTextReady = "false"

      if (document.fonts?.load) {
        await document.fonts
          .load(canvasFont, value)
          .catch(() => undefined)
      }

      scheduleDraw()
    }

    const resizeObserver = new ResizeObserver(scheduleDraw)
    resizeObserver.observe(image)

    /*
     * Premier rendu synchrone : le clone PDF ne récupère jamais une image vide.
     * Un second rendu est effectué dès que la police est confirmée comme chargée.
     */
    renderBitmap()
    void loadFontAndRedraw()

    if (document.fonts?.ready) {
      void document.fonts.ready.then(scheduleDraw)
    }

    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [align, fontFamily, value, y])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      src={TRANSPARENT_PIXEL}
      alt=""
      className="pdf-svg-text-line pdf-font-image"
      data-pdf-font-image="true"
      data-pdf-text-ready="false"
      aria-hidden="true"
      draggable={false}
      style={{ fontFamily }}
    />
  )
}


function PdfInlineSvgText({
  value,
  align = "start",
  y = "44%",
  className = "",
}: Readonly<{
  value: string | number | null | undefined
  align?: PdfTextAlign
  y?: string
  className?: string
}>) {
  const textValue = value === null || value === undefined || value === "" ? "—" : String(value)
  const x = align === "start" ? "0" : align === "middle" ? "50%" : "100%"
  const textAnchor = align === "start" ? "start" : align === "middle" ? "middle" : "end"

  return (
    <svg
      className={className ? `pdf-inline-svg-text ${className}` : "pdf-inline-svg-text"}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline="middle"
      >
        {textValue}
      </text>
    </svg>
  )
}

/** Totaux d'une rubrique : Σnotes, Σcoeffs sur les sous-matières notées. */
function RubriqueTable({
  title,
  fallbackTitle,
  entries,
  anchorPrefix,
}: Readonly<{ title: string; fallbackTitle: string; entries: RubriqueEntry[]; anchorPrefix: string }>) {
  const totals = calculateRubriqueTotals(entries)
  const displayTitle = title?.trim() && title !== "—" ? title : fallbackTitle
  const firstNoteIndex = entries.findIndex((entry) => !entry.isParent)
  const lastNoteIndex = entries.reduce((lastIndex, entry, index) =>
    entry.isParent ? lastIndex : index,
  -1)

  return (
    <div className="rubrique-table">
      <h2 className="rubrique-title" data-pdf-anchor={`${anchorPrefix}-title`} title={displayTitle}>
        <PdfInlineSvgText value={displayTitle} align="start" />
      </h2>
      <div className="rubrique-score-grid">
        <div className="rubrique-row rubrique-header-row">
          <div aria-hidden="true" />
          <div className="score-header score-header-note" aria-label="Notes">
            <PdfInlineSvgText value="Notes" align="middle" />
          </div>
          <div className="score-header score-header-coeff" aria-label="Coefficient">
            <PdfInlineSvgText value="Coeff." align="middle" />
          </div>
        </div>
        {entries.map((e, i) => {
          if (e.isParent) {
            const isFirstGroup = entries.slice(0, i).every((entry) => !entry.isParent)
            return (
              <div className="rubrique-row" key={`${e.name}-${i}`}>
                <div className={isFirstGroup ? "subject-group subject-group-first" : "subject-group"} title={e.name}>
                  <PdfInlineSvgText value={e.name} align="start" />
                </div>
                <div className="note-cell rubric-empty-cell" />
                <div className="coeff-cell rubric-empty-cell" />
              </div>
            )
          }
          const cc = colorClass(e.note, e.coeff)
          return (
            <div
              className={i === lastNoteIndex
                ? "rubrique-row rubrique-data-row rubrique-last-data-row"
                : "rubrique-row rubrique-data-row"}
              key={`${e.name}-${i}`}
            >
              <div className="subject-item" title={e.name}>
                <PdfInlineSvgText value={e.name} align="start" />
              </div>
              <div
                className={`note-cell note-value ${cc}`}
                data-pdf-anchor={i === firstNoteIndex ? `${anchorPrefix}-first-note` : undefined}
              >
                <PdfInlineSvgText value={formatBulletinNumber(e.note)} align="middle" />
              </div>
              <div className="coeff-cell coefficient-value">
                <PdfInlineSvgText value={fmtC(e.coeff)} align="middle" />
              </div>
            </div>
          )
        })}
        <div className="rubrique-row rubrique-total-row">
          <div aria-hidden="true" />
          <div className="note-cell total-cell"><span className="total-value"><PdfInlineSvgText value={formatBulletinNumber(totals.note)} align="middle" /></span></div>
          <div className="coeff-cell total-cell"><span className="total-value"><PdfInlineSvgText value={fmtC(totals.coeff)} align="middle" /></span></div>
        </div>
      </div>
    </div>
  )
}

function MoyLine({
  label,
  value,
  valueTone = "",
  variant = "rubric",
}: Readonly<{
  label: string
  value: string
  valueTone?: string
  variant?: "rubric" | "class" | "step" | "appreciation" | "general-class" | "general"
}>) {
  return (
    <div className={`mline mline-${variant}`}>
      <span className="ml"><PdfInlineSvgText value={label} align="end" /></span>
      <span className="leader"><PdfInlineSvgText value="..." align="middle" /></span>
      <span
        className={valueTone ? `mv ${valueTone}` : "mv"}
        data-pdf-anchor={variant === "step" ? "step-average" : undefined}
      >
        <PdfInlineSvgText value={value} align="end" />
      </span>
    </div>
  )
}

function BehTable({ items, right = false }: Readonly<{ items: ComportementItem[]; right?: boolean }>) {
  const labelAlign: PdfTextAlign = right ? "end" : "start"

  return (
    <div className="behavior-group">
      <div className="behavior-row behavior-choice-header-row">
        <div aria-hidden="true" />
        <div className="behavior-choice-header"><PdfInlineSvgText value="OUI" align="middle" /></div>
        <div className="behavior-choice-header"><PdfInlineSvgText value="NON" align="middle" /></div>
      </div>
      {items.map((it, i) => (
        <div className="behavior-row" key={`${it.label}-${i}`}>
          <div className="behavior-criterion" title={it.label}>
            <PdfInlineSvgText value={it.label} align={labelAlign} />
          </div>
          <div className="behavior-choice-cell">{it.oui === true ? <span className="behavior-check"><PdfInlineSvgText value="✓" align="middle" /></span> : ""}</div>
          <div className="behavior-choice-cell">{it.oui === false ? <span className="behavior-check"><PdfInlineSvgText value="✓" align="middle" /></span> : ""}</div>
        </div>
      ))}
    </div>
  )
}

function BehaviorMetricLine({
  label,
  value,
  labelAlign = "end",
  valueTone = "",
}: Readonly<{
  label: string
  value: string
  labelAlign?: PdfTextAlign
  valueTone?: string
}>) {
  return (
    <div className="behavior-metric-row">
      <span className="behavior-metric-label" title={label}>
        <PdfInlineSvgText value={label} align={labelAlign} />
      </span>
      <b className={valueTone ? `behavior-metric-value ${valueTone}` : "behavior-metric-value"}>
        <PdfInlineSvgText value={value} align="middle" />
      </b>
    </div>
  )
}

const BULLETIN_BLUE = "#4DA3CF"
const FONT_SERIF = '"Times New Roman", "Liberation Serif", Times, serif'
const FONT_LABEL = FONT_SERIF
const FONT_STUDENT = 'var(--font-cookie), "Cookie", cursive'
const FONT_FOUNDED = 'var(--font-lobster), "Lobster", cursive'

function extractLevelNumber(level: string): number | null {
  const match = level.match(/\d+/)
  if (!match) return null

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function getCycleLabel(level: string): string {
  const normalizedLevel = level.trim().toLowerCase()
  const nsMatch = normalizedLevel.match(/\bns\s*([1-4])\b/)
  if (nsMatch) return "Cycle 4"

  const levelNumber = extractLevelNumber(level)
  if (!levelNumber) return ""

  if (levelNumber >= 1 && levelNumber <= 3) return "Cycle 1"
  if (levelNumber >= 4 && levelNumber <= 6) return "Cycle 2"
  if (levelNumber >= 7 && levelNumber <= 9) return "Cycle 3"

  return ""
}

function cleanRoomLabel(value: string | null | undefined): string {
  if (!value) return ""

  return value
    .trim()
    .replace(/^salle\s+/i, "")
    .replace(/^section\s+/i, "")
    .trim()
}

function extractRoomFromLevel(level: string): string {
  const match = level.match(/\s[-–]\s*([A-Za-z0-9]+)\s*$/)
  return cleanRoomLabel(match?.[1])
}

function getRoomLabel(data: BulletinData): string {
  const record = data as BulletinData & {
    salle?: string | null
    salleName?: string | null
    salleNom?: string | null
    section?: string | null
    room?: string | null
    roomName?: string | null
  }

  return (
    cleanRoomLabel(record.salle) ||
    cleanRoomLabel(record.salleName) ||
    cleanRoomLabel(record.salleNom) ||
    cleanRoomLabel(record.section) ||
    cleanRoomLabel(record.room) ||
    cleanRoomLabel(record.roomName) ||
    extractRoomFromLevel(data.niveau || "")
  )
}

function formatLevelForBulletin(level: string, room: string): string {
  const normalizedLevel = level
    .replace(/\s[-–]\s*[A-Za-z0-9]+\s*$/, "")
    .replace(/\bA\.?\s*F\.?\b/gi, "A.F.")
    .replace(/^\s*1\s*(?:e|ere|ère)?\b/i, "1ere")
    .replace(/\s+/g, " ")
    .trim()

  return room ? `${normalizedLevel} - ${room}` : normalizedLevel
}
function extractStepNumber(period: string): number | null {
  const match = period.match(/\d+/)
  if (!match) return null

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function getPeriodDetails(period: string): { label: string; months: string } {
  const stepNumber = extractStepNumber(period)
  if (!stepNumber) return { label: "Période", months: "" }

  const periodNumber = stepNumber > 1 ? stepNumber - 1 : stepNumber
  const monthsByPeriod: Record<number, string> = {
    1: "Septembre-Octobre",
    2: "Novembre-Décembre",
    3: "Mars-Avril",
    4: "Mai-Juin",
  }

  return {
    label: `Période ${periodNumber}`,
    months: monthsByPeriod[periodNumber] ?? "",
  }
}

function BulletinHeader({ data }: Readonly<{ data: BulletinData }>) {
  const etab = data.etablissement
  const cycleLabel = getCycleLabel(data.niveau)
  const periodDetails = getPeriodDetails(data.periode)
  const firstName = data.prenoms || "—"
  const lastName = (data.nom || "—").toLocaleUpperCase("fr")
  const roomLabel = getRoomLabel(data)
  const level = formatLevelForBulletin(data.niveau || "—", roomLabel)
  const period = data.periode || "—"
  const birthDate = data.dateNaissance || "—"
  const academicYear = data.anneeScolaire || "—"
  const nisu = data.nisu || "—"
  const studentCode = `Code: ${data.code || "—"}`

  return (
    <header className="bulletin-header" aria-label="En-tête du bulletin">
      <h1
        className="bulletin-header-title"
        data-pdf-anchor="bulletin-title"
        aria-label="Bulletin Scolaire"
      >
        <PdfSvgTextLine value="Bulletin Scolaire" align="middle" />
      </h1>

      <div className="bulletin-header-grid">
        <div className="bulletin-logo-block">
          {etab.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="bulletin-logo"
              src={normalizeUploadUrl(etab.logoUrl)}
              alt={`Logo ${etab.nomLigne2 || "établissement"}`}
            />
          ) : (
            <div className="bulletin-logo-placeholder" aria-hidden="true" />
          )}
<div className="bulletin-founded" aria-label="Depuis 1993!">
  <PdfSvgTextLine value="Depuis 1993!" align="middle" fontFamily={PDF_HEADER_FOUNDED_FONT} />
</div>
        </div>

        <div className="bulletin-header-spacer" aria-hidden="true" />

        <div className="bulletin-info-grid">
          <div
            className="info-label info-row-1 info-col-identity-label"
            aria-label="Prénom(s)"
          >
            <PdfSvgTextLine value="Prénom(s)" />
          </div>
          <div
            className="info-value info-first-name info-row-1 info-col-identity-value"
            data-pdf-anchor="student-firstname"
            aria-label={firstName}
          >
            <PdfSvgTextLine value={firstName} fontFamily={PDF_HEADER_STUDENT_FONT} />
          </div>

          <div className="info-school-label-block info-row-1 info-col-school-label">
            <div className="info-school-primary" aria-label="Niveau">
              <PdfSvgTextLine value="Niveau" />
            </div>
            {cycleLabel ? (
              <div
                className="info-school-secondary info-level-secondary"
                aria-label={cycleLabel}
              >
                <PdfSvgTextLine value={cycleLabel} />
              </div>
            ) : null}
          </div>
          <div
            className="info-school-value info-row-1 info-col-school-value"
            aria-label={level}
          >
            <PdfSvgTextLine value={level} fontFamily={PDF_HEADER_STUDENT_FONT} />
          </div>

          <div
            className="info-label info-row-2 info-col-identity-label"
            aria-label="Nom"
          >
            <PdfSvgTextLine value="Nom" />
          </div>
          <div
            className="info-value info-last-name info-row-2 info-col-identity-value"
            data-pdf-anchor="student-lastname"
            aria-label={lastName}
          >
            <PdfSvgTextLine value={lastName} fontFamily={PDF_HEADER_STUDENT_FONT} />
          </div>

          <div className="info-school-label-block info-row-2 info-col-school-label">
            <div className="info-school-primary" aria-label={periodDetails.label}>
              <PdfSvgTextLine value={periodDetails.label} />
            </div>
            {periodDetails.months ? (
              <div
                className="info-school-secondary info-period-secondary"
                aria-label={periodDetails.months}
              >
                <PdfSvgTextLine value={periodDetails.months} />
              </div>
            ) : null}
          </div>
          <div
            className="info-school-value info-row-2 info-col-school-value"
            aria-label={period}
          >
            <PdfSvgTextLine value={period} fontFamily={PDF_HEADER_STUDENT_FONT} />
          </div>

          <div
            className="info-label info-birth-label info-row-3 info-col-identity-label"
            aria-label="Date de naissance"
          >
            <PdfSvgTextLine value="Date de naissance" />
          </div>
          <div
            className="info-value info-birth-value info-row-3 info-col-identity-value"
            aria-label={birthDate}
          >
            <PdfSvgTextLine value={birthDate} fontFamily={PDF_HEADER_STUDENT_FONT} />
          </div>

          <div
            className="info-label info-row-3 info-col-school-label"
            aria-label="Année scolaire"
          >
            <PdfSvgTextLine value="Année scolaire" />
          </div>
          <div
            className="info-academic-year-value info-row-3 info-col-school-value"
            aria-label={academicYear}
          >
            <PdfSvgTextLine value={academicYear} />
          </div>

          <div
            className="info-label info-row-4 info-col-school-label"
            aria-label="NISU"
          >
            <PdfSvgTextLine value="NISU" />
          </div>
          <div
            className="info-nisu-value info-row-4 info-col-school-value"
            aria-label={nisu}
          >
            <PdfSvgTextLine value={nisu} />
          </div>
        </div>

        <div className="bulletin-header-spacer" aria-hidden="true" />

        <div className="bulletin-photo-block">
          <div className="bulletin-photo">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={normalizeUploadUrl(data.photoUrl)}
                alt={`${data.prenoms} ${data.nom}`}
                className="bulletin-photo-img"
              />
            ) : (
              <svg viewBox="0 0 120 138" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <rect width="120" height="138" fill="#f7f7f7" />
                <circle cx="60" cy="50" r="24" fill="#cfd6de" />
                <path d="M18 138 q0 -40 42 -40 q42 0 42 40 z" fill="#cfd6de" />
              </svg>
            )}
          </div>
          <div className="bulletin-student-code" aria-label={studentCode}>
            <PdfSvgTextLine value={studentCode} align="middle" />
          </div>
        </div>
      </div>
    </header>
  )
}

export function BulletinPrintable({ data }: { data: BulletinData; renderMode?: "preview" | "pdf" }) {
  const { etablissement: etab, comportement: comp } = data
  const behaviorMetrics = {
    absences: displayBehaviorMetric(comp.absences),
    retards: displayBehaviorMetric(comp.retards),
    devoirsNonRemis: displayBehaviorMetric(comp.devoirsNonRemis),
    leconsNonSues: displayBehaviorMetric(comp.leconsNonSues),
    uniforme: displayBehaviorMetric(comp.uniforme),
    discipline: displayBehaviorMetric(comp.discipline),
  }
  const uniformeTone = colorClass(parseDisplayNumber(behaviorMetrics.uniforme), 10)
  const disciplineTone = colorClass(parseDisplayNumber(behaviorMetrics.discipline), 10)
  const cleanRemarque = cleanBehaviorRemark(comp.remarque)
  const col1 = comp.items.filter((c) => c.col === 1)
  const col2 = comp.items.filter((c) => c.col === 2)
  const col3 = comp.items.filter((c) => c.col === 3)

  const moyClasse = data.moyenneClasse && data.moyenneClasse !== "" ? data.moyenneClasse : "—"
  const moyClasseNumber = parseDisplayNumber(moyClasse)
  const moyenneEtapeNumber = parseDisplayNumber(data.moyenneEtape)
  const moyenneGenerale = data.moyenneGenerale && data.moyenneGenerale !== "" ? data.moyenneGenerale : null
  const moyenneGeneraleNumber = parseDisplayNumber(moyenneGenerale)

  return (
    <div className="btpl" data-bulletin-page="true">
      <style>{CSS}</style>

      <div className="page bulletin-print">
        <div className="page-content">
        {/* ===== HEADER ===== */}
        <BulletinHeader data={data} />

        {/* ===== 3 RUBRIQUES ===== */}
        <div className="academic-section">
          <div className="rubrics-grid">
          <div className="rubric-column rubric-column-1">
            <RubriqueTable title={data.rubrique1Name} fallbackTitle="Rubrique 1" entries={data.rubrique1} anchorPrefix="rubric-1" />
            <MoyLine label="Moyenne sur 10" value={formatBulletinNumber(data.moyR1)} valueTone={colorClass(data.moyR1, 10)} />
            <MoyLine label="Moyenne classe sur 10" value={formatBulletinNumber(data.moyClasseR1)} valueTone={colorClass(data.moyClasseR1, 10)} variant="class" />
          </div>

          <div className="rubric-spacer" aria-hidden="true" />

          <div className="rubric-column rubric-column-2">
            <RubriqueTable title={data.rubrique2Name} fallbackTitle="Rubrique 2" entries={data.rubrique2} anchorPrefix="rubric-2" />
            <MoyLine label="Moyenne sur 10" value={formatBulletinNumber(data.moyR2)} valueTone={colorClass(data.moyR2, 10)} />
            <MoyLine label="Moyenne classe sur 10" value={formatBulletinNumber(data.moyClasseR2)} valueTone={colorClass(data.moyClasseR2, 10)} variant="class" />
            <div className="etape-block">
              <MoyLine label="Moy. de l'étape" value={data.moyenneEtape} valueTone={colorClass(moyenneEtapeNumber, 10)} variant="step" />
              <MoyLine label="Appréciation" value={data.appreciation || "—"} valueTone={colorClass(moyenneEtapeNumber, 10)} variant="appreciation" />
              <MoyLine label="Moyenne classe sur 10" value={moyClasse} valueTone={colorClass(moyClasseNumber, 10)} variant="general-class" />
              {moyenneGenerale ? (
                <MoyLine
                  label="Moyenne générale"
                  value={moyenneGenerale}
                  valueTone={colorClass(moyenneGeneraleNumber, 10)}
                  variant="general"
                />
              ) : null}
            </div>
          </div>

          <div className="rubric-spacer" aria-hidden="true" />

          <div className="rubric-column rubric-column-3">
            <RubriqueTable title={data.rubrique3Name} fallbackTitle="Rubrique 3" entries={data.rubrique3} anchorPrefix="rubric-3" />
            <MoyLine label="Moyenne sur 10" value={formatBulletinNumber(data.moyR3)} valueTone={colorClass(data.moyR3, 10)} />
            <MoyLine label="Moyenne classe sur 10" value={formatBulletinNumber(data.moyClasseR3)} valueTone={colorClass(data.moyClasseR3, 10)} variant="class" />
          </div>
          </div>
        </div>

        <div className="lower-section">
          {/* ===== COMPORTEMENT ===== */}
          <div className="behav-title" data-pdf-anchor="behavior-title">
            <PdfInlineSvgText value="Difficultés de comportement et / ou d'apprentissage" align="start" />
          </div>
          <div className="behav-grid">
            <BehTable items={col1} />
            <BehTable items={col2} right />
            <BehTable items={col3} right />
          </div>

          <div className="behavior-metrics-grid">
            <div>
              <BehaviorMetricLine label={"Nbre d'absences"} value={behaviorMetrics.absences} labelAlign="start" />
              <BehaviorMetricLine label="Nbre de retards" value={behaviorMetrics.retards} labelAlign="start" />
            </div>
            <div>
              <BehaviorMetricLine label="Nbre de devoirs non remis" value={behaviorMetrics.devoirsNonRemis} />
              <BehaviorMetricLine label="Nbre de leçons non sues" value={behaviorMetrics.leconsNonSues} />
            </div>
            <div>
              <BehaviorMetricLine label={"Respect des prescrits de l'uniforme"} value={behaviorMetrics.uniforme} valueTone={uniformeTone} />
              <BehaviorMetricLine label="Discipline" value={behaviorMetrics.discipline} valueTone={disciplineTone} />
            </div>
          </div>

          {/* ===== POINTS FORTS / REMARQUE ===== */}
          <div className="observations-grid">
            <div className="observation-main">
              <div className="h-maroon"><PdfInlineSvgText value="Points forts et / ou défis à relever" align="start" /></div>
              <div className="h-maroon2"><PdfInlineSvgText value="Point(s) fort(s) :" align="start" /></div>
              <p className="plain">{comp.pointsForts || " "}</p>
              <div className="h-maroon2 challenge-label"><PdfInlineSvgText value="Défi(s) à relever :" align="start" /></div>
              <p className="plain">{comp.defis || " "}</p>
            </div>
            <div aria-hidden="true" />
            <div className="remark-block">
              <div className="h-maroon"><PdfInlineSvgText value="Remarque" align="start" /></div>
              <p className="plain">{cleanRemarque || " "}</p>
            </div>
            <div aria-hidden="true" />
          </div>

          {/* ===== LÉGENDE / FOOTER + SIGNATURES ===== */}
          <div className="bottom-area">
            <div className="legend-col">
              <div className="legend-title" data-pdf-anchor="footer-legend"><PdfInlineSvgText value="Légende des notes et des couleurs" align="start" /></div>
<div className="legend legend-grid">
  <div className="legend-item">90 - 100 : <b>A+ = Excellent</b></div>
  <div className="legend-item">78 - 84 : <b>B+ = Très bien</b></div>
  <div className="legend-item">69 - 74 : <b>C+ = Bien</b></div>
  <div className="legend-item">51 - 59 : <b style={{ color: "var(--orange)" }}>D = Déficient</b></div>

  <div className="legend-item">85 - 89 : <b>A = Excellent</b></div>
  <div className="legend-item">75 - 77 : <b>B = Très bien</b></div>
  <div className="legend-item">60 - 68 : <b style={{ color: "var(--green)" }}>C = Assez bien</b></div>
  <div className="legend-item">&le; 50 : <b style={{ color: "var(--red)" }}>E = Échec</b></div>
</div>
              <div className="footer-rule">
                <div className="first">Seuil de réussite pour promotion automatique en classe supérieure 7.00</div>
                <div>Calcul de la moyenne de l&apos;étape : 70% Rubrique 1 + 25% Rubrique 2 + 5% Rubrique 3</div>
                <div>Calcul de la moyenne générale : Somme des étapes / nbre d&apos;Étapes</div>
              </div>
              <div className="contact">{etab.adresse} / Téléphone : {etab.telephone} / Courriel : {etab.email}</div>
            </div>

            <div aria-hidden="true" />

            <div className="sign-col">
              <div className="signbox"><div className="signline" /><div className="signlabel"><PdfInlineSvgText value="Parent" align="middle" /></div></div>
              <div className="signbox signbox-direction"><div className="signline" /><div className="signlabel" data-pdf-anchor="direction-signature"><PdfInlineSvgText value="Direction" align="middle" /></div></div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}


// -----------------------------------------------------------------------------
const CSS = `
.btpl{
  --ink:#1c1c22; --blue:${BULLETIN_BLUE}; --blue2:#4a9bcc; --hand:#16335c;
  --check:#1f5fae; --red:#cf3a35; --orange:#d9a21b; --maroon:#8a1b1b;
  --line:#2a2a2a; --green:#318c53;
  --header-blue:${BULLETIN_BLUE};
  --font-serif:${FONT_SERIF};
  --font-label:${FONT_LABEL};
  --font-student:${FONT_STUDENT};
  --font-founded:${FONT_FOUNDED};
  --paper-w:8.5in; --paper-h:11in; --template-w:1040px; --template-h:1345px;
  --template-scale:0.725;
  width:var(--paper-w);height:var(--paper-h);margin:0 auto;
  background:#fff;overflow:hidden;
}
.btpl.pdf-capture{overflow:visible;}
.btpl *{box-sizing:border-box;}
.btpl .pdf-svg-text-line{
  display:block;width:100%;height:1em;height:1lh;min-height:1em;
  overflow:visible;color:inherit;font-family:inherit;font-size:inherit;
  font-weight:inherit;font-style:inherit;letter-spacing:inherit;
}
.btpl img.pdf-font-image{
  display:block;
  width:100%;
  padding:0;
  margin:0;
  border:0;
  background:transparent;
  object-fit:fill;
}
.btpl .pdf-svg-text-glyph{
  fill:currentColor;font-family:inherit;font-size:inherit;font-weight:inherit;
  font-style:inherit;letter-spacing:inherit;word-spacing:inherit;
  text-rendering:geometricPrecision;white-space:pre;
}

.btpl .pdf-inline-svg-text{
  display:block;
  width:100%;
  height:1em;
  min-height:1em;
  overflow:visible;
  color:inherit;
  font-family:inherit;
  font-size:inherit;
  font-weight:inherit;
  font-style:inherit;
  line-height:inherit;
  letter-spacing:inherit;
}
.btpl .pdf-rasterized-svg-text{
  background:transparent !important;
  border:none !important;
  box-shadow:none !important;
}  
.btpl .pdf-inline-svg-text text{
  fill:currentColor;
  font-family:inherit;
  font-size:inherit;
  font-weight:inherit;
  font-style:inherit;
  letter-spacing:inherit;
  text-rendering:geometricPrecision;
  white-space:pre;
}
.btpl .page{
  width:var(--paper-w);height:var(--paper-h);margin:0 auto;background:#fff;
  padding:.14in .26in .28in;position:relative;overflow:hidden;
  font-family:Georgia,"Times New Roman",serif;color:var(--ink);
}
.btpl.pdf-capture .page{overflow:visible;}
.btpl .page-content{
  width:var(--template-w);height:var(--template-h);
  padding:6px 20px 20px;position:relative;
  display:flex;flex-direction:column;
  transform:scale(var(--template-scale));transform-origin:top left;
}
.btpl .bulletin-header{width:calc(540pt / var(--template-scale));margin:0 auto 16px;color:#111;}
.btpl .bulletin-header-title{
  width:100%;margin:0 0 calc(11pt / var(--template-scale));padding:0;text-align:center;color:var(--header-blue);
  font-family:var(--font-serif);font-size:calc(22pt / var(--template-scale));font-weight:700;font-style:normal;
  line-height:calc(22pt / var(--template-scale));letter-spacing:normal;
}
.btpl .bulletin-header-grid{
  display:grid;
  grid-template-columns:calc(90pt / var(--template-scale)) calc(8pt / var(--template-scale)) calc(358pt / var(--template-scale)) calc(4pt / var(--template-scale)) calc(80pt / var(--template-scale));
  align-items:start;width:100%;
}
.btpl .bulletin-logo-block{
  width:calc(90pt / var(--template-scale));
  text-align:center;
  padding-top:0;
  margin:0 auto;
  transform:translateY(calc(-7pt / var(--template-scale)));
}
.btpl .bulletin-logo{
  width:100%;max-width:calc(90pt / var(--template-scale));max-height:calc(90pt / var(--template-scale));
  object-fit:contain;object-position:center;display:block;margin:0 auto;
}
.btpl .bulletin-logo-placeholder{width:calc(90pt / var(--template-scale));height:calc(90pt / var(--template-scale));margin:0 auto;}
.btpl .bulletin-founded{
  margin-top:calc(2pt / var(--template-scale));
  text-align:center;
  color:#4169E1;
  font-family:var(--font-founded);
  font-size:calc(6.2pt / var(--template-scale));
  font-weight:200;
  font-style:italic;
  line-height:calc(7pt / var(--template-scale));
  letter-spacing:normal;
}

.btpl .bulletin-founded svg text{
  fill:#4169E1 !important;
}
.btpl .bulletin-info-grid{
  width:calc(358pt / var(--template-scale));display:grid;
  grid-template-columns:calc(64pt / var(--template-scale)) calc(4pt / var(--template-scale)) calc(115pt / var(--template-scale)) calc(6pt / var(--template-scale)) calc(64pt / var(--template-scale)) calc(4pt / var(--template-scale)) calc(101pt / var(--template-scale));
  grid-template-rows:calc(23pt / var(--template-scale)) calc(23pt / var(--template-scale)) calc(19pt / var(--template-scale)) calc(19pt / var(--template-scale));
  align-items:start;margin:0;padding:0;box-sizing:border-box;
}
.btpl .info-row-1{grid-row:1;}
.btpl .info-row-2{grid-row:2;}
.btpl .info-row-3{grid-row:3;}
.btpl .info-row-4{grid-row:4;}
.btpl .info-col-identity-label{grid-column:1;}
.btpl .info-col-identity-value{grid-column:3;}
.btpl .info-col-school-label{grid-column:5;}
.btpl .info-col-school-value{grid-column:7;}
.btpl .info-label{
  color:#000;font-family:var(--font-label);font-size:calc(6.5pt / var(--template-scale));
  font-weight:400;font-style:normal;line-height:calc(8pt / var(--template-scale));white-space:nowrap;
  margin:0;padding:0;align-self:start;
}
.btpl .info-birth-label{color:var(--header-blue);font-weight:600;}
.btpl .info-value{min-width:0;margin:0;padding:0;color:#000;}
.btpl .info-first-name{
  font-family:var(--font-student);font-size:calc(11pt / var(--template-scale));
  font-weight:400;font-style:normal;line-height:calc(12pt / var(--template-scale));text-transform:none;
}
.btpl .info-last-name{
  font-family:var(--font-student);font-size:calc(11pt / var(--template-scale));
  font-weight:400;font-style:normal;line-height:calc(12pt / var(--template-scale));text-transform:uppercase;
}
.btpl .info-birth-value{
  font-family:var(--font-student);font-size:calc(9.5pt / var(--template-scale));
  font-weight:400;font-style:normal;line-height:calc(10pt / var(--template-scale));
}
.btpl .info-secondary-value{
  font-family:var(--font-serif);font-size:calc(8pt / var(--template-scale));
  font-weight:400;font-style:normal;line-height:calc(9pt / var(--template-scale));color:#000;
}
.btpl .info-school-label-block{margin:0;padding:0;align-self:start;}
.btpl .info-school-primary{
  font-family:var(--font-label);font-size:calc(6.5pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(7pt / var(--template-scale));color:#000;margin:0;padding:0;
}
.btpl .info-school-secondary{
  font-family:var(--font-label);font-size:calc(5pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(5pt / var(--template-scale));color:#000;padding:0;
}
.btpl .info-level-secondary{margin-top:calc(3.25pt / var(--template-scale));}
.btpl .info-period-secondary{margin-top:calc(2.75pt / var(--template-scale));}
.btpl .info-school-value{
  color:#000;font-family:var(--font-student);font-size:calc(10.5pt / var(--template-scale));
  font-weight:400;font-style:normal;line-height:calc(11pt / var(--template-scale));
  margin:0;padding:0;white-space:nowrap;text-transform:none;
}
.btpl .info-academic-year-value{
  font-family:var(--font-serif);font-size:calc(7.5pt / var(--template-scale));
  font-weight:700;font-style:normal;line-height:calc(9pt / var(--template-scale));
  color:#000;margin:0;padding:0;white-space:nowrap;
}
.btpl .info-nisu-value{
  font-family:var(--font-serif);font-size:calc(6.8pt / var(--template-scale));
  font-weight:700;font-style:normal;line-height:calc(8pt / var(--template-scale));
  color:#000;margin:0;padding:0;white-space:nowrap;word-break:normal;overflow-wrap:normal;align-self:start;
}
.btpl .bulletin-photo-block{
  width:calc(80pt / var(--template-scale));display:flex;flex-direction:column;
  align-items:center;justify-content:flex-start;margin:0 auto;text-align:center;
}
.btpl .bulletin-photo{
  width:calc(80pt / var(--template-scale));height:calc(91pt / var(--template-scale));margin:0;padding:0;border:1px solid #8f8f8f;background:#f7f7f7;
  display:flex;align-items:center;justify-content:center;overflow:hidden;
}
.btpl .bulletin-photo-img{width:100%;height:100%;object-fit:cover;object-position:50% 25%;display:block;}
.btpl .bulletin-photo svg{width:100%;height:100%;display:block;}
.btpl .bulletin-student-code{
  width:100%;margin-top:calc(2pt / var(--template-scale));padding:0;text-align:center;
  font-family:var(--font-serif);font-size:calc(7.5pt / var(--template-scale));
  font-weight:700;font-style:normal;line-height:calc(8pt / var(--template-scale));
  color:#000;white-space:normal;overflow-wrap:anywhere;
}
.btpl hr.sep{display:none;}
.btpl .academic-section{
  width:calc(540pt / var(--template-scale));margin:calc(8pt / var(--template-scale)) auto 0;
  box-sizing:border-box;
}
.btpl .rubrics-grid{
  display:grid;
  grid-template-columns:calc(185pt / var(--template-scale)) calc(10pt / var(--template-scale)) calc(175pt / var(--template-scale)) calc(10pt / var(--template-scale)) calc(160pt / var(--template-scale));
  width:calc(540pt / var(--template-scale));align-items:start;box-sizing:border-box;
}
.btpl .rubric-column{display:flex;flex-direction:column;min-width:0;}
.btpl .rubrique-table{width:100%;box-sizing:border-box;}
.btpl .rubrique-title{
  font-family:var(--font-serif);font-size:calc(7.5pt / var(--template-scale));font-weight:700;
  font-style:normal;line-height:calc(7.5pt / var(--template-scale));color:var(--header-blue);
  margin:0 0 calc(7pt / var(--template-scale));padding:0;
}
.btpl .rubrique-score-grid{width:100%;box-sizing:border-box;}
.btpl .rubrique-row{
  display:grid;grid-template-columns:minmax(0,1fr) calc(30pt / var(--template-scale)) calc(26pt / var(--template-scale));
  align-items:stretch;width:100%;box-sizing:border-box;margin:0;padding:0;
}
.btpl .score-header{
  height:calc(11pt / var(--template-scale));
  min-height:calc(11pt / var(--template-scale));
  position:relative;
  display:block;
  overflow:hidden;
  line-height:0;
  text-align:center;
  color:#000;
  border:calc(0.5pt / var(--template-scale)) solid #000;
  box-sizing:border-box;
  padding:0;
}
.btpl .score-header-svg{
  display:block;
  width:100%;
  height:100%;
  overflow:visible;
}
.btpl .score-header-coeff{border-left:none;}
.btpl .subject-group{
  font-family:var(--font-serif);font-size:calc(8pt / var(--template-scale));font-weight:700;
  font-style:normal;line-height:calc(9.5pt / var(--template-scale));color:#000;
  text-decoration-line:underline;text-decoration-color:#000;text-decoration-thickness:calc(0.5pt / var(--template-scale));
  text-underline-offset:calc(1.5pt / var(--template-scale));margin:0;
  padding:calc(4pt / var(--template-scale)) calc(2pt / var(--template-scale)) calc(1.75pt / var(--template-scale)) 0;
  min-width:0;overflow-wrap:break-word;word-break:normal;
}
.btpl .subject-group-first{padding-top:0;}
.btpl .subject-item{
  font-family:var(--font-serif);font-size:calc(7.5pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(9pt / var(--template-scale));color:#000;margin:0;padding:0 calc(2pt / var(--template-scale)) 0 0;
  min-width:0;overflow-wrap:break-word;word-break:normal;
}
.btpl .note-cell,.btpl .coeff-cell{
  display:flex;align-items:flex-start;justify-content:center;min-height:calc(9pt / var(--template-scale));
  text-align:center;box-sizing:border-box;padding:0;position:relative;color:#000;
  border-left:calc(0.5pt / var(--template-scale)) solid #000;border-right:calc(0.5pt / var(--template-scale)) solid #000;
}
.btpl .coeff-cell{border-left:none;}
.btpl .note-value{
  font-family:var(--font-serif);font-size:calc(7.3pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(9pt / var(--template-scale));
}
.btpl .coefficient-value{
  font-family:var(--font-serif);font-size:calc(7pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(9pt / var(--template-scale));
}
.btpl .rubric-empty-cell{min-height:calc(9.5pt / var(--template-scale));}
/*
 * Réserve verticale au bas de la colonne Notes/Coeff.
 * html2canvas dessine les chiffres HTML légèrement plus bas que Chromium.
 * On agrandit uniquement la dernière ligne de données pour empêcher la
 * bordure supérieure du total de traverser la dernière note/coefficient,
 * sans augmenter l'interligne de toute la rubrique.
 */
.btpl .rubrique-last-data-row .note-cell,
.btpl .rubrique-last-data-row .coeff-cell{
  min-height:calc(12.5pt / var(--template-scale));
  padding-bottom:calc(3pt / var(--template-scale));
}
.btpl .total-cell {
  min-height: calc(13pt / var(--template-scale));

  font-family: var(--font-serif);
  font-size: calc(6.8pt / var(--template-scale));
  font-weight: 700;
  font-style: normal;
  line-height: calc(8pt / var(--template-scale));
  text-align: center;
  color: #000;

  border-top: calc(0.5pt / var(--template-scale)) solid #000;
  border-bottom: calc(0.5pt / var(--template-scale)) solid #000;

  padding:
    calc(0.5pt / var(--template-scale))
    0
    calc(4.5pt / var(--template-scale));

  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.btpl .total-value{display:inline-block;line-height:calc(8pt / var(--template-scale));padding:0;}
.btpl .red{color:var(--red);}
.btpl .orange{color:var(--orange);}
.btpl .green{color:var(--green);}
.btpl .mline{
  display:grid;
  grid-template-columns:minmax(0,1fr) calc(30pt / var(--template-scale)) calc(26pt / var(--template-scale));
  align-items:baseline;
  margin-top:calc(2.5pt / var(--template-scale));
  padding:0;
  width:100%;
  font-family:var(--font-serif);
  font-size:calc(7pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(9pt / var(--template-scale));
  color:#000;

}
/* Décale légèrement vers la gauche la ligne "Moyenne classe sur 10" sous les rubriques */
.btpl .rubric-column > .mline-class{
  margin-left:calc(-6pt / var(--template-scale));
}
/* Décale légèrement vers la gauche la ligne "Moyenne sur 10" sous les rubriques */
.btpl .rubric-column > .mline-rubric{
  margin-left:calc(-6pt / var(--template-scale));
}
.btpl .rubrique-table + .mline{
  margin-top:calc(5pt / var(--template-scale));
}

.btpl .mline .ml{
  white-space:nowrap;
  text-align:left;
  padding-right:calc(3pt / var(--template-scale));
}

.btpl .mline .leader{
  width:calc(30pt / var(--template-scale));
  text-align:center;
  font-family:var(--font-serif);
  font-size:calc(7pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(9pt / var(--template-scale));
  color:#777;
  letter-spacing:calc(0.5pt / var(--template-scale));
}

.btpl .mline .mv{
  width:calc(26pt / var(--template-scale));
  text-align:center;
  font-size:calc(7.5pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(9pt / var(--template-scale));
  white-space:nowrap;
  color:#000;
}

.btpl .mline-class .mv{
  font-size:calc(7.3pt / var(--template-scale));
  font-weight:700;
  line-height:calc(9pt / var(--template-scale));
}

/* Moyenne sur 10 / Moyenne classe sur 10 sous Rubrique 1, 2 et 3 */
.btpl .rubric-column > .mline .ml{
  text-align:right;
  padding-right:calc(3pt / var(--template-scale));
}

.btpl .rubric-column > .mline .mv{
  text-align:right;
}

/* Bloc Moy. de l'Étape sous Rubrique 2 : espace avant le bloc seulement */
.btpl .etape-block{
  margin-top:calc(16pt / var(--template-scale));
  margin-bottom:calc(12pt / var(--template-scale));
  padding-top:calc(12pt / var(--template-scale));
  background:transparent;
  border:0;
  border-radius:0;
}

.btpl .etape-block .mline{
  margin-top:calc(3pt / var(--template-scale));
}

.btpl .etape-block .mline:first-child{
  margin-top:0;
}

.btpl .etape-block .mline .ml{
  text-align:right;
  padding-right:calc(3pt / var(--template-scale));
}

.btpl .etape-block .mline .mv{
  text-align:right;
}

.btpl .mline-step .ml,
.btpl .mline-step .mv,
.btpl .mline-general .ml,
.btpl .mline-general .mv{
  font-size:calc(9.5pt / var(--template-scale));
  font-weight:700;
}

.btpl .mline-general{
  background:#DDF1FA;
  border:none;
  padding:0;
  margin-top:calc(3pt / var(--template-scale));
  align-items:baseline;
}
.btpl .mline-appreciation .ml{
  font-size:calc(7.5pt / var(--template-scale));
  font-weight:400;
}

.btpl .mline-appreciation .mv{
  font-size:calc(8.5pt / var(--template-scale));
  font-weight:700;
}

.btpl .mline-general-class{
  font-size:calc(7pt / var(--template-scale));
  font-weight:400;
}


.btpl .mline-general .ml{
  font-weight:700;
  text-align:right;
  padding-right:calc(3pt / var(--template-scale));
}

.btpl .mline-general .leader{
  color:#000;
}

.btpl .mline-general .mv{
  font-size:calc(8.8pt / var(--template-scale));
  font-weight:700;
  line-height:calc(10pt / var(--template-scale));
}
.btpl .mline .mv.red{color:var(--red);}
.btpl .mline .mv.orange{color:var(--orange);}
.btpl .mline .mv.green{color:var(--green);}
.btpl .blockgap{height:10px;}
.btpl .lower-section{
  width:calc(540pt / var(--template-scale));
  margin:calc(12pt / var(--template-scale)) auto 0;
  box-sizing:border-box;
  color:#000;
}
.btpl .behav-title{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(10pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(12pt / var(--template-scale));
  color:#000;
  text-decoration-line:underline;
  text-decoration-color:#000;
  text-decoration-thickness:calc(.5pt / var(--template-scale));
  text-underline-offset:calc(1.5pt / var(--template-scale));
  margin:0 0 calc(8pt / var(--template-scale));
  padding:0;
}
.btpl .behav-grid{
  display:grid;
  grid-template-columns:2.7fr 4.3fr 5fr;
  column-gap:calc(9pt / var(--template-scale));
  width:calc(540pt / var(--template-scale));
  align-items:start;
  box-sizing:border-box;
}
.btpl .behavior-group{width:100%;box-sizing:border-box;}
.btpl .behavior-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) calc(20pt / var(--template-scale)) calc(20pt / var(--template-scale));
  width:100%;
  align-items:stretch;
  min-height:calc(10.5pt / var(--template-scale));
  margin:0;
  padding:0;
  box-sizing:border-box;
}
.btpl .behavior-choice-header-row{
  align-items:center;
  min-height:calc(6pt / var(--template-scale));
}
.btpl .behavior-choice-header{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(5.5pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(6pt / var(--template-scale));
  color:#000;
  text-align:center;
  margin:0;
  padding:0;
}
.btpl .behavior-criterion{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(7.3pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(10.5pt / var(--template-scale));
  color:#000;
  margin:0;
  padding:0;
    /* Petit gap entre le texte et les colonnes OUI/NON */
  padding:0 calc(5pt / var(--template-scale)) 0 0;
  min-width:0;
  overflow-wrap:break-word;
  text-align:right;
}
.btpl .behav-grid > .behavior-group:nth-child(1) .behavior-criterion{
  text-align:left !important;
  justify-self:stretch;
  padding-left:0;
  padding-right:calc(5pt / var(--template-scale));
}
.btpl .behavior-choice-cell{
  min-height:calc(10.5pt / var(--template-scale));
  display:flex;
  align-items:center;
  justify-content:center;
  border-bottom:calc(.4pt / var(--template-scale)) solid #000;
  box-sizing:border-box;
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(8.5pt / var(--template-scale));
  font-weight:400;
  line-height:calc(9pt / var(--template-scale));
  color:#000;
}
.btpl .behavior-check{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(8.5pt / var(--template-scale));
  font-weight:400;
  line-height:calc(9pt / var(--template-scale));
  color:#000;
}
.btpl .behavior-metrics-grid{
  display:grid;
  grid-template-columns:2.7fr 4.3fr 5fr;
  column-gap:calc(9pt / var(--template-scale));
  width:calc(540pt / var(--template-scale));
  align-items:start;
  margin-top:calc(8pt / var(--template-scale));
  box-sizing:border-box;
}
.btpl .behavior-metric-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) calc(20pt / var(--template-scale)) calc(20pt / var(--template-scale));
  align-items:baseline;
  width:100%;
  min-height:calc(10pt / var(--template-scale));
  margin:0;
  padding:0;
  box-sizing:border-box;
}
.btpl .behavior-metric-label{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(7.5pt / var(--template-scale));
  font-weight:400;
  font-style:italic;
  line-height:calc(10pt / var(--template-scale));
  color:#000;
  margin:0;
  padding:0;
  min-width:0;
  overflow-wrap:break-word;
}
.btpl .behavior-metric-label{
  grid-column:1;
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(7.5pt / var(--template-scale));
  font-weight:400;
  font-style:italic;
  line-height:calc(10pt / var(--template-scale));
  color:#000;
  margin:0;
  padding:0 calc(5pt / var(--template-scale)) 0 0;
  min-width:0;
  overflow-wrap:break-word;
}

.btpl .behavior-metric-value{
  grid-column:3;
  justify-self:stretch;
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(8pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(10pt / var(--template-scale));
  color:#000;
  text-align:center;
}

.btpl .behavior-metric-value.red{color:var(--red);}
.btpl .behavior-metric-value.orange{color:var(--orange);}
.btpl .behavior-metric-value.green{color:var(--green);}

.btpl .behavior-metrics-grid > div:nth-child(1) .behavior-metric-label{
  text-align:left;
}
.btpl .behavior-metrics-grid > div:nth-child(2) .behavior-metric-label,
.btpl .behavior-metrics-grid > div:nth-child(3) .behavior-metric-label{
  text-align:right;
}
.btpl .observations-grid{
  display:grid;
  grid-template-columns:calc(302pt / var(--template-scale)) calc(20pt / var(--template-scale)) calc(175pt / var(--template-scale)) calc(43pt / var(--template-scale));
  width:calc(540pt / var(--template-scale));
  align-items:start;
  box-sizing:border-box;
  margin-top:calc(9pt / var(--template-scale));
}
.btpl .observation-main,
.btpl .remark-block{min-height:calc(70pt / var(--template-scale));}
.btpl .h-maroon{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(8.5pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(10pt / var(--template-scale));
  color:#000;
  text-decoration-line:underline;
  text-decoration-color:#000;
  text-decoration-thickness:calc(.5pt / var(--template-scale));
  text-underline-offset:calc(1.5pt / var(--template-scale));
  margin:0 0 calc(3pt / var(--template-scale));
  padding:0;
}
.btpl .h-maroon2{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(7.2pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(8.5pt / var(--template-scale));
  color:#C85C65;
  margin:0 0 calc(0.5pt / var(--template-scale));
  padding:0;
}

.btpl .challenge-label{
  margin-top:calc(9pt / var(--template-scale));
}
.btpl .challenge-label{margin-top:calc(3.5pt / var(--template-scale));}
.btpl .plain{
  font-family:Arial,Helvetica,sans-serif;
  font-size:calc(6.9pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(8.75pt / var(--template-scale));
  color:#000;
  margin:0;
  padding:0;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  word-break:normal;
  text-align:left;
}
.btpl .bottom-area{
  display:grid;
  grid-template-columns:calc(340pt / var(--template-scale)) calc(40pt / var(--template-scale)) calc(160pt / var(--template-scale));
  width:calc(540pt / var(--template-scale));
  align-items:end;
  box-sizing:border-box;
  margin-top:calc(18pt / var(--template-scale));
  padding:0;
  break-inside:avoid;
  page-break-inside:avoid;
}
.btpl .legend-col{break-inside:avoid;page-break-inside:avoid;}
.btpl .legend-title{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(6.5pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(7pt / var(--template-scale));
  color:#000;
  text-decoration-line:underline;
  text-decoration-color:#000;
  text-decoration-thickness:calc(.4pt / var(--template-scale));
  text-underline-offset:calc(1pt / var(--template-scale));
  margin:0 0 calc(3pt / var(--template-scale));
  padding:0;
}
.btpl .legend{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(5.8pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(7pt / var(--template-scale));
  color:#000;
  margin:0;
  padding:0;
}
.btpl .legend-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  column-gap:calc(2pt / var(--template-scale));
  row-gap:calc(.5pt / var(--template-scale));
  align-items:start;
}

.btpl .legend-item{
  min-width:0;
  white-space:nowrap;
  text-align:left;
}

.btpl .legend b{font-weight:700;}
.btpl .footer-rule{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(5.8pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(7pt / var(--template-scale));
  color:#000;
  margin-top:calc(4pt / var(--template-scale));
}
.btpl .footer-rule .first{
  font-size:calc(5.8pt / var(--template-scale));
  font-weight:700;
  line-height:calc(6.4pt / var(--template-scale));
  margin-bottom:calc(.6pt / var(--template-scale));
}
.btpl .contact{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(5.8pt / var(--template-scale));
  font-weight:400;
  font-style:normal;
  line-height:calc(7pt / var(--template-scale));
  color:#000;
  margin-top:calc(2pt / var(--template-scale));
  padding:0;
  overflow-wrap:break-word;
}
.btpl .sign-col{
  width:calc(160pt / var(--template-scale));
  display:flex;
  flex-direction:column;
  align-items:center;
  box-sizing:border-box;
  break-inside:avoid;
  page-break-inside:avoid;
}
.btpl .signbox{
  width:calc(160pt / var(--template-scale));
  text-align:center;
  break-inside:avoid;
  page-break-inside:avoid;
}
.btpl .signbox-direction{margin-top:calc(70pt / var(--template-scale));}
.btpl .signline{
  width:calc(130pt / var(--template-scale));
  height:0;
  border-top:calc(.5pt / var(--template-scale)) solid #4DA3CF;
  margin:0 auto;
  padding:0;
}
.btpl .signlabel{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(7.5pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(9pt / var(--template-scale));
  color:#000;
  text-align:center;
  margin-top:calc(4pt / var(--template-scale));
  padding:0;
}

/* Réduction légère des tailles de police du bulletin */
.btpl .rubrique-title{
  font-size:calc(7.2pt / var(--template-scale));
  line-height:calc(7.2pt / var(--template-scale));
}

.btpl .subject-group{
  font-size:calc(7.6pt / var(--template-scale));
  line-height:calc(9pt / var(--template-scale));
}

.btpl .subject-item{
  font-size:calc(7.2pt / var(--template-scale));
  line-height:calc(8.7pt / var(--template-scale));
}

.btpl .note-value{
  font-size:calc(7pt / var(--template-scale));
}

.btpl .coefficient-value{
  font-size:calc(6.8pt / var(--template-scale));
}

.btpl .mline{
  font-size:calc(6.8pt / var(--template-scale));
}

.btpl .behavior-criterion{
  font-size:calc(7pt / var(--template-scale));
  line-height:calc(10pt / var(--template-scale));
}

.btpl .behavior-metric-label{
  font-size:calc(7.2pt / var(--template-scale));
  line-height:calc(9.7pt / var(--template-scale));
}

.btpl .behavior-metric-value{
  font-size:calc(7.7pt / var(--template-scale));
  line-height:calc(9.7pt / var(--template-scale));
}

.btpl .plain{
  font-size:calc(6.6pt / var(--template-scale));
  line-height:calc(7.6pt / var(--template-scale));
}

.btpl .legend{
  font-size:calc(5.55pt / var(--template-scale));
  line-height:calc(6.8pt / var(--template-scale));
}

.btpl .footer-rule,
.btpl .contact{
  font-size:calc(5.55pt / var(--template-scale));
  line-height:calc(6.7pt / var(--template-scale));
}
  /* Underline stable pour les SVG */
.btpl .subject-group .pdf-inline-svg-text text,
.btpl .behav-title .pdf-inline-svg-text text,
.btpl .h-maroon .pdf-inline-svg-text text,
.btpl .h-maroon2 .pdf-inline-svg-text text,
.btpl .legend-title .pdf-inline-svg-text text{
  text-decoration-line:underline;
  text-decoration-color:#000;
  text-decoration-thickness:calc(.5pt / var(--template-scale));
  text-underline-offset:calc(1.5pt / var(--template-scale));
}
/* Texte SVG : hauteurs calées sur les line-height existants pour contourner le décalage html2canvas. */
.btpl .rubrique-title .pdf-inline-svg-text{height:calc(7.5pt / var(--template-scale));}
.btpl .score-header .pdf-inline-svg-text{height:100%;font-size:calc(6.8pt / var(--template-scale));font-weight:700;line-height:calc(11pt / var(--template-scale));}
.btpl .subject-group .pdf-inline-svg-text{height:calc(9.5pt / var(--template-scale));}
.btpl .subject-item .pdf-inline-svg-text{height:calc(9pt / var(--template-scale));}
.btpl .note-value .pdf-inline-svg-text,
.btpl .coefficient-value .pdf-inline-svg-text{height:calc(9pt / var(--template-scale));}
.btpl .total-value .pdf-inline-svg-text{height:calc(8pt / var(--template-scale));}
.btpl .mline .pdf-inline-svg-text{height:calc(9pt / var(--template-scale));}
.btpl .mline-step .pdf-inline-svg-text,
.btpl .mline-general .pdf-inline-svg-text{
  height:calc(10pt / var(--template-scale));
}
.btpl .mline-appreciation .pdf-inline-svg-text{height:calc(9pt / var(--template-scale));}
.btpl .behavior-choice-header .pdf-inline-svg-text{height:calc(6pt / var(--template-scale));}
.btpl .behavior-criterion .pdf-inline-svg-text{height:calc(10.5pt / var(--template-scale));}
.btpl .behavior-check .pdf-inline-svg-text{height:calc(9pt / var(--template-scale));}
.btpl .behavior-metric-label .pdf-inline-svg-text,
.btpl .behavior-metric-value .pdf-inline-svg-text{height:calc(10pt / var(--template-scale));}
.btpl .behav-title .pdf-inline-svg-text{height:calc(12pt / var(--template-scale));}
.btpl .h-maroon .pdf-inline-svg-text{height:calc(10pt / var(--template-scale));}
.btpl .h-maroon2 .pdf-inline-svg-text{height:calc(8.5pt / var(--template-scale));}
.btpl .legend-title .pdf-inline-svg-text{height:calc(7pt / var(--template-scale));}
.btpl .signlabel .pdf-inline-svg-text{height:calc(9pt / var(--template-scale));}
@media print{
  .btpl{width:var(--paper-w);height:var(--paper-h);break-after:page;page-break-after:always;}
  .btpl:last-child{break-after:auto;page-break-after:auto;}
  .btpl .page{box-shadow:none;width:var(--paper-w);height:var(--paper-h);margin:0;padding:.18in .32in .34in;}
}
`
