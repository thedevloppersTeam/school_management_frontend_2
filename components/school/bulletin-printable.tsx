"use client"

import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"
import { normalizeUploadUrl } from "@/lib/upload-url"

// ─────────────────────────────────────────────────────────────────────────────
// Bulletin imprimable — design fidèle au template bulletin-scolaire.html
// (CPMSL Saint Léonard). Consomme la structure BulletinData ; les moyennes
// sont calculées en amont par lib/api/bulletin.ts (Σnotes/Σmaxscores ×10).
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? "-" : n.toFixed(2)
const fmtC = (n: number | null | undefined): string =>
  n === null || n === undefined ? "-" : String(n)

/** Couleur de la note selon le pourcentage (note/coeff). */
function colorClass(note: number | null | undefined, coeff: number | null | undefined): string {
  if (note === null || note === undefined || !coeff) return ""
  const pct = (note / coeff) * 100
  if (pct < 51) return "red"      // ≤50 → Échec
  if (pct < 60) return "orange"   // 51-59 → Déficient
  return ""
}

/** Totaux d'une rubrique : Σnotes, Σcoeffs sur les sous-matières notées. */
function rubTotals(entries: RubriqueEntry[]): { note: number; coeff: number } {
  let note = 0, coeff = 0
  for (const e of entries) {
    if (!e.isParent && e.note !== null && e.note !== undefined && e.coeff) {
      note += e.note
      coeff += e.coeff
    }
  }
  return { note, coeff }
}

function RubriqueTable({ title, entries }: { title: string; entries: RubriqueEntry[] }) {
  const totals = rubTotals(entries)
  return (
    <table className="marks">
      <tbody>
        {/* Ligne d'en-tête : titre rubrique à gauche, Notes | Coeff. à droite */}
        <tr className="hdr">
          <td className="lbl rub-title">{title}</td>
          <td className="note-cell">Notes</td>
          <td className="coeff-cell">Coeff.</td>
        </tr>
        {entries.map((e, i) => {
          if (e.isParent) {
            // Catégorie MENFP — nom souligné, colonnes Notes/Coeff vides (bordées)
            return (
              <tr key={i}>
                <td className="lbl cat">{e.name}</td>
                <td className="note-cell" />
                <td className="coeff-cell" />
              </tr>
            )
          }
          const cc = colorClass(e.note, e.coeff)
          return (
            <tr key={i}>
              <td className="lbl">{e.name}</td>
              <td className={`note-cell ${cc}`}>{fmt(e.note)}</td>
              <td className="coeff-cell">{fmtC(e.coeff)}</td>
            </tr>
          )
        })}
        <tr className="tot">
          <td className="lbl" />
          <td className="note-cell">{totals.note > 0 ? totals.note.toFixed(2) : "-"}</td>
          <td className="coeff-cell">{totals.coeff > 0 ? totals.coeff : "-"}</td>
        </tr>
      </tbody>
    </table>
  )
}

function MoyLine({ label, value, big, indent }: { label: string; value: string; big?: boolean; indent?: boolean }) {
  return (
    <div className={`mline${big ? " big" : ""}`}>
      <span className="ml" style={indent ? { marginLeft: 14 } : undefined}>{label}</span>
      <span className="leader" />
      <span className="mv">{value}</span>
    </div>
  )
}

