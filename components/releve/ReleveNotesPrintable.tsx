/**
 * Relevé de notes — GABARIT imprimable (Letter portrait, une page).
 *
 * Référence : docs/GABARIT-RELEVE.md v0.4 (hors dépôt), §1 à §8.
 *
 * Ce composant AFFICHE ReleveData, rien d'autre : aucun calcul, aucune valeur
 * de repli, aucun reformatage de nombre. Tout ce qui est imprimé sort déjà
 * formaté de lib/releve (buildReleveData). Les mesures, polices et couleurs
 * sont dans releve-layout.ts.
 */
import { forwardRef } from 'react'
import { normalizeUploadUrl } from '@/lib/upload-url'
import { bandClass } from '@/lib/releve/present'
import type { ReleveData, ReleveGroup } from '@/lib/releve/types'
import {
  BAND_COLORS,
  FILLS,
  FONT_STACKS,
  INKS,
  PAPER_PX,
  RESERVES_PX,
  SIZES,
  USABLE_PX,
} from './releve-layout'
import { releveFontVariables } from './releve-fonts'

const px = (n: number) => `${n}px`

const CSS = `
.rlv{position:relative;box-sizing:border-box;width:${px(PAPER_PX.width)};height:${px(PAPER_PX.height)};
  background:#fff;color:${INKS.texte};overflow:hidden;}
.rlv *,.rlv *::before,.rlv *::after{box-sizing:border-box;}
.rlv-zone{position:absolute;top:${px(RESERVES_PX.top)};left:${px(RESERVES_PX.left)};
  width:${px(USABLE_PX.width)};height:${px(USABLE_PX.height)};overflow:hidden;}
.rlv-content{display:flex;flex-direction:column;gap:6px;width:100%;}

.rlv-id{display:grid;grid-template-columns:${px(SIZES.photo.width)} 1fr auto;gap:12px;align-items:center;}
.rlv-photo{width:${px(SIZES.photo.width)};height:${px(SIZES.photo.height)};border:1px solid ${INKS.trait};
  display:flex;align-items:center;justify-content:center;overflow:hidden;}
.rlv-photo img{width:100%;height:100%;object-fit:cover;display:block;}
.rlv-id-fields{display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:2px;align-items:baseline;}
.rlv-id-label{font-family:${FONT_STACKS.calibri};font-size:${px(SIZES.identityLabel)};color:${INKS.texte};}
.rlv-id-label.rlv-id-label-clair{color:${INKS.libelleClair};}
.rlv-id-value{font-family:${FONT_STACKS.identite};font-size:${px(SIZES.identity)};color:${INKS.manuscrit};
  line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:clip;}
.rlv-id-right{display:grid;grid-template-columns:auto auto;column-gap:8px;row-gap:2px;align-items:baseline;}
.rlv-id-right .rlv-id-label{font-family:${FONT_STACKS.cambria};}

.rlv-title{font-family:${FONT_STACKS.titre};font-weight:700;font-size:${px(SIZES.title)};color:${INKS.manuscrit};
  text-align:center;margin:2px 0;}

.rlv-cols{display:grid;grid-template-columns:1fr 1fr;column-gap:${px(SIZES.columnGap)};align-items:start;}
.rlv-col{display:flex;flex-direction:column;gap:${px(SIZES.groupGap)};}
.rlv-table{width:100%;border-collapse:collapse;table-layout:fixed;}
.rlv-table th,.rlv-table td{height:${px(SIZES.row)};padding:0 2px;border:0.75px solid ${INKS.trait};
  line-height:1;white-space:nowrap;overflow:hidden;}
.rlv-table th{font-family:${FONT_STACKS.entetes};font-size:${px(SIZES.columnHeader)};font-weight:700;text-align:center;
  color:${INKS.manuscrit};white-space:nowrap;overflow:visible;text-overflow:clip;}
.rlv-table th.rlv-label-col{width:${SIZES.labelColumn};}
.rlv-num{font-family:${FONT_STACKS.nombres};font-size:${px(SIZES.cell)};text-align:center;}
.rlv-line-label{font-family:${FONT_STACKS.libelles};font-size:${px(SIZES.cell)};text-align:left;text-overflow:ellipsis;}
.rlv-group-title{font-family:${FONT_STACKS.libelles};font-size:${px(SIZES.group)};font-weight:700;text-align:left;}
.rlv-table thead th{background-color:${FILLS.enteteGroupe};}
.rlv-table th.rlv-group-title{font-family:${FONT_STACKS.libelles};font-size:${px(SIZES.group)};text-align:left;
  color:${INKS.manuscrit};text-decoration:underline;overflow:hidden;}
.rlv-discipline .rlv-line-label{text-align:right;font-style:italic;}
.rlv-band-echec{color:${BAND_COLORS.echec};}
.rlv-band-deficient{color:${BAND_COLORS.deficient};}
.rlv-band-assez-bien{color:${BAND_COLORS['assez-bien']};}

.rlv-foot{display:grid;grid-template-columns:1fr auto;column-gap:16px;align-items:end;font-size:${px(SIZES.footer)};}
.rlv-remarque-title{font-family:${FONT_STACKS.titre};font-weight:700;text-decoration:underline;}
.rlv-remarque{font-family:${FONT_STACKS.remarque};color:${INKS.manuscrit};font-size:${px(SIZES.footer + 4)};}
.rlv-legend-title{font-family:${FONT_STACKS.calibri};text-decoration:underline;margin-top:3px;}
.rlv-legend{display:grid;grid-template-columns:repeat(4,auto);column-gap:10px;row-gap:1px;
  font-family:${FONT_STACKS.calibri};justify-content:start;}
.rlv-seuil{font-family:${FONT_STACKS.titre};font-weight:700;text-decoration:underline;margin-top:3px;}
.rlv-address{font-family:${FONT_STACKS.cambria};margin-top:3px;line-height:1.3;}
.rlv-direction{width:170px;text-align:center;font-family:${FONT_STACKS.cambria};font-weight:700;
  font-size:${px(SIZES.footer + 2)};}
.rlv-direction-line{border-top:1.5px solid ${INKS.traitDirection};margin-bottom:3px;}
`

