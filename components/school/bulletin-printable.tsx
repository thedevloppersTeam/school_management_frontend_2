"use client"

import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"
import { calculateRubriqueTotals, formatBulletinNumber } from "@/lib/bulletin-calculations"
import { normalizeUploadUrl } from "@/lib/upload-url"

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

  return (
    <div className="rubrique-table">
      <h2 className="rubrique-title" data-pdf-anchor={`${anchorPrefix}-title`}>{displayTitle}</h2>
      <div className="rubrique-score-grid">
        <div className="rubrique-row rubrique-header-row">
          <div aria-hidden="true" />
          <div className="score-header score-header-note" aria-label="Notes">
            <svg
              className="score-header-svg"
              width="100%"
              height="100%"
              aria-hidden="true"
              focusable="false"
            >
              <text
                x="50%"
                y="44%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Times New Roman, Liberation Serif, Times, serif"
                fontSize="12px"
                fontWeight="700"
                fill="#000000"
              >
                Notes
              </text>
            </svg>
          </div>
          <div className="score-header score-header-coeff" aria-label="Coefficient">
            <svg
              className="score-header-svg"
              width="100%"
              height="100%"
              aria-hidden="true"
              focusable="false"
            >
              <text
                x="50%"
                y="44%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Times New Roman, Liberation Serif, Times, serif"
                fontSize="12px"
                fontWeight="700"
                fill="#000000"
              >
                Coeff.
              </text>
            </svg>
          </div>
        </div>
        {entries.map((e, i) => {
          if (e.isParent) {
            const isFirstGroup = entries.slice(0, i).every((entry) => !entry.isParent)
            return (
              <div className="rubrique-row" key={`${e.name}-${i}`}>
                <div className={isFirstGroup ? "subject-group subject-group-first" : "subject-group"}>{e.name}</div>
                <div className="note-cell rubric-empty-cell" />
                <div className="coeff-cell rubric-empty-cell" />
              </div>
            )
          }
          const cc = colorClass(e.note, e.coeff)
          return (
            <div className="rubrique-row" key={`${e.name}-${i}`}>
              <div className="subject-item">{e.name}</div>
              <div
                className={`note-cell note-value ${cc}`}
                data-pdf-anchor={i === firstNoteIndex ? `${anchorPrefix}-first-note` : undefined}
              >
                {formatBulletinNumber(e.note)}
              </div>
              <div className="coeff-cell coefficient-value">{fmtC(e.coeff)}</div>
            </div>
          )
        })}
        <div className="rubrique-row rubrique-total-row">
          <div aria-hidden="true" />
          <div className="note-cell total-cell"><span className="total-value">{formatBulletinNumber(totals.note)}</span></div>
          <div className="coeff-cell total-cell"><span className="total-value">{fmtC(totals.coeff)}</span></div>
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
  variant?: "rubric" | "class" | "step" | "appreciation" | "general-class"
}>) {
  return (
    <div className={`mline mline-${variant}`}>
      <span className="ml">{label}</span>
      <span className="leader">...</span>
      <span
        className={valueTone ? `mv ${valueTone}` : "mv"}
        data-pdf-anchor={variant === "step" ? "step-average" : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function BehTable({ items }: Readonly<{ items: ComportementItem[]; right?: boolean }>) {
  return (
    <div className="behavior-group">
      <div className="behavior-row behavior-choice-header-row">
        <div aria-hidden="true" />
        <div className="behavior-choice-header">OUI</div>
        <div className="behavior-choice-header">NON</div>
      </div>
      {items.map((it, i) => (
        <div className="behavior-row" key={`${it.label}-${i}`}>
          <div className="behavior-criterion">{it.label}</div>
          <div className="behavior-choice-cell">{it.oui === true ? <span className="behavior-check">✓</span> : ""}</div>
          <div className="behavior-choice-cell">{it.oui === false ? <span className="behavior-check">✓</span> : ""}</div>
        </div>
      ))}
    </div>
  )
}

function BehaviorMetricLine({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="behavior-metric-row">
      <span className="behavior-metric-label">{label}</span>
      <b className="behavior-metric-value">{value}</b>
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

  return (
    <header className="bulletin-header" aria-label="En-tête du bulletin">
      <h1 className="bulletin-header-title" data-pdf-anchor="bulletin-title">Bulletin Scolaire</h1>

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
          <div className="bulletin-founded">Depuis 1998!</div>
        </div>

        <div className="bulletin-header-spacer" aria-hidden="true" />

        <div className="bulletin-info-grid">
          <div className="info-label info-row-1 info-col-identity-label">Prénom(s)</div>
          <div className="info-value info-first-name info-row-1 info-col-identity-value" data-pdf-anchor="student-firstname">{data.prenoms || "—"}</div>

          <div className="info-school-label-block info-row-1 info-col-school-label">
            <div className="info-school-primary">Niveau</div>
            {cycleLabel ? <div className="info-school-secondary info-level-secondary">{cycleLabel}</div> : null}
          </div>
          <div className="info-school-value info-row-1 info-col-school-value">{data.niveau || "—"}</div>

          <div className="info-label info-row-2 info-col-identity-label">Nom</div>
          <div className="info-value info-last-name info-row-2 info-col-identity-value" data-pdf-anchor="student-lastname">{data.nom || "—"}</div>

          <div className="info-school-label-block info-row-2 info-col-school-label">
            <div className="info-school-primary">{periodDetails.label}</div>
            {periodDetails.months ? <div className="info-school-secondary info-period-secondary">{periodDetails.months}</div> : null}
          </div>
          <div className="info-school-value info-row-2 info-col-school-value">{data.periode || "—"}</div>

          <div className="info-label info-birth-label info-row-3 info-col-identity-label">Date de naissance</div>
          <div className="info-value info-birth-value info-row-3 info-col-identity-value">{data.dateNaissance || "—"}</div>

          <div className="info-label info-row-3 info-col-school-label">Année scolaire</div>
          <div className="info-academic-year-value info-row-3 info-col-school-value">{data.anneeScolaire || "—"}</div>

          <div className="info-label info-row-4 info-col-identity-label">Sexe</div>
          <div className="info-secondary-value info-row-4 info-col-identity-value">{data.sexe || "—"}</div>

          <div className="info-label info-row-4 info-col-school-label">NISU</div>
          <div className="info-nisu-value info-row-4 info-col-school-value">{data.nisu || "—"}</div>
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
          <div className="bulletin-student-code">Code: {data.code || "—"}</div>
        </div>
      </div>
    </header>
  )
}

export function BulletinPrintable({ data }: { data: BulletinData }) {
  const { etablissement: etab, comportement: comp } = data
  const col1 = comp.items.filter((c) => c.col === 1)
  const col2 = comp.items.filter((c) => c.col === 2)
  const col3 = comp.items.filter((c) => c.col === 3)

  const moyClasse = data.moyenneClasse && data.moyenneClasse !== "" ? data.moyenneClasse : "—"
  const moyClasseNumber = parseDisplayNumber(moyClasse)
  const moyenneEtapeNumber = parseDisplayNumber(data.moyenneEtape)

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
              <MoyLine label="Appréciation" value={data.appreciation || "—"} variant="appreciation" />
              <MoyLine label="Moyenne classe sur 10" value={moyClasse} valueTone={colorClass(moyClasseNumber, 10)} variant="general-class" />
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
          <div className="behav-title" data-pdf-anchor="behavior-title">Difficultés de comportement et / ou d&apos;apprentissage</div>
          <div className="behav-grid">
            <BehTable items={col1} />
            <BehTable items={col2} right />
            <BehTable items={col3} right />
          </div>

          <div className="behavior-metrics-grid">
            <div>
              <BehaviorMetricLine label={"Nbre d'absences"} value={comp.absences} />
              <BehaviorMetricLine label="Nbre de retards" value={comp.retards} />
            </div>
            <div>
              <BehaviorMetricLine label="Nbre de devoirs non remis" value={comp.devoirsNonRemis} />
              <BehaviorMetricLine label="Nbre de leçons non sues" value={comp.leconsNonSues} />
            </div>
            <div>
              <BehaviorMetricLine label={"Respect des prescrits de l'uniforme"} value={comp.uniforme ?? "—"} />
              <BehaviorMetricLine label="Discipline" value={comp.discipline ?? "—"} />
            </div>
          </div>

          {/* ===== POINTS FORTS / REMARQUE ===== */}
          <div className="observations-grid">
            <div className="observation-main">
              <div className="h-maroon">Points forts et / ou défis à relever</div>
              <div className="h-maroon2">Point(s) fort(s) :</div>
              <p className="plain">{comp.pointsForts || " "}</p>
              <div className="h-maroon2 challenge-label">Défi(s) à relever :</div>
              <p className="plain">{comp.defis || " "}</p>
            </div>
            <div aria-hidden="true" />
            <div className="remark-block">
              <div className="h-maroon">Remarque</div>
              <p className="plain">{comp.remarque || " "}</p>
            </div>
            <div aria-hidden="true" />
          </div>

          {/* ===== LÉGENDE / FOOTER + SIGNATURES ===== */}
          <div className="bottom-area">
            <div className="legend-col">
              <div className="legend-title" data-pdf-anchor="footer-legend">Légende des notes et des couleurs</div>
              <div className="legend">
                90 - 100 : <b>A+ = Excellent</b>&nbsp;&nbsp;&nbsp;&nbsp;78 - 84 : <b>B+ = Très bien</b>&nbsp;&nbsp;&nbsp;69 - 74 : <b>C+ = Bien</b>&nbsp;&nbsp;&nbsp;51 - 59&nbsp; : <b style={{ color: "var(--orange)" }}>D = Déficient</b><br />
                85 - 89&nbsp; : <b>A = Excellent</b>&nbsp;&nbsp;&nbsp;&nbsp;75 - 77 : <b>B = Très bien</b>&nbsp;&nbsp;&nbsp;60 - 68 : <b style={{ color: "var(--green)" }}>C&nbsp; = Assez bien</b>&nbsp;&nbsp;&nbsp;&le; 50 : <b style={{ color: "var(--red)" }}>E = Échec</b>
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
              <div className="signbox"><div className="signline" /><div className="signlabel">Parent</div></div>
              <div className="signbox signbox-direction"><div className="signline" /><div className="signlabel" data-pdf-anchor="direction-signature">Direction</div></div>
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
.btpl .page{
  width:var(--paper-w);height:var(--paper-h);margin:0 auto;background:#fff;
  padding:.18in .32in .34in;position:relative;overflow:hidden;
  font-family:Georgia,"Times New Roman",serif;color:var(--ink);
}
.btpl.pdf-capture .page{overflow:visible;}
.btpl .page-content{
  width:var(--template-w);height:var(--template-h);
  padding:8px 26px 24px;position:relative;
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
  grid-template-columns:calc(90pt / var(--template-scale)) calc(8pt / var(--template-scale)) calc(358pt / var(--template-scale)) calc(8pt / var(--template-scale)) calc(76pt / var(--template-scale));
  align-items:start;width:100%;
}
.btpl .bulletin-logo-block{width:calc(90pt / var(--template-scale));text-align:center;padding-top:calc(2pt / var(--template-scale));margin:0 auto;}
.btpl .bulletin-logo{
  width:100%;max-width:calc(90pt / var(--template-scale));max-height:calc(90pt / var(--template-scale));
  object-fit:contain;object-position:center;display:block;margin:0 auto;
}
.btpl .bulletin-logo-placeholder{width:calc(90pt / var(--template-scale));height:calc(90pt / var(--template-scale));margin:0 auto;}
.btpl .bulletin-founded{
  margin-top:calc(2pt / var(--template-scale));text-align:center;color:#000;
  font-family:var(--font-founded);font-size:calc(7pt / var(--template-scale));
  font-weight:200;font-style:normal;line-height:calc(8pt / var(--template-scale));letter-spacing:normal;
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
  width:calc(76pt / var(--template-scale));display:flex;flex-direction:column;
  align-items:center;justify-content:flex-start;margin:0 auto;text-align:center;
}
.btpl .bulletin-photo{
  width:calc(76pt / var(--template-scale));height:calc(86pt / var(--template-scale));margin:0;padding:0;border:1px solid #8f8f8f;background:#f7f7f7;
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
  padding:calc(4pt / var(--template-scale)) 0 calc(1.75pt / var(--template-scale));
  min-width:0;overflow-wrap:break-word;word-break:normal;
}
.btpl .subject-group-first{padding-top:0;}
.btpl .subject-item{
  font-family:var(--font-serif);font-size:calc(7.5pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(9pt / var(--template-scale));color:#000;margin:0;padding:0;
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
.btpl .total-cell{
  font-family:var(--font-serif);font-size:calc(6.8pt / var(--template-scale));font-weight:700;
  font-style:normal;line-height:calc(8pt / var(--template-scale));text-align:center;color:#000;
  border-top:calc(0.5pt / var(--template-scale)) solid #000;border-bottom:calc(0.5pt / var(--template-scale)) solid #000;
  padding:calc(1pt / var(--template-scale)) 0;
}
.btpl .total-value{display:inline-block;line-height:calc(8pt / var(--template-scale));padding:0;}
.btpl .red{color:var(--red);}
.btpl .orange{color:var(--orange);}
.btpl .green{color:var(--green);}
.btpl .mline{
  display:grid;grid-template-columns:minmax(0,1fr) calc(30pt / var(--template-scale)) calc(26pt / var(--template-scale));
  align-items:baseline;margin-top:calc(2.5pt / var(--template-scale));padding:0;width:100%;
  font-family:var(--font-serif);font-size:calc(7pt / var(--template-scale));font-weight:400;
  font-style:normal;line-height:calc(9pt / var(--template-scale));color:#000;
}
.btpl .rubrique-table + .mline{margin-top:calc(5pt / var(--template-scale));}
.btpl .mline .ml{white-space:nowrap;text-align:left;padding-right:calc(3pt / var(--template-scale));}
.btpl .mline .leader{
  width:calc(30pt / var(--template-scale));text-align:center;font-family:var(--font-serif);
  font-size:calc(7pt / var(--template-scale));font-weight:400;font-style:normal;
  line-height:calc(9pt / var(--template-scale));color:#777;letter-spacing:calc(0.5pt / var(--template-scale));
}
.btpl .mline .mv{
  width:calc(26pt / var(--template-scale));text-align:center;font-size:calc(7.5pt / var(--template-scale));
  font-weight:700;font-style:normal;line-height:calc(9pt / var(--template-scale));white-space:nowrap;color:#000;
}
.btpl .mline-class .mv{
  font-size:calc(7.3pt / var(--template-scale));font-weight:700;line-height:calc(9pt / var(--template-scale));
}
.btpl .etape-block{
  margin-top:calc(11pt / var(--template-scale));margin-bottom:calc(12pt / var(--template-scale));
  padding:0;background:transparent;border:0;border-radius:0;
}
.btpl .etape-block .mline{margin-top:calc(3pt / var(--template-scale));}
.btpl .etape-block .mline:first-child{margin-top:0;}
.btpl .mline-step .ml,.btpl .mline-step .mv{
  font-size:calc(9.5pt / var(--template-scale));font-weight:700;line-height:calc(11pt / var(--template-scale));
}
.btpl .mline-appreciation .ml{
  font-size:calc(7.5pt / var(--template-scale));font-weight:400;line-height:calc(9pt / var(--template-scale));
}
.btpl .mline-appreciation .mv{
  font-size:calc(8.5pt / var(--template-scale));font-weight:700;line-height:calc(10pt / var(--template-scale));
}
.btpl .mline-general-class{
  font-size:calc(7pt / var(--template-scale));font-weight:400;line-height:calc(9pt / var(--template-scale));
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
  grid-template-columns:calc(174pt / var(--template-scale)) calc(174pt / var(--template-scale)) calc(174pt / var(--template-scale));
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
  min-width:0;
  overflow-wrap:break-word;
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
  grid-template-columns:calc(174pt / var(--template-scale)) calc(174pt / var(--template-scale)) calc(174pt / var(--template-scale));
  column-gap:calc(9pt / var(--template-scale));
  width:calc(540pt / var(--template-scale));
  align-items:start;
  margin-top:calc(8pt / var(--template-scale));
  box-sizing:border-box;
}
.btpl .behavior-metric-row{
  display:grid;
  grid-template-columns:minmax(0,1fr) calc(24pt / var(--template-scale));
  align-items:baseline;
  width:100%;
  min-height:calc(10pt / var(--template-scale));
  margin:0;
  padding:0;
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
.btpl .behavior-metric-value{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(8pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(10pt / var(--template-scale));
  color:#000;
  text-align:right;
}
.btpl .observations-grid{
  display:grid;
  grid-template-columns:calc(285pt / var(--template-scale)) calc(20pt / var(--template-scale)) calc(175pt / var(--template-scale)) calc(60pt / var(--template-scale));
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
  margin:0 0 calc(5pt / var(--template-scale));
  padding:0;
}
.btpl .h-maroon2{
  font-family:"Times New Roman","Liberation Serif",Times,serif;
  font-size:calc(7.2pt / var(--template-scale));
  font-weight:700;
  font-style:normal;
  line-height:calc(8.5pt / var(--template-scale));
  color:#C85C65;
  margin:0 0 calc(2pt / var(--template-scale));
  padding:0;
}
.btpl .challenge-label{margin-top:calc(7pt / var(--template-scale));}
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
  font-size:calc(6pt / var(--template-scale));
  font-weight:700;
  line-height:calc(7pt / var(--template-scale));
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
@media print{
  .btpl{width:var(--paper-w);height:var(--paper-h);break-after:page;page-break-after:always;}
  .btpl:last-child{break-after:auto;page-break-after:auto;}
  .btpl .page{box-shadow:none;width:var(--paper-w);height:var(--paper-h);margin:0;padding:.18in .32in .34in;}
}
`
