import type { jsPDF } from "jspdf"

export const LETTER_WIDTH_MM = 215.9
export const LETTER_HEIGHT_MM = 279.4
export const PDF_CAPTURE_HOST_ID = "bulletin-pdf-capture-host"

const CSS_DPI = 96
const LETTER_WIDTH_PX = 8.5 * CSS_DPI
const LETTER_HEIGHT_PX = 11 * CSS_DPI
const DEFAULT_TEMPLATE_SCALE = 0.725
const CAPTURE_SCALE = 2

type BulletinCaptureResult = {
  canvas: HTMLCanvasElement
  cssWidth: number
  cssHeight: number
  templateScale: number
}

type CaptureGeometry = {
  cssWidth: number
  cssHeight: number
  templateScale: number
}

function parsePositiveNumber(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveBulletinElement(root: HTMLElement): HTMLElement {
  if (root.matches('[data-bulletin-page="true"], .btpl')) {
    return root
  }

  const bulletin = root.querySelector<HTMLElement>(
    '[data-bulletin-page="true"], .btpl',
  )

  if (!bulletin) {
    throw new Error("Aucun élément de bulletin n'a été trouvé pour la capture PDF.")
  }

  return bulletin
}

function getTemplateScale(bulletin: HTMLElement): number {
  const computed = window.getComputedStyle(bulletin)
  return parsePositiveNumber(
    computed.getPropertyValue("--template-scale"),
    DEFAULT_TEMPLATE_SCALE,
  )
}

function getRenderedPaperSize(bulletin: HTMLElement): {
  width: number
  height: number
} {
  const computed = window.getComputedStyle(bulletin)

  return {
    width: parsePositiveNumber(computed.width, LETTER_WIDTH_PX),
    height: parsePositiveNumber(computed.height, LETTER_HEIGHT_PX),
  }
}

function getPagePadding(page: HTMLElement | null): {
  top: number
  right: number
  bottom: number
  left: number
} {
  if (!page) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  const computed = window.getComputedStyle(page)

  return {
    top: parsePositiveNumber(computed.paddingTop, 0),
    right: parsePositiveNumber(computed.paddingRight, 0),
    bottom: parsePositiveNumber(computed.paddingBottom, 0),
    left: parsePositiveNumber(computed.paddingLeft, 0),
  }
}

export function waitForTwoFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Crée un hôte DOM hors de la zone visible.
 *
 * Cet hôte sert aussi aux générations en lot qui montent temporairement un
 * composant React avant d'appeler captureBulletinElement().
 */
export function removeStalePdfCaptureHosts(): void {
  if (typeof document === "undefined") return

  const hosts = document.querySelectorAll<HTMLElement>(
    `[data-bulletin-pdf-host="true"], [data-pdf-capture-host="true"], #${PDF_CAPTURE_HOST_ID}`,
  )

  hosts.forEach((host) => host.remove())
}

export function createBulletinPdfHost(): HTMLDivElement {
  const host = document.createElement("div")
  host.setAttribute("data-bulletin-pdf-host", "true")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:8.5in",
    "height:11in",
    "overflow:hidden",
    "background:#fff",
    "pointer-events:none",
    "z-index:-2147483648",
  ].join(";")
  return host
}

/**
 * Prépare un clone destiné à la prévisualisation ou à l'impression native.
 *
 * Le correctif de capture sans transform est volontairement appliqué dans
 * captureBulletinElement(), sur un clone interne séparé, afin de ne pas casser
 * la prévisualisation ni window.print().
 */
export function prepareBulletinPdfNode(root: HTMLElement): HTMLElement {
  root.style.width = "8.5in"
  root.style.minHeight = "11in"
  root.style.height = "auto"
  root.style.maxHeight = "none"
  root.style.overflow = "visible"
  root.style.backgroundColor = "#fff"

  const bulletin = resolveBulletinElement(root)
  bulletin.classList.add("pdf-capture")
  bulletin.style.width = "8.5in"
  bulletin.style.minHeight = "11in"
  bulletin.style.height = "11in"
  bulletin.style.maxHeight = "none"
  bulletin.style.overflow = "visible"

  return bulletin
}