/**
 * Un groupe (matière ou Discipline) = un petit tableau. Rangée d'en-tête :
 * nom du groupe dans la colonne des libellés, puis « Coeff », les étapes et
 * « Moy. Gnle ». Mêmes colonnes et même `table-layout:fixed` pour tous les
 * tableaux d'une colonne : les chiffres restent alignés d'un groupe à l'autre.
 */
function GroupTable({ group, stepHeaders }: { group: ReleveGroup; stepHeaders: string[] }) {
  return (
    <table className={group.kind === 'discipline' ? 'rlv-table rlv-discipline' : 'rlv-table'}>
      <thead>
        <tr>
          <th className="rlv-label-col rlv-group-title">{group.title}</th>
          <th>Coeff</th>
          {stepHeaders.map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}
          <th>Moy. Gnle</th>
        </tr>
      </thead>
      <tbody>
        {group.lines.map((line, i) => (
          <tr key={`${line.label}-${i}`}>
            <td className="rlv-line-label">{line.label}</td>
            <td className="rlv-num">{line.coeff}</td>
            {line.cells.map((cell, c) => (
              <td key={c} className={`rlv-num ${bandClass(cell.band)}`}>{cell.text}</td>
            ))}
            <td className={`rlv-num ${bandClass(line.average.band)}`}>{line.average.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Column({ groups, stepHeaders }: { groups: ReleveGroup[]; stepHeaders: string[] }) {
  return (
    <div className="rlv-col">
      {groups.map((g, i) => <GroupTable key={`${g.title}-${i}`} group={g} stepHeaders={stepHeaders} />)}
    </div>
  )
}

export interface ReleveNotesPrintableProps {
  data: ReleveData
}

/**
 * La feuille, à l'échelle 1 (816 × 1056 px). `ref` désigne le conteneur du
 * contenu, mesuré par l'aperçu pour détecter un dépassement de la zone utile.
 * La racine porte `data-releve-sheet` : c'est elle que capture le PDF.
 */
export const ReleveNotesPrintable = forwardRef<HTMLDivElement, ReleveNotesPrintableProps>(
  function ReleveNotesPrintable({ data }, contentRef) {
    const { identity, stepHeaders, left, right, footer } = data
    const photo = normalizeUploadUrl(identity.photoUrl)
    return (
      <div className={`rlv ${releveFontVariables}`} data-releve-sheet="true">
        <style>{CSS}</style>
        <div className="rlv-zone">
          <div className="rlv-content" ref={contentRef}>
            {/* §2 — identité */}
            <div className="rlv-id">
              <div className="rlv-photo">
                {photo ? (
                  // <img> natif : html2canvas capture le DOM, pas next/image (même choix que le bulletin).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" crossOrigin="anonymous" />
                ) : null}
              </div>
              <div className="rlv-id-fields">
                <span className="rlv-id-label">Prénom(s)</span>
                <span className="rlv-id-value">{identity.prenom}</span>
                <span className="rlv-id-label">Nom</span>
                <span className="rlv-id-value">{identity.nom}</span>
                <span className="rlv-id-label rlv-id-label-clair">Date de naissance</span>
                <span className="rlv-id-value">{identity.dateNaissance}</span>
              </div>
              <div className="rlv-id-right">
                <span className="rlv-id-label">Niveau</span>
                <span className="rlv-id-value">{identity.niveau}</span>
                <span className="rlv-id-label">Année scolaire</span>
                <span className="rlv-id-value">{identity.anneeScolaire}</span>
              </div>
            </div>

            <div className="rlv-title">Relevé de Notes</div>

            {/* §3 — deux colonnes ; Discipline est déjà en fin de colonne gauche */}
            <div className="rlv-cols">
              <Column groups={left} stepHeaders={stepHeaders} />
              <Column groups={right} stepHeaders={stepHeaders} />
            </div>

            {/* §6 — pied de page */}
            <div className="rlv-foot">
              <div>
                <div className="rlv-remarque-title">Remarque</div>
                <div className="rlv-remarque">{footer.remarque}</div>
                <div className="rlv-legend-title">Légende des notes et des couleurs</div>
                <div className="rlv-legend">
                  {footer.legende.map((e) => (
                    <span key={e.mention} className={bandClass(e.band)}>
                      {e.range} : {e.mention} = {e.label}
                    </span>
                  ))}
                </div>
                <div className="rlv-seuil">
                  Seuil de réussite pour promotion automatique en classe supérieure {footer.seuil}
                </div>
                <div className="rlv-address">
                  <div>{footer.adresse}</div>
                  <div>{footer.telephone}</div>
                  {footer.courriel ? <div>{footer.courriel}</div> : null}
                </div>
              </div>
              <div className="rlv-direction">
                <div className="rlv-direction-line" />
                Direction
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)
