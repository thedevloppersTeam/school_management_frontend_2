// components/BulletinScolaire.tsx
"use client";

import React from "react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RubriqueEntry {
  name:     string;
  note?:    number | null;   // null = parent MENFP (section sans note)
  coeff?:   number;
  isParent: boolean;         // true = en-tête MENFP, false = sous-matière
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
  items:           ComportementItem[];
  pointsForts:     string;
  defis:           string;
  remarque:        string;
}

export interface EtablissementData {
  nomLigne1: string;
  nomLigne2: string;
  adresse:   string;
  telephone: string;
  email:     string;
  logoUrl:   string;
}

export interface BulletinData {
  // Élève
  prenoms:       string;
  nom:           string;
  sexe:          string;
  niveau:        string;
  filiere:       string;
  dateNaissance: string;
  anneeScolaire: string;
  periode:       string;
  code:          string;
  nisu:          string;
  photoUrl?:     string;

  // Rubriques
  rubrique1Name:  string;
  rubrique1Poids: string;   // ex. "70%"
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

  // Résultats
  moyenneEtape:  string;
  appreciation:  string;
  moyenneClasse: string;

  // Comportement
  comportement: ComportementData;

  // Établissement (récupéré en base)
  etablissement: EtablissementData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function noteStyle(note: number): React.CSSProperties {
  if (note <= 50)               return { color: '#c0392b', fontWeight: 'bold' };
  if (note >= 51 && note <= 59) return { color: '#cc6600', fontWeight: 'bold' };
  if (note >= 60 && note <= 68) return { color: '#2c6e2e', fontWeight: 'bold' };
  return { color: '#000' };
}

function fmt(n: number | null): string {
  return n !== null ? n.toFixed(2) : '—';
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function RubriqueTable({
  name, poids, entries, moy,
}: Readonly<{
  name:    string;
  poids:   string;
  entries: RubriqueEntry[];
  moy:     number | null;
}>) {
  return (
    <div style={{ border: '1px solid #aaa' }}>
      {/* En-tête rubrique */}
      <div style={{
        background: '#f0f0f0',
        fontSize: '7.5pt',
        fontWeight: 'bold',
        padding: '3px 5px',
        textAlign: 'left',
        borderBottom: '1px solid #aaa',
      }}>
        {name} ({poids})
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt' }}>
        <thead>
          <tr style={{ background: '#f7f7f7', borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '2px 4px' }}></th>
            <th style={{ textAlign: 'center', padding: '2px 4px', borderLeft: '1px solid #ddd', width: '20%' }}>Note</th>
            <th style={{ textAlign: 'center', padding: '2px 4px', borderLeft: '1px solid #ddd', width: '16%' }}>Coeff.</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) =>
            entry.isParent ? (
              // Section MENFP — pas de note
              <tr key={i} style={{ background: '#f0f0f0' }}>
                <td style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '7pt' }} colSpan={3}>
                  {entry.name}
                </td>
              </tr>
            ) : (
              // Sous-matière — note colorée
              <tr key={i}>
                <td style={{ padding: '1.5px 4px 1.5px 14px' }}>{entry.name}</td>
                <td style={{
                  textAlign: 'center',
                  borderLeft: '1px solid #ddd',
                  ...(entry.note !== null && entry.note !== undefined
                    ? noteStyle(entry.note)
                    : { color: '#000' }),
                }}>
                  {entry.note !== null && entry.note !== undefined ? fmt(entry.note) : '—'}
                </td>
                <td style={{ textAlign: 'center', borderLeft: '1px solid #ddd' }}>
                  {entry.coeff ?? ''}
                </td>
              </tr>
            )
          )}
          {/* Ligne moyenne */}
          <tr style={{ background: '#e8e8e8', borderTop: '1.5px solid #999' }}>
            <td style={{ padding: '2px 5px', fontWeight: 'bold' }}>Moy.</td>
            <td style={{ textAlign: 'center', borderLeft: '1px solid #ddd', fontWeight: 'bold' }}>{fmt(moy)}</td>
            <td style={{ textAlign: 'center', borderLeft: '1px solid #ddd' }}>/10</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Checkbox({ checked }: Readonly<{ checked: boolean | null }>) {
  return (
    <span style={{
      width: '10px', height: '10px',
      border: '1px solid #333',
      display: 'inline-block',
      textAlign: 'center',
      fontSize: '9pt',
      lineHeight: '9px',
    }}>
      {checked === true ? '✓' : ''}
    </span>
  );
}

