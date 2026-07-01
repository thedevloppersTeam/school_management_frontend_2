export const LETTER_WIDTH_MM = 215.9
export const LETTER_HEIGHT_MM = 279.4

export function createBulletinPdfHost(): HTMLDivElement {
  const host = document.createElement("div")
  host.setAttribute("data-bulletin-pdf-host", "true")
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:8.5in",
    "min-height:11in",
    "overflow:visible",
    "background:#fff",
    "pointer-events:none",
    "z-index:-2147483648",
  ].join(";")
  return host
}

export function prepareBulletinPdfNode(root: HTMLElement): HTMLElement {
  root.style.width = "8.5in"
  root.style.minHeight = "11in"
  root.style.height = "auto"
  root.style.maxHeight = "none"
  root.style.overflow = "visible"
  root.style.backgroundColor = "#fff"

  const bulletin = root.querySelector<HTMLElement>(".btpl") ?? root
  bulletin.classList.add("pdf-capture")
  bulletin.style.width = "8.5in"
  bulletin.style.minHeight = "11in"
  bulletin.style.height = "11in"
  bulletin.style.maxHeight = "none"
  bulletin.style.overflow = "visible"

  return bulletin
}

export async function waitForBulletinPdfAssets(root: HTMLElement): Promise<void> {
  await document.fonts?.ready

  const images = Array.from(root.querySelectorAll("img"))
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) return
      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined)
        return
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true })
        image.addEventListener("error", () => resolve(), { once: true })
      })
    }),
  )
}

export function getBulletinCanvasOptions(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  return {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: Math.ceil(rect.width),
    windowHeight: Math.ceil(rect.height),
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
    scrollX: 0,
    scrollY: 0,
  }
}
