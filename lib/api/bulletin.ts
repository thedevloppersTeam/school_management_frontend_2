// components/BulletinScolaire.tsx
"use client";

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RubriqueEntry {
  name:     string;
  note?:    number | null;  // null/undefined = entrée parent (section MENFP sans note)
  coeff?:   number;
  isParent: boolean;        // true = en-tête section, false = sous-matière
}

export interface ComportementItem {
  label: string;
  oui:   boolean | null;
  col:   1 | 2 | 3;
}

export interface ComportementData {
  absences:        string;
  retards:         string;
  devoirsNonRemis: string;
  leconsNonSues:   string;
  uniforme:        string;
  discipline:      string;
  items:           ComportementItem[];
  pointsForts:     string;
  defis:           string;
  remarque:        string;
}

export interface EtablissementData {
  nomLigne1: string;   // ex. "Cours Privé Mixte"
  nomLigne2: string;   // ex. "SAINT LÉONARD"
  adresse:   string;
  telephone: string;
  email:     string;
  logoUrl:   string;   // URL depuis la DB ; vide = placeholder affiché
}

export interface BulletinData {
  // ── Élève ──────────────────────────────────────────────────────────────────
  prenoms:       string;
  nom:           string;
  sexe:          string;
  niveau:        string;
  filiere:       string;
  dateNaissance: string;
  anneeScolaire: string;
  periode:       string;   // ex. "Période 1 · Étape 1"
  code:          string;
  nisu:          string;
  photoUrl?:     string;   // URL depuis la DB ; vide = placeholder affiché

  // ── Rubriques ──────────────────────────────────────────────────────────────
  rubrique1Name:  string;
  rubrique1Poids: string;  // ex. "70%"
  rubrique1:      RubriqueEntry[];
  moyR1:          number | null;

  rubrique2Name:  string;
  rubrique2Poids: string;
  rubrique2:      RubriqueEntry[];
  moyR2:          number | null;

  rubrique3Name:  string;
  rubrique3Poids: string;
  rubrique3:      RubriqueEntry[];
  moyR3:          number | null;

  // ── Résultats ──────────────────────────────────────────────────────────────
  moyenneEtape:  string;
  appreciation:  string;
  moyenneClasse: string;

  // ── Comportement & établissement ───────────────────────────────────────────
  comportement:  ComportementData;
  etablissement: EtablissementData;
}

// ── Helpers visuels ───────────────────────────────────────────────────────────

function noteColor(note: number): string {
  if (note <= 50)               return "#c0392b";
  if (note >= 51 && note <= 59) return "#cc6600";
  if (note >= 60 && note <= 68) return "#2c6e2e";
  return "#000";
}

function noteBg(note: number): string {
  if (note <= 50)               return "#fde8e8";
  if (note >= 51 && note <= 59) return "#fef3e2";
  if (note >= 60 && note <= 68) return "#eafaea";
  return "transparent";
}

function fmt(n: number | null | undefined): string {
  return n != null ? n.toFixed(2) : "–";
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function CB({ checked }: { checked: boolean | null }) {
  return (
    <span style={{
      display: "inline-block",
      width: "10px", height: "10px",
      border: "1px solid #333",
      background: "white",
      position: "relative",
      verticalAlign: "middle",
      flexShrink: 0,
    }}>
      {checked === true && (
        <span style={{
          position: "absolute", top: "-2px", left: "0",
          fontSize: "9pt", lineHeight: 1, color: "#000",
        }}>✓</span>
      )}
    </span>
  );
}

// ── Logo placeholder ──────────────────────────────────────────────────────────

function LogoPlaceholder() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      width: "64px", height: "64px",
      border: "1.5px dashed #aaa",
      background: "#f5f5f5", gap: "3px",
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21,15 16,10 5,21"/>
      </svg>
      <span style={{ fontSize: "5.5pt", color: "#aaa", letterSpacing: "0.5px" }}>LOGO</span>
    </div>
  );
}

