"use client"

import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"
import { calculateRubriqueTotals, formatBulletinNumber } from "@/lib/bulletin-calculations"
import { normalizeUploadUrl } from "@/lib/upload-url"

// ─────────────────────────────────────────────────────────────────────────────
// Bulletin imprimable — design fidèle au template bulletin-scolaire.html
// (CPMSL Saint Léonard). Consomme la structure BulletinData ; les moyennes
// sont calculées en amont par lib/api/bulletin.ts (Σnotes/Σmaxscores ×10).
// ─────────────────────────────────────────────────────────────────────────────

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

/** Totaux d'une rubrique : Σnotes, Σcoeffs sur les sous-matières notées. */
function RubriqueTable({ title, entries }: { title: string; entries: RubriqueEntry[] }) {
  const totals = calculateRubriqueTotals(entries)
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
              <td className={`note-cell ${cc}`}>{formatBulletinNumber(e.note)}</td>
              <td className="coeff-cell">{fmtC(e.coeff)}</td>
            </tr>
          )
        })}
        <tr className="tot">
          <td className="lbl" />
          <td className="note-cell"><span className="total-value">{formatBulletinNumber(totals.note)}</span></td>
          <td className="coeff-cell"><span className="total-value">{fmtC(totals.coeff)}</span></td>
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

  const moyClasse = data.moyenneClasse && data.moyenneClasse !== "" ? data.moyenneClasse : "—"

  return (
    <div className="btpl">
      <style>{CSS}</style>

      <div className="page bulletin-print">
        <div className="page-content">
        {/* ===== HEADER ===== */}
        <h1 className="title">Bulletin Scolaire</h1>

        <div className="head-row">
          {/* logo — on utilise le logo SVG dessiné (template) ; on n'affiche une
              image que si un VRAI logo a été téléversé (pas le placeholder). */}
          <div className="logo-block">
            {etab.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo-img" src={normalizeUploadUrl(etab.logoUrl)} alt={`Logo ${etab.nomLigne2 || "établissement"}`} />
            ) : (
              <div className="logo-placeholder" aria-label="Logo absent" />
            )}
            <div className="since">Depuis 1998!</div>
          </div>

          {/* champs */}
          <div className="fields">
            <div className="field"><span className="f-label">Prénom(s)</span><span className="f-val">{data.prenoms}</span></div>
            <div className="field"><span className="f-label">Niveau<small>{data.filiere && data.filiere !== "—" ? data.filiere : ""}</small></span><span className="f-val">{data.niveau}</span></div>

            <div className="field"><span className="f-label">Nom</span><span className="f-val">{data.nom}</span></div>
            <div className="field"><span className="f-label">Période</span><span className="f-val">{data.periode}</span></div>

            <div className="field"><span className="f-label">Date de naissance</span><span className="f-val">{data.dateNaissance}</span></div>
            <div className="field"><span className="f-label">Année scolaire :</span><span className="f-val">{data.anneeScolaire}</span></div>

            <div className="field"><span className="f-label">Sexe</span><span className="f-val">{data.sexe}</span></div>
            <div className="field"><span className="f-label">NISU</span><span className="f-val">{data.nisu || "—"}</span></div>
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

        {/* ===== 3 RUBRIQUES ===== */}
        <div className="grid3">
          <div>
            <RubriqueTable title={data.rubrique1Name} entries={data.rubrique1} />
            <MoyLine label="Moyenne sur 10" value={formatBulletinNumber(data.moyR1)} />
            <MoyLine label="Moyenne classe sur 10" value={formatBulletinNumber(data.moyClasseR1)} />
          </div>

          <div>
            <RubriqueTable title={data.rubrique2Name} entries={data.rubrique2} />
            <MoyLine label="Moyenne sur 10" value={formatBulletinNumber(data.moyR2)} />
            <MoyLine label="Moyenne classe sur 10" value={formatBulletinNumber(data.moyClasseR2)} />
            {/* Ancré au bas de la colonne centrale (aligné avec le bas de R1/R3) */}
            <div className="etape-block">
              <MoyLine label="Moy. de l'étape" value={data.moyenneEtape} big />
              <MoyLine label="Appréciation" value={data.appreciation || "—"} indent />
              <MoyLine label="Moyenne classe sur 10" value={moyClasse} />
            </div>
          </div>

          <div>
            <RubriqueTable title={data.rubrique3Name} entries={data.rubrique3} />
            <MoyLine label="Moyenne sur 10" value={formatBulletinNumber(data.moyR3)} />
            <MoyLine label="Moyenne classe sur 10" value={formatBulletinNumber(data.moyClasseR3)} />
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
            <div className="stat"><span className="label">Respect des prescrits de l&apos;uniforme</span><b>{comp.uniforme ?? "—"}</b></div>
            <div className="stat"><span className="label">Discipline</span><b>{comp.discipline ?? "—"}</b></div>
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
              <div>Calcul de la moyenne de l&apos;étape : 70% Rubrique 1 + 25% Rubrique 2 + 5% Rubrique 3</div>
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
    </div>
  )
}


