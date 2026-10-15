/**
 * Relevé de notes — PDF Letter portrait, une page.
 *
 * Capture le SEUL nœud de la feuille (`[data-releve-sheet]`), jamais la coque
 * d'administration. La feuille de l'aperçu est réduite par une transformation
 * CSS : on en capture une COPIE posée à l'échelle 1 dans un hôte hors flux,
 * comme le fait la capture du bulletin (lib/bulletin-pdf-capture.ts,
 * createBulletinPdfHost), avec les mêmes options d'image : useCORS, sans
 * allowTaint.
 */
import { PAPER_IN, PAPER_PX } from '@/components/releve/releve-layout'

/** Résolution de la capture : 2 px par px CSS, comme le bulletin. */
const CAPTURE_SCALE = 2

function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** Attend les images et les polices de la copie : une image non chargée sortirait blanche. */
async function waitForAssets(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : img.decode().catch(() => {
            throw new Error('Photo de l’élève illisible pour le PDF.')
          }),
    ),
  )
  if (document.fonts?.ready) await document.fonts.ready
}

/**
 * Capture `sheet` (la racine `[data-releve-sheet]`) et télécharge le PDF.
 * Lève une erreur si la capture échoue ; rien n'est téléchargé dans ce cas.
 */
export async function downloadRelevePdf(sheet: HTMLElement, fileName: string): Promise<void> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${PAPER_PX.width}px`,
    `height:${PAPER_PX.height}px`,
    'overflow:hidden',
    'background:#fff',
    'pointer-events:none',
    'z-index:-2147483648',
  ].join(';')
  const copy = sheet.cloneNode(true) as HTMLElement
  copy.style.transform = 'none'
  host.appendChild(copy)
  document.body.appendChild(host)

  try {
    await waitForAssets(copy)
    await waitTwoFrames()
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(copy, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: PAPER_PX.width,
      height: PAPER_PX.height,
      windowWidth: PAPER_PX.width,
      windowHeight: PAPER_PX.height,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    })
    if (canvas.width === 0 || canvas.height === 0) throw new Error('La capture du relevé est vide.')

    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter', compress: true })
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAPER_IN.width, PAPER_IN.height, undefined, 'FAST')
    pdf.save(fileName)
  } finally {
    host.remove()
  }
}