function ComportementCol({ items }: Readonly<{ items: ComportementItem[] }>) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '3px' }}>
        <span style={{ width: '22px', textAlign: 'center', fontWeight: 'bold' }}>OUI</span>
        <span style={{ width: '22px', textAlign: 'center', fontWeight: 'bold' }}>NON</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '4px',
        }}>
          <span>{item.label}</span>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <span style={{ width: '22px', display: 'flex', justifyContent: 'center' }}>
              <Checkbox checked={item.oui === true ? true : null} />
            </span>
            <span style={{ width: '22px', display: 'flex', justifyContent: 'center' }}>
              <Checkbox checked={item.oui === false ? true : null} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function BulletinScolaire({ data }: Readonly<{ data: BulletinData }>) {
  const col1 = data.comportement.items.filter(c => c.col === 1);
  const col2 = data.comportement.items.filter(c => c.col === 2);
  const col3 = data.comportement.items.filter(c => c.col === 3);
  const { etablissement: etab, comportement: comp } = data;

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      fontSize: '9pt',
      background: 'white',
      width: '210mm',
      margin: '0 auto',
      padding: '8mm',
      color: '#000',
      boxSizing: 'border-box',
      border: '1px solid #bbb',
    }}>

      {/* ════════════════════════════════════════
          EN-TÊTE
      ════════════════════════════════════════ */}
      <div style={{
        border: '1.5px solid #1a3a6e',
        padding: '6px 8px',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        {/* Logo */}
        <div style={{
          width: '64px', height: '64px',
          border: '1px solid #bbb',
          flexShrink: 0, background: '#f5f5f5',
          overflow: 'hidden',
        }}>
          <Image
            src={etab.logoUrl || '/test.jpeg'}
            alt={`Logo ${etab.nomLigne2}`}
            width={64} height={64}
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Titre */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '7pt', color: '#1a3a6e', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase' }}>
            {etab.nomLigne1}
          </div>
          <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#1a3a6e', letterSpacing: '4px' }}>
            {etab.nomLigne2}
          </div>
          <div style={{
            fontSize: '15pt', fontWeight: 'bold', color: '#000', letterSpacing: '3px',
            borderTop: '1.5px solid #1a3a6e', borderBottom: '1.5px solid #1a3a6e',
            margin: '4px 0', padding: '3px 0',
          }}>
            BULLETIN SCOLAIRE
          </div>
          <div style={{ fontSize: '6.5pt', color: '#555', letterSpacing: '1px' }}>
            Année Scolaire : {data.anneeScolaire} &nbsp;·&nbsp; {data.periode}
          </div>
        </div>

        {/* Photo élève */}
        <div style={{
          width: '60px', height: '72px',
          border: '1px solid #999',
          flexShrink: 0,
          background: '#f5f5f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          fontSize: '6.5pt', color: '#999', textAlign: 'center',
        }}>
          {data.photoUrl ? (
            <Image src={data.photoUrl} alt="Photo élève" width={60} height={72} style={{ objectFit: 'cover' }} />
          ) : (
            <>Photo<br />élève</>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          INFORMATIONS ÉLÈVE
      ════════════════════════════════════════ */}
      <div style={{
        border: '1px solid #bbb',
        padding: '4px 8px',
        marginBottom: '5px',
        background: '#f9f9f9',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '3px 24px',
        fontSize: '8pt',
      }}>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Prénom(s) :</span> <span style={{ fontWeight: 'bold' }}>{data.prenoms}</span></div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Niveau :</span> {data.niveau}</div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Nom :</span> <span style={{ fontWeight: 'bold' }}>{data.nom}</span></div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Filière :</span> {data.filiere || '—'}</div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Sexe :</span> {data.sexe}</div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Date de naissance :</span> {data.dateNaissance}</div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>Code élève :</span> <span style={{ fontFamily: "'Courier New', monospace", fontSize: '7.5pt' }}>{data.code}</span></div>
        <div><span style={{ color: '#1a3a6e', fontWeight: 'bold' }}>NISU :</span> <span style={{ fontFamily: "'Courier New', monospace", fontSize: '7.5pt' }}>{data.nisu}</span></div>
      </div>

      {/* ════════════════════════════════════════
          3 COLONNES RUBRIQUES
      ════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '4px',
        marginBottom: '5px',
      }}>
        <RubriqueTable name={data.rubrique1Name} poids={data.rubrique1Poids} entries={data.rubrique1} moy={data.moyR1} />
        <RubriqueTable name={data.rubrique2Name} poids={data.rubrique2Poids} entries={data.rubrique2} moy={data.moyR2} />
        <RubriqueTable name={data.rubrique3Name} poids={data.rubrique3Poids} entries={data.rubrique3} moy={data.moyR3} />
      </div>

      {/* ════════════════════════════════════════
          MOYENNE DE L'ÉTAPE
      ════════════════════════════════════════ */}
      <div style={{
        border: '1.5px solid #1a3a6e',
        padding: '5px 12px',
        marginBottom: '5px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        background: '#eef2f8',
      }}>
        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#1a3a6e' }}>Moyenne de l&apos;étape :</div>
        <div style={{ fontSize: '15pt', fontWeight: 'bold', color: '#1a3a6e', borderBottom: '2px solid #1a3a6e', minWidth: '44px', textAlign: 'center' }}>
          {data.moyenneEtape}
        </div>
        <div style={{ fontSize: '7.5pt', color: '#555' }}>/10</div>
        <div style={{ width: '1px', height: '28px', background: '#bbb' }} />
        <div style={{ fontSize: '8pt', color: '#555' }}>
          Appréciation : <strong style={{ fontSize: '12pt', color: '#2c6e2e' }}>{data.appreciation}</strong>
        </div>
        <div style={{ width: '1px', height: '28px', background: '#bbb' }} />
        <div style={{ fontSize: '8pt', color: '#555' }}>
          Moy. de classe : <strong>{data.moyenneClasse}</strong> /10
        </div>
      </div>

      {/* ════════════════════════════════════════
          COMPORTEMENT
      ════════════════════════════════════════ */}
      <div style={{ border: '1px solid #aaa', padding: '4px 6px', marginBottom: '5px' }}>
        <div style={{ fontSize: '8pt', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '5px' }}>
          Difficultés de comportement et / ou d&apos;apprentissage
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '6.5pt' }}>
          {/* Colonne 1 */}
          <div>
            <ComportementCol items={col1} />
            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Nbre d&apos;absences :</span>
              <span style={{ borderBottom: '1px solid #333', minWidth: '22px', textAlign: 'center' }}>{comp.absences}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span>Nbre de retards :</span>
              <span style={{ borderBottom: '1px solid #333', minWidth: '22px', textAlign: 'center' }}>{comp.retards}</span>
            </div>
          </div>
          {/* Colonne 2 */}
          <div>
            <ComportementCol items={col2} />
            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Nbre devoirs non remis :</span>
              <span style={{ borderBottom: '1px solid #333', minWidth: '22px', textAlign: 'center' }}>{comp.devoirsNonRemis}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span>Nbre leçons non sues :</span>
              <span style={{ borderBottom: '1px solid #333', minWidth: '22px', textAlign: 'center' }}>{comp.leconsNonSues}</span>
            </div>
          </div>
          {/* Colonne 3 */}
          <div>
            <ComportementCol items={col3} />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          POINTS FORTS / REMARQUE
      ════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px',
        marginBottom: '5px',
        fontSize: '7pt',
      }}>
        <div style={{ border: '1px solid #aaa', padding: '4px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '7.5pt', textDecoration: 'underline', marginBottom: '3px' }}>
            Points forts et / ou défis à relever
          </div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Point(s) fort(s) :</div>
          <div style={{ borderBottom: '1px solid #ddd', minHeight: '20px', marginBottom: '4px', fontStyle: 'italic', color: '#555' }}>
            {comp.pointsForts}
          </div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Défi(s) à relever :</div>
          <div style={{ minHeight: '20px', fontStyle: 'italic', color: '#555' }}>
            {comp.defis}
          </div>
        </div>
        <div style={{ border: '1px solid #aaa', padding: '4px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '7.5pt', textDecoration: 'underline', marginBottom: '3px' }}>
            Remarque
          </div>
          <div style={{ minHeight: '44px', fontStyle: 'italic', color: '#555' }}>
            {comp.remarque}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          FOOTER : Légende + Établissement | Signatures
      ════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        borderTop: '1px solid #333',
        paddingTop: '6px',
      }}>
        {/* Gauche */}
        <div>
          <div style={{ fontSize: '5.5pt', marginBottom: '6px', lineHeight: '1.7' }}>
                        <span style={{ fontWeight: 'bold' }}>Légende : </span>
            90-100 : A+ Excellent &nbsp;|&nbsp; 85-89 : A Excellent &nbsp;|&nbsp; 78-84 : B+ Très bien &nbsp;|&nbsp; 75-77 : B Très bien &nbsp;|&nbsp; 69-74 : C+ Bien &nbsp;|&nbsp;{' '}
            <span style={{ color: '#2c6e2e', fontWeight: 'bold' }}>60-68 : C Assez bien</span>{' '}&nbsp;|&nbsp;{' '}
                        <span style={{ color: '#cc6600', fontWeight: 'bold' }}>51-59 : D Déficient</span> &nbsp;|&nbsp;
            <span style={{ color: '#c0392b', fontWeight: 'bold' }}>≤50 : E Échec</span>{/*
            */}<br />
            Seuil de promotion : 7.00 / 10 &nbsp;—&nbsp; Formule : 70% R1 + 25% R2 + 5% R3
          </div>
          <div style={{ fontSize: '6pt', color: '#555', lineHeight: '1.6' }}>
            {etab.adresse} &nbsp;|&nbsp; Tél : {etab.telephone}<br />
            {etab.email}
          </div>
        </div>

        {/* Droite : signatures */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '7pt' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: '115px' }}>Signature Direction :</span>
            <span style={{ flex: 1, borderBottom: '1px solid #333', display: 'block', height: '18px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '7pt' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', minWidth: '115px' }}>Signature Parent :</span>
            <span style={{ flex: 1, borderBottom: '1px solid #333', display: 'block', height: '18px' }} />
          </div>
        </div>
      </div>

    </div>
  );
}