// ── CSS du template (scopé sous .btpl) ───────────────────────────────────────
const CSS = `
.btpl{
  --ink:#1c1c22; --blue:#63a8d9; --blue2:#4a9bcc; --hand:#16335c;
  --check:#1f5fae; --red:#cf3a35; --orange:#d9a21b; --maroon:#8a1b1b;
  --line:#2a2a2a; --green:#318c53;
  --paper-w:8.5in; --paper-h:11in; --template-w:1040px; --template-h:1345px;
  --template-scale:0.725;
  width:var(--paper-w);height:var(--paper-h);max-width:100%;margin:0 auto;
  background:#fff;overflow:hidden;
}
.btpl.pdf-capture{overflow:visible;}
.btpl *{box-sizing:border-box;}
.btpl .page{
  width:var(--paper-w);height:var(--paper-h);max-width:100%;margin:0 auto;background:#fff;
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
.btpl .title{text-align:center;color:var(--blue);font-weight:600;font-style:normal;font-size:32px;letter-spacing:0;margin:0 0 6px;}
.btpl .head-row{display:grid;grid-template-columns:184px 1fr 154px;gap:10px;align-items:flex-start;margin-bottom:12px;}
.btpl .logo-block{text-align:center;padding-top:0;}
.btpl .logo-svg{width:120px;height:96px;display:block;margin:0 auto;}
.btpl .logo-img{width:128px;height:100px;object-fit:contain;display:block;margin:0 auto;}
.btpl .logo-placeholder{width:128px;height:100px;margin:0 auto;}
.btpl .since{font-family:"Segoe Print","Comic Sans MS","Comic Sans",cursive;color:#24588f;font-size:11px;font-weight:600;line-height:1;margin-top:-1px;}
.btpl .fields{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:8px;padding-top:8px;overflow:visible;}
.btpl .field{display:flex;align-items:center;gap:10px;min-width:0;min-height:20px;overflow:visible;}
.btpl .f-label{color:#245fa3;font-size:12.2px;white-space:nowrap;padding-bottom:0;}
.btpl .f-label small{display:block;font-size:8.5px;color:var(--blue2);font-style:normal;line-height:1;}
.btpl .f-val{font-family:"Segoe Print","Comic Sans MS","Comic Sans",cursive;color:#222;font-size:13px;font-weight:600;line-height:1.25;min-height:20px;flex:1;min-width:0;white-space:nowrap;border-bottom:none;padding:0 2px 2px;overflow:visible;text-overflow:clip;}
.btpl .f-val.print{font-family:Georgia,serif;font-size:15px;font-weight:700;color:#222;}
.btpl .photo-block{text-align:center;}
.btpl .photo{width:132px;height:150px;margin:0 auto;border:1px solid #999;background:linear-gradient(160deg,#c9d2dc,#aeb9c6);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;}
.btpl .photo svg{width:100%;height:100%;}
.btpl .code{font-size:11px;margin-top:6px;color:#222;}
.btpl hr.sep{display:none;}
.btpl .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px;align-items:start;margin-bottom:8px;}
.btpl .grid3 > div{display:flex;flex-direction:column;}
.btpl .etape-block{margin-top:38px;padding-top:4px;padding-bottom:8px;}
.btpl .rubrique-title{color:var(--blue2);font-size:13px;font-style:normal;margin:0 0 6px;}
.btpl .rub-title{color:var(--blue2);font-size:13px;font-style:normal;font-weight:700;vertical-align:bottom;padding-bottom:7px;border:none;}
.btpl table.marks{width:100%;border-collapse:collapse;font-size:10.8px;}
.btpl table.marks td{padding:.45px 0;vertical-align:bottom;}
.btpl .lbl{padding-right:8px;line-height:1.18;}
.btpl .cat{font-weight:700;text-decoration:underline;text-decoration-color:#000;text-underline-offset:3px;text-decoration-thickness:1px;padding-top:4px;padding-bottom:2px;}
.btpl tr.hdr + tr td{padding-top:7px;}
.btpl .note-cell,.btpl .coeff-cell{width:48px;text-align:center;font-size:10.8px;line-height:1.2;position:relative;border-left:1.3px solid var(--line);border-right:1.3px solid var(--line);padding:1px 3px;vertical-align:middle;}
.btpl .coeff-cell{width:42px;border-left:none;border-right:1.3px solid var(--line);}
.btpl tr.hdr .note-cell,.btpl tr.hdr .coeff-cell{border-top:1.3px solid var(--line);border-bottom:1.3px solid var(--line);font-weight:700;background:#fff;padding:3px 3px 4px;line-height:1.15;vertical-align:middle;}
.btpl tr.tot{height:23px;}
.btpl tr.tot .note-cell,.btpl tr.tot .coeff-cell{border-top:1.3px solid var(--line);border-bottom:1.3px solid var(--line);font-weight:700;padding:6px 3px;line-height:1.25;vertical-align:middle;}
.btpl tr.tot .total-value{display:inline-block;line-height:1.25;padding:1px 0;}
.btpl .red{color:var(--red);}
.btpl .orange{color:var(--orange);}
.btpl .green{color:var(--green);}
.btpl .mline{display:grid;grid-template-columns:max-content 52px minmax(30px,max-content);column-gap:6px;justify-content:end;align-items:end;font-size:11px;margin-top:4px;}
.btpl .mline .ml{white-space:nowrap;}
.btpl .mline .leader{width:52px;border-bottom:1px dotted #555;margin:0 0 4px;}
.btpl .mline .mv{font-weight:700;white-space:nowrap;}
.btpl .mline.big .ml{font-weight:700;font-size:14px;}
.btpl .mline.big .leader{width:58px;}
.btpl .mline.big .mv{font-size:14px;}
.btpl .blockgap{height:10px;}
.btpl .behav-title{font-weight:700;text-decoration:underline;text-decoration-color:#000;text-underline-offset:4px;font-size:15px;margin:18px 0 7px;}
.btpl .behav-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;}
.btpl table.beh{width:100%;border-collapse:collapse;font-size:12px;}
.btpl table.beh td{padding:2.5px 2px;vertical-align:middle;}
.btpl .ouinon{font-size:8.5px;letter-spacing:1px;text-align:center;color:#222;}
.btpl .yn{width:34px;height:18px;text-align:center;border-bottom:1px solid #000;position:relative;}
.btpl .yn .bck{color:#111;font-family:Georgia,"Times New Roman",serif;font-size:15px;line-height:1;}
.btpl .beh .blab{line-height:1.2;}
.btpl .beh.right .blab{text-align:right;}
.btpl .stat{display:flex;justify-content:space-between;font-style:italic;font-size:12.5px;margin-top:8px;}
.btpl .stat b{font-style:normal;}
.btpl .lower{display:grid;grid-template-columns:2fr 1fr;gap:22px;margin-top:15px;}
.btpl .h-maroon{color:var(--maroon);font-weight:700;text-decoration:underline;text-decoration-color:#000;text-underline-offset:4px;font-size:14px;margin:0 0 7px;}
.btpl .h-maroon2{color:var(--maroon);font-weight:700;font-size:12.5px;margin:0 0 2px;}
.btpl .plain{font-size:12.5px;line-height:1.42;margin:0 0 8px;white-space:pre-line;}
.btpl .bottom-area{display:grid;grid-template-columns:1fr 238px;gap:26px;align-items:stretch;margin-top:auto;padding-top:10px;padding-bottom:2px;}
.btpl .legend-title{font-weight:700;text-decoration:underline;text-decoration-color:#000;text-underline-offset:4px;font-size:12.5px;margin:0 0 5px;}
.btpl .legend{font-size:11.2px;line-height:1.55;}
.btpl .legend b{font-weight:700;}
.btpl .footer-rule{font-size:11.2px;margin-top:7px;line-height:1.45;}
.btpl .footer-rule .first{font-weight:700;}
.btpl .contact{font-size:10.5px;color:#222;margin-top:7px;line-height:1.35;}
.btpl .sign-col{display:flex;flex-direction:column;justify-content:space-between;padding:2px 0 18px;}
.btpl .signbox{width:220px;text-align:center;}
.btpl .signline{border-top:1px solid #63a8d9;margin-top:30px;}
.btpl .signlabel{font-weight:700;font-size:13px;margin-top:7px;}
@media print{
  .btpl{width:var(--paper-w);height:var(--paper-h);break-after:page;page-break-after:always;}
  .btpl:last-child{break-after:auto;page-break-after:auto;}
  .btpl .page{box-shadow:none;width:var(--paper-w);height:var(--paper-h);margin:0;padding:.18in .32in .34in;}
}
`
