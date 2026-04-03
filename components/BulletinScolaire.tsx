// components/school/BulletinScolaire.tsx
"use client";

import React from "react";
import Image from "next/image";

export interface Subject {
  name: string;
  notes?: string;
  coeff?: string;
  isCategoryHeader?: boolean;
isSection?: boolean;
  isTotal?: boolean;
  isMoyenne?: boolean;
}

export interface ComportementData {
  absences: string;
  retards: string;
  devoirsNonRemis: string;
  leconsNonSues: string;
  comportements: { label: string; oui: boolean | null; col: number }[];
  pointsForts: string;
  defis: string;
  remarque: string;
}

export interface BulletinData {
  prenoms: string;
  nom: string;
  niveau: string;
  filiere: string;
  periode: string;
  dateNaissance: string;
  anneeScolaire: string;
  code: string;
  nisu: string;
  moyenneEtape: string;
  appreciation: string;
  moyenneClasse: string;
  rubrique1: Subject[];
rubrique1Name: string ;
  rubrique2: Subject[];
rubrique2Name: string ;
  rubrique3: Subject[];
rubrique3Name: string ;
  comportement: ComportementData;
}

function SubjectRow({ subject }: { subject: Subject }) {
  if (subject.isCategoryHeader) {
    return (
      <tr>
        <td
          colSpan={3}
          style={{
            fontWeight: "bold",
            fontSize: "8.5pt",
            padding: "1px 2px",
            borderBottom: "1px solid #ccc",
          }}
        >
          {subject.name}
        </td>
      </tr>
    );
  }
  if (subject.isMoyenne) {
    return (
      <tr>
        <td
          colSpan={3}
          style={{
            fontSize: "7pt",
            color: "#555",
            padding: "1px 2px",
            fontStyle: "italic",
          }}
        >
          {subject.name} ……
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td style={{ fontSize: "7.5pt", padding: "1px 2px", width: "60%" }}>
        {subject.name}
      </td>
      <td
        style={{
          fontSize: "8pt",
          textAlign: "center",
          padding: "1px 2px",
          width: "20%",
          borderLeft: "1px solid #ddd",
        }}
      >
        {subject.isTotal ? "" : subject.notes}
      </td>
      <td
        style={{
          fontSize: "8pt",
          textAlign: "center",
          padding: "1px 2px",
          width: "20%",
          fontWeight: subject.isTotal ? "bold" : "normal",
          borderLeft: "1px solid #ddd",
        }}
      >
        {subject.coeff}
      </td>
    </tr>
  );
}

function OuiNon({ val }: { val: boolean | null }) {
  return (
    <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "7pt" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        <span
          style={{
            width: 10,
            height: 10,
            border: "1px solid #333",
            display: "inline-block",
            background: val === true ? "#1a3a6e" : "white",
          }}
        />
        OUI
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
        <span
          style={{
            width: 10,
            height: 10,
            border: "1px solid #333",
            display: "inline-block",
            background: val === false ? "#1a3a6e" : "white",
          }}
        />
        NON
      </span>
    </div>
  );
}

export default function BulletinScolaire({ data }: { data: BulletinData }) {
  const comportCol1 = data.comportement.comportements.filter((c) => c.col === 1);
  const comportCol2 = data.comportement.comportements.filter((c) => c.col === 2);
  const comportCol3 = data.comportement.comportements.filter((c) => c.col === 3);

  console.log("Bulletin data:", data); // Debug log

  // Déterminer la classe d'appréciation
  const getAppreciationClass = (app: string) => {
    if (app === 'E') return { color: '#c0392b', bg: '#ffe6e6' };
    if (app === 'D') return { color: '#e67e22', bg: '#fff0e6' };
    if (app === 'C' || app === 'C+') return { color: '#f1c40f', bg: '#fff9e6' };
    if (app === 'B' || app === 'B+') return { color: '#2ecc71', bg: '#e8f8f5' };
    if (app === 'A' || app === 'A+') return { color: '#27ae60', bg: '#e8f8f5' };
    return { color: '#555', bg: '#f5f5f5' };
  };

  const appreciationStyle = getAppreciationClass(data.appreciation);

  return (
    <div
      style={{
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "9pt",
        background: "white",
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "8mm 8mm 6mm",
        color: "#000",
        boxSizing: "border-box",
        border: "1px solid #ccc",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "12px" }}>
        {/* Titre principal */}
        <div style={{ textAlign: "center", marginBottom: "16px", position: "relative" }}>
          <div style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent, #1a3a6e, #c0392b, #1a3a6e, transparent)",
            width: "80%",
            margin: "0 auto 8px auto"
          }} />
          <h1
            style={{
              fontSize: "28pt",
              fontWeight: "bold",
              margin: "4px 0",
              letterSpacing: "2px",
              color: "#1a3a6e",
              textTransform: "uppercase",
              fontFamily: "'Times New Roman', Times, serif",
            }}
          >
            Bulletin Scolaire
          </h1>
          <div style={{
            height: "1px",
            background: "#ccc",
            width: "60%",
            margin: "8px auto 0 auto"
          }} />
        </div>

        {/* En-tête à deux colonnes */}
        <div style={{
          display: "flex",
          gap: "20px",
          marginBottom: "12px",
          background: "#f9f9f9",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", minWidth: "100px" }}>
            <div
              style={{
                width: "90px",
                height: "90px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 4px auto",
              }}
            >
              <Image
                src="/test.jpeg"
                alt="Logo Saint Léonard"
                width={90}
                height={90}
                style={{ objectFit: "contain" }}
              />
            </div>
            <div style={{ fontSize: "9pt", fontWeight: "bold", color: "#1a3a6e", marginTop: "2px" }}>
              COURS PRIVÉ MIXTE
            </div>
            <div style={{ fontSize: "11pt", fontWeight: "bold", color: "#c0392b", marginTop: "2px" }}>
              SAINT LÉONARD
            </div>
            <div style={{ fontSize: "6pt", color: "#666" }}>Depuis 1993</div>
          </div>

          {/* Informations élève */}
          <div style={{ flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px 4px 0", width: "110px", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Prénom(s) :</td>
                  <td style={{ padding: "4px 8px", fontWeight: "bold", fontSize: "11pt" }}>{data.prenoms}</td>
                  <td style={{ padding: "4px 8px 4px 20px", width: "110px", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Niveau :</td>
                  <td style={{ padding: "4px 8px", fontWeight: "bold", fontSize: "11pt" }}>{data.niveau}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px 4px 0", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Nom :</td>
                  <td style={{ padding: "4px 8px", fontWeight: "bold", fontSize: "11pt" }}>{data.nom}</td>
                  <td style={{ padding: "4px 8px 4px 20px", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Filière :</td>
                  <td style={{ padding: "4px 8px" }}>{data.filiere}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px 4px 0", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Période :</td>
                  <td style={{ padding: "4px 8px" }}>{data.periode}</td>
                  <td style={{ padding: "4px 8px 4px 20px", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Date naissance :</td>
                  <td style={{ padding: "4px 8px" }}>{data.dateNaissance}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px 4px 0", fontWeight: "bold", color: "#1a3a6e", fontSize: "8pt" }}>Année scolaire :</td>
                  <td style={{ padding: "4px 8px" }}>{data.anneeScolaire}</td>
                  <td style={{ padding: "4px 8px 4px 20px" }}></td>
                  <td style={{ padding: "4px 8px" }}></td>
                </tr>
              </tbody>
            </table>
            
            <div style={{ 
              marginTop: "10px", 
              paddingTop: "6px", 
              borderTop: "1px dashed #ccc",
              display: "flex",
              gap: "20px",
              fontSize: "7.5pt"
            }}>
              <div><span style={{ fontWeight: "bold", color: "#1a3a6e" }}>Code élève :</span> {data.code}</div>
              <div><span style={{ fontWeight: "bold", color: "#1a3a6e" }}>NISU :</span> {data.nisu}</div>
            </div>
          </div>

          {/* Photo */}
          <div style={{ textAlign: "center", minWidth: "80px" }}>
            <div
              style={{
                width: "70px",
                height: "80px",
                border: "1px solid #999",
                background: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "7pt",
                color: "#999",
                borderRadius: "4px",
                marginBottom: "4px",
              }}
            >
              Photo
            </div>
          </div>
        </div>
      </div>

      {/* Three rubrique columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "4px",
          marginBottom: "6px",
        }}
      >
        {/* Rubrique 1 */}
        <div style={{ border: "1px solid #aaa", padding: "3px" }}>
          <div style={{ color: "#1a3a6e", fontWeight: "bold", fontSize: "8pt", borderBottom: "1px solid #1a3a6e", marginBottom: "3px" }}>
  {data.rubrique1Name} (70%)
</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ fontSize: "7pt", textAlign: "left", borderBottom: "1px solid #ccc" }}></th>
                <th style={{ fontSize: "7pt", textAlign: "center", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ddd" }}>Notes</th>
                <th style={{ fontSize: "7pt", textAlign: "center", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ddd" }}>Coeff.</th>
              </tr>
            </thead>
            <tbody>
              {data.rubrique1.map((s, i) => (
                <SubjectRow key={i} subject={s} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Rubrique 2 + Moyenne étape */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ border: "1px solid #aaa", padding: "3px", flex: 1 }}>
            <div style={{ color: "#2c6e2e", fontWeight: "bold", fontSize: "8pt", borderBottom: "1px solid #2c6e2e", marginBottom: "3px" }}>
  {data.rubrique2Name} (25%)
</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ fontSize: "7pt", textAlign: "left", borderBottom: "1px solid #ccc" }}></th>
                  <th style={{ fontSize: "7pt", textAlign: "center", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ddd" }}>Notes</th>
                  <th style={{ fontSize: "7pt", textAlign: "center", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ddd" }}>Coeff.</th>
                </tr>
              </thead>
              <tbody>
                {data.rubrique2.map((s, i) => (
                  <SubjectRow key={i} subject={s} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Moyenne étape box */}
          <div style={{ border: "1px solid #aaa", padding: "4px 6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", fontSize: "8pt" }}>Moy. de l'étape</td>
                  <td style={{ textAlign: "center", borderBottom: "1px solid #333", width: 40 }}>
                    {data.moyenneEtape}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: "7pt", color: "#555" }}>Appréciation</td>
                  <td style={{ 
                    textAlign: "center", 
                    borderBottom: "1px solid #333", 
                    fontWeight: "bold",
                    backgroundColor: appreciationStyle.bg,
                    color: appreciationStyle.color
                  }}>
                    {data.appreciation}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: "7pt", color: "#555" }}>Moyenne classe sur 10</td>
                  <td style={{ textAlign: "center", borderBottom: "1px solid #333" }}>
                    {data.moyenneClasse}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Rubrique 3 */}
        <div style={{ border: "1px solid #aaa", padding: "3px" }}>
          <div style={{ color: "#c0392b", fontWeight: "bold", fontSize: "8pt", borderBottom: "1px solid #c0392b", marginBottom: "3px" }}>
  {data.rubrique3Name} (5%)
</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ fontSize: "7pt", textAlign: "left", borderBottom: "1px solid #ccc" }}></th>
                <th style={{ fontSize: "7pt", textAlign: "center", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ddd" }}>Notes</th>
                <th style={{ fontSize: "7pt", textAlign: "center", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ddd" }}>Coeff.</th>
              </tr>
            </thead>
            <tbody>
              {data.rubrique3.map((s, i) => (
                <SubjectRow key={i} subject={s} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comportement section */}
      <div style={{ border: "1px solid #aaa", padding: "4px", marginBottom: "6px" }}>
        <div
          style={{
            fontSize: "8.5pt",
            fontWeight: "bold",
            textDecoration: "underline",
            marginBottom: "4px",
          }}
        >
          Difficultés de comportement et / ou d'apprentissage
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
          {/* Column 1 */}
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: "6.5pt", width: 20, textAlign: "center" }}>OUI</span>
              <span style={{ fontSize: "6.5pt", width: 20, textAlign: "center" }}>NON</span>
            </div>
            {comportCol1.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: "7pt" }}>{c.label}</span>
                <OuiNon val={c.oui} />
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: "7pt" }}>
              <div style={{ fontStyle: "italic", color: "#555" }}>Savardce</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span>Nbre d'absences</span>
                <span style={{ borderBottom: "1px solid #333", minWidth: 20, textAlign: "center" }}>
                  {data.comportement.absences}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span>Nbre de retards</span>
                <span style={{ borderBottom: "1px solid #333", minWidth: 20, textAlign: "center" }}>
                  {data.comportement.retards}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: "6.5pt", width: 20, textAlign: "center" }}>OUI</span>
              <span style={{ fontSize: "6.5pt", width: 20, textAlign: "center" }}>NON</span>
            </div>
            {comportCol2.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: "7pt" }}>{c.label}</span>
                <OuiNon val={c.oui} />
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: "7pt" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Nbre de devoirs non remis</span>
                <span style={{ borderBottom: "1px solid #333", minWidth: 20, textAlign: "center" }}>
                  {data.comportement.devoirsNonRemis}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span>Nbre de leçons non sues</span>
                <span style={{ borderBottom: "1px solid #333", minWidth: 20, textAlign: "center" }}>
                  {data.comportement.leconsNonSues}
                </span>
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: "6.5pt", width: 20, textAlign: "center" }}>OUI</span>
              <span style={{ fontSize: "6.5pt", width: 20, textAlign: "center" }}>NON</span>
            </div>
            {comportCol3.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: "7pt" }}>{c.label}</span>
                <OuiNon val={c.oui} />
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: "7pt" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Respect des prescrits de l'uniforme</span>
                <span style={{ borderBottom: "1px solid #333", minWidth: 20 }}></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span>Discipline</span>
                <span style={{ borderBottom: "1px solid #333", minWidth: 20 }}></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Points forts / Défis / Remarque */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
        <div style={{ border: "1px solid #aaa", padding: "4px" }}>
          <div style={{ fontSize: "8pt", fontWeight: "bold", textDecoration: "underline", marginBottom: 3 }}>
            Points forts et / ou défis à relever
          </div>
          <div style={{ fontSize: "7.5pt", marginBottom: 2 }}>
            <strong>Point(s) fort(s) :</strong>
          </div>
          <div
            style={{
              fontSize: "7.5pt",
              minHeight: 30,
              borderBottom: "1px solid #ccc",
              marginBottom: 6,
            }}
          >
            {data.comportement.pointsForts}
          </div>
          <div style={{ fontSize: "7.5pt", marginBottom: 2 }}>
            <strong>Défi(s) à relever :</strong>
          </div>
          <div style={{ fontSize: "7.5pt", minHeight: 30 }}>
            {data.comportement.defis}
          </div>
        </div>
        <div style={{ border: "1px solid #aaa", padding: "4px" }}>
          <div style={{ fontSize: "8pt", fontWeight: "bold", textDecoration: "underline", marginBottom: 3 }}>
            Remarque
          </div>
          <div style={{ fontSize: "7.5pt", minHeight: 60 }}>
            {data.comportement.remarque}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          border: "1px solid #aaa",
          padding: "4px",
          fontSize: "7pt",
          marginBottom: "6px",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 2 }}>Légende des notes et des couleurs</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2px" }}>
          <span>90-100 : A+ = Excellent</span>
          <span>78-84 : B+ = Très bien</span>
          <span>69-74 : C+ = Bien</span>
          <span style={{ color: "#c0392b" }}>51-59 : D = Déficient</span>
          <span>85-89 : A = Excellent</span>
          <span>75-77 : B = Très bien</span>
          <span>60-68 : C = Assez bien</span>
          <span style={{ color: "#c0392b" }}>≤50 : E = Échec</span>
        </div>
        <div style={{ marginTop: 3, borderTop: "1px solid #ddd", paddingTop: 3 }}>
          <strong>Seuil de réussite pour promotion automatique en classe supérieure 7.00</strong>
        </div>
        <div style={{ color: "#555", marginTop: 2 }}>
          Calcul de la moyenne de l'étape : 70% R1 + 25% R2 + 5% R3
        </div>
        <div style={{ color: "#555" }}>
          Calcul de la moyenne générale : Somme des étapes / nbre d'Étapes
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: "1px solid #333",
          paddingTop: "4px",
          fontSize: "7pt",
          color: "#555",
        }}
      >
        <div>
          Delmas, Angle 47 & 41 #10 / Téléphone : 2813-1205 | 2264-2081 | 4893-3367 / Courriel : information@stleonard.ht
        </div>
        <div style={{ display: "flex", gap: "30px", fontSize: "9pt", fontWeight: "bold", color: "#000" }}>
          <span>Parent</span>
          <span>Direction</span>
        </div>
      </div>
    </div>
  );
}