function BehTable({ items, right }: { items: ComportementItem[]; right?: boolean }) {
  return (
    <table className={`beh${right ? " right" : ""}`}>
      <tbody>
        <tr>
          <td />
          <td className="ouinon">OUI</td>
          <td className="ouinon">NON</td>
        </tr>
        {items.map((it, i) => (
          <tr key={i}>
            <td className="blab">{it.label}</td>
            <td className="yn">{it.oui === true ? <span className="bck">✓</span> : ""}</td>
            <td className="yn">{it.oui === false ? <span className="bck">✓</span> : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function BulletinPrintable({ data }: { data: BulletinData }) {
  const { etablissement: etab, comportement: comp } = data
  const col1 = comp.items.filter((c) => c.col === 1)
  const col2 = comp.items.filter((c) => c.col === 2)
  const col3 = comp.items.filter((c) => c.col === 3)

  const moyClasse = data.moyenneClasse && data.moyenneClasse !== "" ? data.moyenneClasse : "-"

  return (
    <div className="btpl">
      <style>{CSS}</style>

      <div className="page bulletin-print">
        {/* ===== HEADER ===== */}
        <h1 className="title">Bulletin Scolaire</h1>

        <div className="head-row">
          {/* logo — on utilise le logo SVG dessiné (template) ; on n'affiche une
              image que si un VRAI logo a été téléversé (pas le placeholder). */}
          <div className="logo-block">
            {etab.logoUrl && !/test\.jpe?g$/i.test(etab.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo-img" src={normalizeUploadUrl(etab.logoUrl)} alt={`Logo ${etab.nomLigne2}`} />
            ) : (
              <LogoSvg />
            )}
            <div className="logo-sub">{etab.nomLigne1.toUpperCase()}</div>
            <div className="logo-name">{etab.nomLigne2}</div>
            <div className="logo-since">Depuis 1998!</div>
          </div>

          {/* champs */}
          <div className="fields">
            <div className="field"><span className="f-label">Prénom(s)</span><span className="f-val">{data.prenoms}</span></div>
            <div className="field"><span className="f-label">Niveau<small>{data.filiere && data.filiere !== "—" ? data.filiere : ""}</small></span><span className="f-val print">{data.niveau}</span></div>

            <div className="field"><span className="f-label">Nom</span><span className="f-val">{data.nom}</span></div>
            <div className="field"><span className="f-label">Période</span><span className="f-val print">{data.periode}</span></div>

            <div className="field"><span className="f-label">Date de naissance</span><span className="f-val">{data.dateNaissance}</span></div>
            <div className="field"><span className="f-label">Année scolaire :</span><span className="f-val print">{data.anneeScolaire}</span></div>
          </div>

          {/* photo */}
          <div className="photo-block">
            <div className="photo">
              {data.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={normalizeUploadUrl(data.photoUrl)} alt={`${data.prenoms} ${data.nom}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg viewBox="0 0 120 138" preserveAspectRatio="xMidYMax meet">
                  <rect width="120" height="138" fill="#b9c3cf" />
                  <circle cx="60" cy="52" r="26" fill="#8d99a8" />
                  <path d="M18 138 q0 -40 42 -40 q42 0 42 40 z" fill="#8d99a8" />
                </svg>
              )}
            </div>
            <div className="code">Code: {data.code}</div>
          </div>
        </div>

        <hr className="sep" />

        {/* ===== 3 RUBRIQUES ===== */}
        <div className="grid3">
          <div>
            <RubriqueTable title={data.rubrique1Name} entries={data.rubrique1} />
            <MoyLine label="Moyenne sur 10" value={fmt(data.moyR1)} />
            <MoyLine label="Moyenne classe sur 10" value="-" />
          </div>

          <div>
            <RubriqueTable title={data.rubrique2Name} entries={data.rubrique2} />
            <MoyLine label="Moyenne sur 10" value={fmt(data.moyR2)} />
            <MoyLine label="Moyenne classe sur 10" value="-" />
            {/* Ancré au bas de la colonne centrale (aligné avec le bas de R1/R3) */}
            <div className="etape-block">
              <MoyLine label="Moy. de l'étape" value={data.moyenneEtape} big />
              <MoyLine label="Appréciation" value={data.appreciation || "-"} indent />
              <MoyLine label="Moyenne classe sur 10" value={moyClasse} />
            </div>
          </div>

          <div>
            <RubriqueTable title={data.rubrique3Name} entries={data.rubrique3} />
            <MoyLine label="Moyenne sur 10" value={fmt(data.moyR3)} />
            <MoyLine label="Moyenne classe sur 10" value="-" />
          </div>
        </div>

        {/* ===== COMPORTEMENT ===== */}
        <div className="behav-title">Difficultés de comportement et / ou d&apos;apprentissage</div>
        <div className="behav-grid">
          <BehTable items={col1} />
          <BehTable items={col2} right />
          <BehTable items={col3} right />
        </div>

        <div className="behav-grid" style={{ marginTop: 6 }}>
          <div>
            <div className="stat"><span>Nbre d&apos;absences</span><b>{comp.absences}</b></div>
            <div className="stat"><span>Nbre de retards</span><b>{comp.retards}</b></div>
          </div>
          <div>
            <div className="stat"><span>Nbre de devoirs non remis</span><b>{comp.devoirsNonRemis}</b></div>
            <div className="stat"><span>Nbre de leçons non sues</span><b>{comp.leconsNonSues}</b></div>
          </div>
          <div>
            <div className="stat"><span className="label">Respect des prescrits de l&apos;uniforme</span><b>{comp.uniforme ?? "-"}</b></div>
            <div className="stat"><span className="label">Discipline</span><b>{comp.discipline ?? "-"}</b></div>
          </div>
        </div>

        {/* ===== POINTS FORTS / REMARQUE ===== */}
        <div className="lower">
          <div>
            <div className="h-maroon">Points forts et / ou défis à relever</div>
            <div className="h-maroon2">Point(s) fort(s) :</div>
            <p className="plain">{comp.pointsForts || " "}</p>
            <div className="h-maroon2">Défi(s) à relever :</div>
            <p className="plain">{comp.defis || " "}</p>
          </div>
          <div>
            <div className="h-maroon">Remarque</div>
            <p className="plain">{comp.remarque || " "}</p>
          </div>
        </div>

        {/* ===== LÉGENDE / FOOTER + SIGNATURES ===== */}
        <div className="bottom-area">
          <div className="legend-col">
            <div className="legend-title">Légende des notes et des couleurs</div>
            <div className="legend">
              90 - 100 : <b>A+ = Excellent</b>&nbsp;&nbsp;&nbsp;&nbsp;78 - 84 : <b>B+ = Très bien</b>&nbsp;&nbsp;&nbsp;69 - 74 : <b>C+ = Bien</b>&nbsp;&nbsp;&nbsp;51 - 59&nbsp; : <b style={{ color: "var(--orange)" }}>D = Déficient</b><br />
              85 - 89&nbsp; : <b>A = Excellent</b>&nbsp;&nbsp;&nbsp;&nbsp;75 - 77 : <b>B = Très bien</b>&nbsp;&nbsp;&nbsp;60 - 68 : <b style={{ color: "var(--green)" }}>C&nbsp; = Assez bien</b>&nbsp;&nbsp;&nbsp;&le; 50 : <b style={{ color: "var(--red)" }}>E = Échec</b>
            </div>
            <div className="footer-rule">
              <div className="first">Seuil de réussite pour promotion automatique en classe supérieure 7.00</div>
              <div>Calcul de la moyenne de l&apos;étape : 70% R1 + 25% R2 + 5% R3</div>
              <div>Calcul de la moyenne générale : Somme des étapes / nbre d&apos;Étapes</div>
            </div>
            <div className="contact">{etab.adresse} / Téléphone : {etab.telephone} / Courriel : {etab.email}</div>
          </div>

          <div className="sign-col">
            <div className="signbox"><div className="signline" /><div className="signlabel">Parent</div></div>
            <div className="signbox"><div className="signline" /><div className="signlabel">Direction</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Logo SVG (reproduit du template) ─────────────────────────────────────────
function LogoSvg() {
  return (
    <svg className="logo-svg" viewBox="0 0 130 100">
      <defs>
        <radialGradient id="globe" cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#5b8fd6" />
          <stop offset="55%" stopColor="#235ba8" />
          <stop offset="100%" stopColor="#143b73" />
        </radialGradient>
        <clipPath id="sphere"><circle cx="74" cy="42" r="33" /></clipPath>
      </defs>
      <path d="M2 58 L34 50 L26 92 L-4 84 Z" fill="#c4cbb4" opacity=".55" />
      <ellipse cx="36" cy="90" rx="46" ry="7" fill="#9aa37e" opacity=".4" />
      <circle cx="74" cy="42" r="33" fill="url(#globe)" />
      <g clipPath="url(#sphere)" stroke="#e8f1ff" strokeWidth="1.1" fill="none" opacity=".9">
        <line x1="41" y1="42" x2="107" y2="42" />
        <path d="M44 26 Q74 32 104 26" />
        <path d="M44 58 Q74 52 104 58" />
        <path d="M50 14 Q74 20 98 14" />
        <path d="M50 70 Q74 64 98 70" />
        <line x1="74" y1="9" x2="74" y2="75" />
        <ellipse cx="74" cy="42" rx="11" ry="33" />
        <ellipse cx="74" cy="42" rx="22" ry="33" />
      </g>
      <ellipse cx="64" cy="30" rx="11" ry="7" fill="#ffffff" opacity=".18" />
      <g fill="#8d8f6b">
        <circle cx="40" cy="30" r="7" />
        <path d="M40 37 C32 39 28 48 30 60 L26 86 L34 86 L37 62 C38 56 42 56 43 62 L46 86 L54 86 L50 60 C52 50 50 42 44 39 Z" />
        <path d="M45 41 Q58 30 66 26 L63 21 Q54 25 42 35 Z" />
      </g>
    </svg>
  )
}

// ── CSS du template (scopé sous .btpl) ───────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap');
.btpl{
  --ink:#1c1c22; --blue:#1f4e9c; --blue2:#2a5db0; --hand:#16335c;
  --check:#1f5fae; --red:#c12b22; --orange:#c47a26; --maroon:#8a1b1b;
  --line:#2a2a2a; --green:#2e7d32;
}
.btpl *{box-sizing:border-box;}
.btpl .page{
  width:1040px;max-width:100%;margin:0 auto;background:#fff;
  padding:22px 30px 28px;position:relative;
  font-family:Georgia,"Times New Roman",serif;color:var(--ink);
}
.btpl .title{text-align:center;color:var(--blue);font-weight:700;font-style:italic;font-size:34px;letter-spacing:.5px;margin:0 0 8px;}
.btpl .head-row{display:grid;grid-template-columns:188px 1fr 144px;gap:12px;align-items:flex-start;}
.btpl .logo-block{text-align:center;padding-top:4px;}
.btpl .logo-svg{width:120px;height:96px;display:block;margin:0 auto;}
.btpl .logo-img{width:96px;height:96px;object-fit:contain;display:block;margin:0 auto;}
.btpl .logo-name{font-weight:800;font-size:19px;letter-spacing:1px;color:#161616;margin-top:-2px;}
.btpl .logo-sub{font-size:8.5px;letter-spacing:3px;color:#444;font-weight:700;margin-bottom:1px;}
.btpl .logo-since{font-style:italic;color:var(--blue);font-size:14px;font-family:"Caveat",cursive;}
.btpl .fields{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:11px;padding-top:6px;}
.btpl .field{display:flex;align-items:baseline;gap:10px;}
.btpl .f-label{color:var(--blue);font-size:13px;white-space:nowrap;}
.btpl .f-label small{display:block;font-size:9px;color:var(--blue2);font-style:italic;line-height:1;}
.btpl .f-val{font-family:"Caveat",cursive;color:var(--hand);font-size:23px;line-height:1;flex:1;white-space:nowrap;}
.btpl .f-val.print{font-family:Georgia,serif;font-size:15px;font-weight:700;color:#222;}
.btpl .photo-block{text-align:center;}
.btpl .photo{width:120px;height:138px;margin:0 auto;border:1px solid #999;background:linear-gradient(160deg,#c9d2dc,#aeb9c6);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;}
.btpl .photo svg{width:100%;height:100%;}
.btpl .code{font-size:12px;margin-top:6px;color:#222;}
.btpl hr.sep{border:none;border-top:1px solid #c9c9c9;margin:12px 0 10px;}
.btpl .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;align-items:stretch;}
.btpl .grid3 > div{display:flex;flex-direction:column;}
.btpl .etape-block{margin-top:auto;padding-top:14px;}
.btpl .rubrique-title{color:var(--blue2);font-size:14px;font-style:italic;margin:0 0 6px;}
.btpl .rub-title{color:var(--blue2);font-size:14px;font-style:italic;vertical-align:bottom;padding-bottom:2px;border:none;}
.btpl table.marks{width:100%;border-collapse:collapse;font-size:12px;}
.btpl table.marks td{padding:1.5px 0;vertical-align:bottom;}
.btpl .lbl{padding-right:8px;line-height:1.28;}
.btpl .cat{font-weight:700;text-decoration:underline;padding-top:7px;padding-bottom:1px;}
.btpl .note-cell,.btpl .coeff-cell{width:48px;text-align:center;font-size:12px;position:relative;border-left:1.3px solid var(--line);border-right:1.3px solid var(--line);padding:1.5px 2px;}
.btpl .coeff-cell{width:42px;border-left:none;border-right:1.3px solid var(--line);}
.btpl tr.hdr .note-cell,.btpl tr.hdr .coeff-cell{border-top:1.3px solid var(--line);border-bottom:1.3px solid var(--line);font-weight:700;background:#fff;}
.btpl tr.tot .note-cell,.btpl tr.tot .coeff-cell{border-top:1.3px solid var(--line);border-bottom:1.3px solid var(--line);font-weight:700;}
.btpl .red{color:var(--red);}
.btpl .orange{color:var(--orange);}
.btpl .mline{display:flex;align-items:flex-end;font-size:12px;margin-top:3px;}
.btpl .mline .ml{white-space:nowrap;}
.btpl .mline .leader{flex:1;border-bottom:1.5px dotted #555;margin:0 4px 4px;}
.btpl .mline .mv{font-weight:700;white-space:nowrap;}
.btpl .mline.big .ml{font-weight:700;font-size:15px;}
.btpl .mline.big .mv{font-size:15px;}
.btpl .blockgap{height:10px;}
.btpl .behav-title{font-weight:700;text-decoration:underline;font-size:16px;margin:20px 0 8px;}
.btpl .behav-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;}
.btpl table.beh{width:100%;border-collapse:collapse;font-size:12.5px;}
.btpl table.beh td{padding:3px 2px;vertical-align:middle;}
.btpl .ouinon{font-size:8.5px;letter-spacing:1px;text-align:center;color:#222;}
.btpl .yn{width:34px;height:18px;text-align:center;border-bottom:1px solid #333;position:relative;}
.btpl .yn .bck{color:#111;font-family:"Caveat",cursive;font-size:17px;line-height:1;}
.btpl .beh .blab{line-height:1.2;}
.btpl .beh.right .blab{text-align:right;}
.btpl .stat{display:flex;justify-content:space-between;font-style:italic;font-size:13px;margin-top:9px;}
.btpl .stat b{font-style:normal;}
.btpl .lower{display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-top:18px;}
.btpl .h-maroon{color:var(--maroon);font-weight:700;text-decoration:underline;font-size:15px;margin:0 0 8px;}
.btpl .h-maroon2{color:var(--maroon);font-weight:700;font-size:13px;margin:0 0 2px;}
.btpl .plain{font-size:13px;line-height:1.5;margin:0 0 10px;white-space:pre-line;}
.btpl .bottom-area{display:grid;grid-template-columns:1fr 250px;gap:30px;align-items:stretch;margin-top:22px;}
.btpl .legend-title{font-weight:700;text-decoration:underline;font-size:13px;margin:0 0 6px;}
.btpl .legend{font-size:12px;line-height:1.7;}
.btpl .legend b{font-weight:700;}
.btpl .footer-rule{font-size:12px;margin-top:8px;line-height:1.6;}
.btpl .footer-rule .first{font-weight:700;}
.btpl .contact{font-size:11px;color:#222;margin-top:8px;}
.btpl .sign-col{display:flex;flex-direction:column;justify-content:space-between;padding:6px 0 4px;}
.btpl .signbox{width:230px;text-align:center;}
.btpl .signline{border-top:1px solid #2a4d86;margin-top:40px;}
.btpl .signlabel{font-weight:700;font-size:14px;margin-top:4px;}
@media print{
  .btpl .page{box-shadow:none;width:auto;margin:0;padding:6mm 8mm;}
}
`