// Toutes les attentes d'assets sont bornées : une police qui ne se charge
// jamais ou une image sans src (complete=true, naturalWidth=0, aucun événement
// load/error émis — cas typique d'une photo d'élève absente) ne doit jamais
// geler la génération d'un bulletin, a fortiori un lot entier.
const FONTS_WAIT_TIMEOUT_MS = 3_000
const IMAGE_WAIT_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ])
}

export async function waitForBulletinPdfAssets(root: HTMLElement): Promise<void> {
  if (document.fonts?.ready) {
    await withTimeout(document.fonts.ready, FONTS_WAIT_TIMEOUT_MS)
  }

  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"))

  await Promise.all(
    images.map(async (image) => {
      // Pas de src exploitable → aucun événement ne viendra jamais : on ignore.
      const src = image.getAttribute("src")
      if (!src) return

      if (image.complete && image.naturalWidth > 0) {
        if (typeof image.decode === "function") {
          await withTimeout(image.decode().catch(() => undefined), IMAGE_WAIT_TIMEOUT_MS)
        }
        return
      }

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          image.removeEventListener("load", done)
          image.removeEventListener("error", done)
          resolve()
        }, IMAGE_WAIT_TIMEOUT_MS)
        const done = () => {
          clearTimeout(timer)
          resolve()
        }
        image.addEventListener("load", done, { once: true })
        image.addEventListener("error", done, { once: true })
      })

      if (typeof image.decode === "function") {
        await withTimeout(image.decode().catch(() => undefined), IMAGE_WAIT_TIMEOUT_MS)
      }
    }),
  )
}
function resolveSvgCoordinate(value: string | null | undefined, size: number): number {
  const raw = value ?? "50%"

  if (raw.endsWith("%")) {
    const pct = Number.parseFloat(raw)
    return Number.isFinite(pct) ? size * (pct / 100) : size / 2
  }

  const px = Number.parseFloat(raw)
  return Number.isFinite(px) ? px : size / 2
}

function resolveCanvasFillStyle(textStyle: CSSStyleDeclaration, svgStyle: CSSStyleDeclaration): string {
  const fill = textStyle.fill

  if (fill && fill !== "none" && fill !== "currentColor" && fill !== "currentcolor") {
    return fill
  }

  return textStyle.color || svgStyle.color || "#000"
}

/**
 * html2canvas peut rasteriser les SVG inline avec un fond blanc.
 * On les convertit en PNG transparent uniquement dans le clone PDF.
 */