// ── Photo placeholder ─────────────────────────────────────────────────────────

function PhotoPlaceholder() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      width: "60px", height: "72px",
      background: "#f0f0f0", gap: "4px",
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      <span style={{ fontSize: "5.5pt", color: "#bbb", textAlign: "center", letterSpacing: "0.5px" }}>
        PHOTO<br/>ÉLÈVE
      </span>
    </div>
  );
}

// ── Table Rubrique ────────────────────────────────────────────────────────────

function RubriqueTable({
  name, poids, entries, moy,
}: {
  name:    string;
  poids:   string;
  entries: RubriqueEntry[];
  moy:     number | null;
}) {
  return (
    <div style={{ border: "1px solid #aaa", flex: 1 }}>
      {/* En-tête rubrique */}
      <div style={{
        background: "#f0f0f0",
        fontSize: "7.5pt",
        fontWeight: "bold",
        padding: "3px 5px",
        textAlign: "left",
        borderBottom: "1px solid #aaa",
      }}>
        {name}&nbsp;
        <span style={{ fontWeight: "normal", fontSize: "7pt" }}>({poids})</span>
      </div>

      {/* Tableau matières */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "7pt" }}>
        <thead>
          <tr style={{ background: "#f7f7f7", borderBottom: "1px solid #ccc" }}>
            <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "bold" }}>Matière</th>
            <th style={{ textAlign: "center", padding: "2px 4px", borderLeft: "1px solid #ddd", width: "28px", fontWeight: "bold" }}>Note</th>
            <th style={{ textAlign: "center", padding: "2px 4px", borderLeft: "1px solid #ddd", width: "28px", fontWeight: "bold" }}>Coeff.</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) =>
            entry.isParent ? (
              // ── Section MENFP (Mathématiques, Français...) ────────────────
              <tr key={i} style={{ background: "#f0f0f0" }}>
                <td colSpan={3} style={{
                  padding: "2px 5px",
                  fontWeight: "bold",
                  fontSize: "7pt",
                  borderTop: i > 0 ? "1px solid #ccc" : undefined,
                }}>
                  {entry.name}
                </td>
              </tr>
            ) : (
              // ── Sous-matière ──────────────────────────────────────────────
              <tr key={i} style={{ borderBottom: "1px solid #efefef" }}>
                <td style={{ padding: "1.5px 4px 1.5px 10px" }}>{entry.name}</td>
                <td style={{
                  textAlign: "center",
                  borderLeft: "1px solid #ddd",
                  fontWeight: entry.note != null ? "bold" : "normal",
                  color:      entry.note != null ? noteColor(entry.note) : "#999",
                  background: entry.note != null ? noteBg(entry.note) : "transparent",
                  fontSize:   "7.5pt",
                }}>
                  {fmt(entry.note)}
                </td>
                <td style={{ textAlign: "center", borderLeft: "1px solid #ddd", color: "#444" }}>
                  {entry.coeff ?? "–"}
                </td>
              </tr>
            )
          )}

          {/* Ligne Moy. Rx */}
          <tr style={{ background: "#e8e8e8", borderTop: "1.5px solid #999" }}>
            <td style={{ textAlign: "right", padding: "2px 4px", fontWeight: "bold", fontSize: "7pt" }}>
              Moy. {name.split(" ")[0]} {name.split(" ")[1]} / 10
            </td>
            <td style={{
              textAlign: "center", borderLeft: "1px solid #ddd",
              fontWeight: "bold", color: "#c0392b", fontSize: "7.5pt",
            }}>
              {fmt(moy)}
            </td>
            <td style={{ textAlign: "center", borderLeft: "1px solid #ddd", fontWeight: "bold", color: "#444" }}>
              –
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function BulletinScolaire({ data }: { data: BulletinData }) {
  const { etablissement: etab, comportement: comp } = data;

  const col1 = comp.items.filter(c => c.col === 1);
  const col2 = comp.items.filter(c => c.col === 2);
  const col3 = comp.items.filter(c => c.col === 3);

  // ── Styles de base ──────────────────────────────────────────────────────────
  const S = {
    lbl: { color: "#1a3a6e", fontWeight: "bold" } as React.CSSProperties,
    val: { fontStyle: "italic", fontFamily: "'Times New Roman', Times, serif", fontSize: "9pt" } as React.CSSProperties,
    mono: { fontFamily: "'Courier New', monospace", fontSize: "7.5pt" } as React.CSSProperties,
    compRow: {
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "1px 0",
      borderBottom: "1px dotted #ddd",
      fontSize: "7pt",
    } as React.CSSProperties,
    oiNon: {
      display: "flex", gap: "3px",
      alignItems: "center",
      fontSize: "6.5pt",
      whiteSpace: "nowrap",
    } as React.CSSProperties,
  };

  return (
    <div style={{
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "8.5pt",
      background: "white",
      width: "210mm",
      margin: "0 auto",
      padding: "8mm",
      color: "#000",
      boxSizing: "border-box",
      border: "1px solid #bbb",
    }}>

      {/* ══════════════════════════════════════════════════════════════
          EN-TÊTE
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        border: "1.5px solid #1a3a6e",
        padding: "6px 8px",
        marginBottom: "5px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}>
        {/* Logo */}
        <div style={{ width: "64px", height: "64px", flexShrink: 0 }}>
          {etab.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={etab.logoUrl}
              alt={`Logo ${etab.nomLigne2}`}
              style={{ width: "64px", height: "64px", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style");
              }}
            />
          ) : (
            <LogoPlaceholder />
          )}
        </div>

        {/* Titre central */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "7pt", color: "#1a3a6e", fontWeight: "bold", letterSpacing: "3px", textTransform: "uppercase" }}>
            {etab.nomLigne1}
          </div>
          <div style={{ fontSize: "14pt", fontWeight: "bold", color: "#1a3a6e", letterSpacing: "4px" }}>
            {etab.nomLigne2}
          </div>
          <div style={{
            fontSize: "15pt", fontWeight: "bold", color: "#000", letterSpacing: "3px",
            borderTop: "1.5px solid #1a3a6e", borderBottom: "1.5px solid #1a3a6e",
            margin: "4px 0", padding: "3px 0",
          }}>
            BULLETIN SCOLAIRE
          </div>
          <div style={{ fontSize: "6.5pt", color: "#555", letterSpacing: "1px" }}>
            Année Scolaire : {data.anneeScolaire}&nbsp;·&nbsp;{data.periode}
          </div>
        </div>

        {/* Photo élève */}
        <div style={{
          width: "60px", height: "72px",
          border: "1px solid #999",
          flexShrink: 0,
          overflow: "hidden",
        }}>
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoUrl}
              alt="Photo élève"
              style={{ width: "60px", height: "72px", objectFit: "cover" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <PhotoPlaceholder />
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          INFORMATIONS ÉLÈVE
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        border: "1px solid #bbb",
        padding: "4px 8px",
        marginBottom: "5px",
        background: "#f9f9f9",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "3px 24px",
        fontSize: "8pt",
      }}>
        <div><span style={S.lbl}>Prénom(s) :</span> <span style={S.val}>{data.prenoms}</span></div>
        <div><span style={S.lbl}>Niveau :</span> {data.niveau}</div>
        <div><span style={S.lbl}>Nom :</span> <span style={{ ...S.val, textTransform: "uppercase" }}>{data.nom}</span></div>
        <div><span style={S.lbl}>Filière :</span> {data.filiere || "–"}</div>
        <div><span style={S.lbl}>Sexe :</span> {data.sexe}</div>
        <div><span style={S.lbl}>Date de naissance :</span> {data.dateNaissance}</div>
        <div><span style={S.lbl}>Code élève :</span> <span style={S.mono}>{data.code}</span></div>
        <div><span style={S.lbl}>NISU :</span> <span style={S.mono}>{data.nisu}</span></div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          3 RUBRIQUES
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", marginBottom: "5px" }}>
        <RubriqueTable
          name={data.rubrique1Name}
          poids={data.rubrique1Poids}
          entries={data.rubrique1}
          moy={data.moyR1}
        />
        <RubriqueTable
          name={data.rubrique2Name}
          poids={data.rubrique2Poids}
          entries={data.rubrique2}
          moy={data.moyR2}
        />
        <RubriqueTable
          name={data.rubrique3Name}
          poids={data.rubrique3Poids}
          entries={data.rubrique3}
          moy={data.moyR3}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOYENNE DE L'ÉTAPE
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        border: "1.5px solid #1a3a6e",
        background: "#eef2f8",
        padding: "5px 12px",
        marginBottom: "5px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        alignItems: "center",
        gap: "24px",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: "7pt", fontWeight: "bold", color: "#1a3a6e" }}>Moyenne de l'étape</span>
          <span style={{ fontSize: "13pt", fontWeight: "bold", color: "#c0392b" }}>{data.moyenneEtape}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: "7pt", fontWeight: "bold", color: "#1a3a6e" }}>Appréciation</span>
          <span style={{ fontSize: "13pt", fontWeight: "bold", color: "#c0392b" }}>{data.appreciation}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: "7pt", fontWeight: "bold", color: "#1a3a6e" }}>Moyenne classe sur 10</span>
          <span style={{ fontSize: "11pt", fontWeight: "bold", color: "#444" }}>{data.moyenneClasse}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          COMPORTEMENT
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ border: "1px solid #aaa", padding: "4px 6px", marginBottom: "5px" }}>
        <div style={{ fontWeight: "bold", fontSize: "8pt", textDecoration: "underline", marginBottom: "4px" }}>
          Difficultés de comportement et / ou d'apprentissage
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px 8px", fontSize: "7pt" }}>
          {/* Colonne 1 */}
          <div>
            {col1.map((item, i) => (
              <div key={i} style={S.compRow}>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={S.oiNon}>
                  OUI <CB checked={item.oui === true} />
                  NON <CB checked={item.oui === false} />
                </span>
              </div>
            ))}
          </div>
          {/* Colonne 2 */}
          <div>
            {col2.map((item, i) => (
              <div key={i} style={S.compRow}>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={S.oiNon}>
                  OUI <CB checked={item.oui === true} />
                  NON <CB checked={item.oui === false} />
                </span>
              </div>
            ))}
          </div>
          {/* Colonne 3 */}
          <div>
            {col3.map((item, i) => (
              <div key={i} style={S.compRow}>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={S.oiNon}>
                  OUI <CB checked={item.oui === true} />
                  NON <CB checked={item.oui === false} />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Absences / retards */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: "2px 8px", marginTop: "5px",
          borderTop: "1px solid #ddd", paddingTop: "3px",
          fontSize: "7pt",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nbre d'absences</span>
            <span style={{ fontWeight: "bold", color: "#c0392b", minWidth: "20px" }}>{comp.absences}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nbre de devoirs non remis</span>
            <span style={{ fontWeight: "bold", color: "#c0392b", minWidth: "20px" }}>{comp.devoirsNonRemis}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Respect des prescrits de l'uniforme</span>
            <span style={{ fontWeight: "bold", color: "#c0392b", minWidth: "20px" }}>{comp.uniforme}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nbre de retards</span>
            <span style={{ fontWeight: "bold", color: "#c0392b", minWidth: "20px" }}>{comp.retards}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Nbre de leçons non sues</span>
            <span style={{ fontWeight: "bold", color: "#c0392b", minWidth: "20px" }}>{comp.leconsNonSues}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Discipline</span>
            <span style={{ fontWeight: "bold", color: "#c0392b", minWidth: "20px" }}>{comp.discipline}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          POINTS FORTS / REMARQUE
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "5px" }}>
        {/* Points forts / Défis */}
        <div style={{ border: "1px solid #aaa", padding: "4px", minHeight: "45px" }}>
          <div style={{ fontWeight: "bold", fontSize: "7.5pt", textDecoration: "underline", marginBottom: "3px" }}>
            Points forts et / ou défis à relever
          </div>
          <div style={{ fontWeight: "bold", fontSize: "7.5pt", color: "#1a3a6e", marginBottom: "8px" }}>
            Point(s) fort(s) :
          </div>
          <div style={{ borderBottom: "1px solid #ddd", minHeight: "16px", marginBottom: "4px" }}>
            {comp.pointsForts}
          </div>
          <div style={{ fontWeight: "bold", fontSize: "7.5pt", color: "#c0392b", marginBottom: "4px" }}>
            Défi(s) à relever :
          </div>
          <div style={{ borderBottom: "1px solid #ddd", minHeight: "16px" }}>
            {comp.defis}
          </div>
        </div>

        {/* Remarque */}
        <div style={{ border: "1px solid #aaa", padding: "4px", minHeight: "45px" }}>
          <div style={{ fontWeight: "bold", fontSize: "7.5pt", textDecoration: "underline", marginBottom: "3px" }}>
            Remarque
          </div>
          <div style={{ fontSize: "7.5pt", minHeight: "36px" }}>
            {comp.remarque}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER : Légende + Signatures
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "16px",
        borderTop: "1px solid #333",
        paddingTop: "6px",
        alignItems: "start",
      }}>
        {/* Légende + Adresse établissement */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: "6.5pt", lineHeight: 1.7 }}>
            <span style={{ fontWeight: "bold" }}>Légende : </span>
            90-100 : A+ Excellent &nbsp;|&nbsp;
            85-89 : A Excellent &nbsp;|&nbsp;
            78-84 : B+ Très bien &nbsp;|&nbsp;
            75-77 : B Très bien &nbsp;|&nbsp;
            69-74 : C+ Bien &nbsp;|&nbsp;
            <span style={{ color: "#2c6e2e", fontWeight: "bold" }}>60-68 : C Assez bien</span> &nbsp;|&nbsp;
            <span style={{ color: "#cc6600", fontWeight: "bold" }}>51-59 : D Déficient</span> &nbsp;|&nbsp;
            <span style={{ color: "#c0392b", fontWeight: "bold" }}>≤50 : E Échec</span>
            <br />
            <span style={{ fontWeight: "bold" }}>Seuil de promotion :</span> 7.00 / 10
            &nbsp;—&nbsp;
            <span style={{ fontWeight: "bold" }}>Formule :</span> 70% R1 + 25% R2 + 5% R3
          </div>
          <div style={{ fontSize: "6pt", color: "#555", lineHeight: 1.6 }}>
            {etab.adresse}&nbsp;|&nbsp;Tél : {etab.telephone}&nbsp;|&nbsp;{etab.email}
          </div>
        </div>

        {/* Signatures */}
        <div style={{
          display: "flex", flexDirection: "column",
          justifyContent: "space-evenly",
          gap: "20px", padding: "4px 0", minHeight: "60px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "7pt" }}>
            <span style={{ fontWeight: "bold", whiteSpace: "nowrap", minWidth: "130px" }}>Signature Direction :</span>
            <span style={{ flex: 1, borderBottom: "1px solid #333", display: "block", height: "18px", minWidth: "80px" }}></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "7pt" }}>
            <span style={{ fontWeight: "bold", whiteSpace: "nowrap", minWidth: "130px" }}>Signature Parent :</span>
            <span style={{ flex: 1, borderBottom: "1px solid #333", display: "block", height: "18px", minWidth: "80px" }}></span>
          </div>
        </div>
      </div>

    </div>
  );
}