function rasterizeBulletinInlineSvgText(root: HTMLElement): void {
  const svgs = Array.from(
    root.querySelectorAll<SVGSVGElement>("svg.pdf-inline-svg-text"),
  )

  svgs.forEach((svg) => {
    const text = svg.querySelector<SVGTextElement>("text")
    const value = text?.textContent ?? ""

    if (!text || value.length === 0) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(rect.width))
    const height = Math.max(1, Math.ceil(rect.height))

    const svgStyle = window.getComputedStyle(svg)
    const textStyle = window.getComputedStyle(text)

    const pixelRatio = Math.max(
      2,
      Math.min(4, window.devicePixelRatio || 1),
    )

    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(width * pixelRatio)
    canvas.height = Math.ceil(height * pixelRatio)

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)

    context.font = [
      textStyle.fontStyle || svgStyle.fontStyle || "normal",
      textStyle.fontWeight || svgStyle.fontWeight || "400",
      textStyle.fontSize || svgStyle.fontSize || "10px",
      textStyle.fontFamily || svgStyle.fontFamily || "serif",
    ].join(" ")

    context.fillStyle = resolveCanvasFillStyle(textStyle, svgStyle)
    context.textBaseline = "middle"

    const anchor = text.getAttribute("text-anchor") ?? "start"

    context.textAlign =
      anchor === "middle"
        ? "center"
        : anchor === "end"
          ? "right"
          : "left"

    const x = resolveSvgCoordinate(text.getAttribute("x"), width)
    const y = resolveSvgCoordinate(text.getAttribute("y"), height)

    context.fillText(value, x, y)

    const image = document.createElement("img")
    image.src = canvas.toDataURL("image/png")
    image.alt = ""
    image.setAttribute("aria-hidden", "true")
    image.setAttribute("data-pdf-rasterized-svg-text", "true")
    image.className = `${svg.getAttribute("class") ?? ""} pdf-rasterized-svg-text`

    image.style.setProperty("display", "block", "important")
    image.style.setProperty("width", `${width}px`, "important")
    image.style.setProperty("height", `${height}px`, "important")
    image.style.setProperty("min-width", `${width}px`, "important")
    image.style.setProperty("min-height", `${height}px`, "important")
    image.style.setProperty("max-width", `${width}px`, "important")
    image.style.setProperty("max-height", `${height}px`, "important")
    image.style.setProperty("background", "transparent", "important")
    image.style.setProperty("object-fit", "contain", "important")
    image.style.setProperty("vertical-align", "top", "important")

    svg.replaceWith(image)
  })
}
/**
 * Prépare le clone de capture dans le repère natif du modèle.
 *
 * Le bulletin visible est construit dans un canvas logique de 1040 × 1345 px,
 * puis réduit par `transform: scale(0.725)`. Cette transformation peut produire
 * un décalage vertical des glyphes par rapport aux bordures pendant la
 * rasterisation Chromium/html2canvas.
 *
 * Le patch retire donc la transformation du `.page-content`, agrandit la page
 * et ses marges par l'inverse du facteur de réduction, puis laisse jsPDF réduire
 * l'image complète vers le format Letter. La géométrie finale reste identique,
 * mais aucun texte n'est capturé à l'intérieur d'un `transform: scale()`.
 */
function prepareUnscaledCaptureClone(
  sourceBulletin: HTMLElement,
  captureBulletin: HTMLElement,
  host: HTMLElement,
): CaptureGeometry {
  const templateScale = getTemplateScale(sourceBulletin)
  const paper = getRenderedPaperSize(sourceBulletin)

  const sourcePage = sourceBulletin.querySelector<HTMLElement>(".page")
  const capturePage = captureBulletin.querySelector<HTMLElement>(".page")
  const capturePageContent =
    captureBulletin.querySelector<HTMLElement>(".page-content")

  if (!capturePage || !capturePageContent) {
    throw new Error(
      "La structure du bulletin est incomplète : .page ou .page-content est absent.",
    )
  }

  const padding = getPagePadding(sourcePage)

  // La page entière doit être agrandie par 1 / scale afin que la réduction
  // effectuée ensuite par jsPDF restitue exactement le format 8.5 × 11 pouces.
  const cssWidth = paper.width / templateScale
  const cssHeight = paper.height / templateScale

  captureBulletin.classList.add("pdf-capture")
  captureBulletin.style.setProperty("width", `${cssWidth}px`, "important")
  captureBulletin.style.setProperty("min-width", `${cssWidth}px`, "important")
  captureBulletin.style.setProperty("max-width", `${cssWidth}px`, "important")
  captureBulletin.style.setProperty("height", `${cssHeight}px`, "important")
  captureBulletin.style.setProperty("min-height", `${cssHeight}px`, "important")
  captureBulletin.style.setProperty("max-height", `${cssHeight}px`, "important")
  captureBulletin.style.setProperty("margin", "0", "important")
  captureBulletin.style.setProperty("overflow", "hidden", "important")
  captureBulletin.style.setProperty("background", "#fff", "important")

  capturePage.style.setProperty("width", `${cssWidth}px`, "important")
  capturePage.style.setProperty("min-width", `${cssWidth}px`, "important")
  capturePage.style.setProperty("max-width", `${cssWidth}px`, "important")
  capturePage.style.setProperty("height", `${cssHeight}px`, "important")
  capturePage.style.setProperty("min-height", `${cssHeight}px`, "important")
  capturePage.style.setProperty("max-height", `${cssHeight}px`, "important")
  capturePage.style.setProperty("margin", "0", "important")
  capturePage.style.setProperty("overflow", "hidden", "important")
  capturePage.style.setProperty(
    "padding-top",
    `${padding.top / templateScale}px`,
    "important",
  )
  capturePage.style.setProperty(
    "padding-right",
    `${padding.right / templateScale}px`,
    "important",
  )
  capturePage.style.setProperty(
    "padding-bottom",
    `${padding.bottom / templateScale}px`,
    "important",
  )
  capturePage.style.setProperty(
    "padding-left",
    `${padding.left / templateScale}px`,
    "important",
  )

  capturePageContent.style.setProperty("transform", "none", "important")
  capturePageContent.style.setProperty(
    "transform-origin",
    "top left",
    "important",
  )

  host.style.setProperty("width", `${cssWidth}px`, "important")
  host.style.setProperty("height", `${cssHeight}px`, "important")
  host.style.setProperty("min-width", `${cssWidth}px`, "important")
  host.style.setProperty("min-height", `${cssHeight}px`, "important")
  host.style.setProperty("overflow", "hidden", "important")

  return { cssWidth, cssHeight, templateScale }
}

export function getBulletinCanvasOptions(
  target: HTMLElement,
  geometry?: Pick<CaptureGeometry, "cssWidth" | "cssHeight">,
) {
  const rect = target.getBoundingClientRect()
  const width = Math.ceil(geometry?.cssWidth ?? rect.width)
  const height = Math.ceil(geometry?.cssHeight ?? rect.height)

  return {
    scale: CAPTURE_SCALE,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: width,
    windowHeight: height,
    width,
    height,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    imageTimeout: 15_000,
    removeContainer: true,
  }
}

/**
 * Capture toujours un clone indépendant du bulletin.
 *
 * Cela évite :
 * - de modifier ou faire clignoter la prévisualisation affichée ;
 * - de capturer un élément placé dans un modal scrollé ;
 * - de conserver le `transform: scale()` responsable du décalage vertical.
 */
export async function captureBulletinElement(
  root: HTMLElement,
): Promise<BulletinCaptureResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("La génération PDF doit être exécutée dans le navigateur.")
  }

  const sourceBulletin = resolveBulletinElement(root)
  const captureBulletin = sourceBulletin.cloneNode(true) as HTMLElement
  const host = createBulletinPdfHost()

  host.appendChild(captureBulletin)
  document.body.appendChild(host)

  try {
    const geometry = prepareUnscaledCaptureClone(
      sourceBulletin,
      captureBulletin,
      host,
    )

await waitForBulletinPdfAssets(captureBulletin)
await waitForTwoFrames()

rasterizeBulletinInlineSvgText(captureBulletin)

await waitForBulletinPdfAssets(captureBulletin)
await waitForTwoFrames()

const html2canvas = (await import("html2canvas")).default
    const canvas = await html2canvas(
      captureBulletin,
      getBulletinCanvasOptions(captureBulletin, geometry),
    )

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("La capture du bulletin a produit un canvas vide.")
    }

    return {
      canvas,
      cssWidth: geometry.cssWidth,
      cssHeight: geometry.cssHeight,
      templateScale: geometry.templateScale,
    }
  } finally {
    host.remove()
  }
}

/**
 * Ajoute le canvas au PDF Letter sans nouvelle déformation non uniforme.
 */
export function addBulletinCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const ratio = Math.min(
    pageWidth / canvas.width,
    pageHeight / canvas.height,
  )

  const imageWidth = canvas.width * ratio
  const imageHeight = canvas.height * ratio
  const x = (pageWidth - imageWidth) / 2
  const y = (pageHeight - imageHeight) / 2

  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    x,
    y,
    imageWidth,
    imageHeight,
    undefined,
    "FAST",
  )
}
