/**
 * Image input. Uploaded files are decoded with EXIF orientation applied
 * (`imageOrientation: 'from-image'`) so phone photos load upright, then normalised
 * to an orientation-baked data URL. That keeps the render source, the cropper and
 * the embedded JSON all in one coordinate space (crop rectangles stay valid).
 */
import type { SourceMeta } from '../core/document'
import type { RenderSource } from '../core/renderer'

export interface LoadedImage {
  bitmap: RenderSource
  meta: SourceMeta
  dataUrl: string
}

function drawableToDataUrl(source: CanvasImageSource, w: number, h: number, mime: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.drawImage(source, 0, 0)
  const type = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  return canvas.toDataURL(type, 0.92)
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPEG, WebP…).')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('That file could not be decoded as an image.')
  }
  const dataUrl = drawableToDataUrl(bitmap, bitmap.width, bitmap.height, file.type)
  return {
    bitmap,
    dataUrl,
    meta: { name: file.name, width: bitmap.width, height: bitmap.height, type: file.type },
  }
}

/** Extract the MIME type from a data URL, tolerating both `data:mime;base64,…` and the
 *  comma-terminated `data:mime,…` form (a hand-authored embeddedSource may use either). */
function dataUrlMime(dataUrl: string): string {
  return /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'image/png'
}

/** Rebuild a render source from an embedded/loaded data URL (used when replaying a JSON document). */
export function loadImageFromDataUrl(dataUrl: string, name = 'image'): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({
        bitmap: img,
        dataUrl,
        meta: {
          name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          type: dataUrlMime(dataUrl),
        },
      })
    img.onerror = () => reject(new Error('Embedded image could not be loaded.'))
    img.src = dataUrl
  })
}

/** Open the OS file picker and resolve with the chosen file (or null if cancelled). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export const pickImageFile = (): Promise<File | null> => pickFile('image/*')
export const pickJsonFile = (): Promise<File | null> => pickFile('application/json,.json')

/**
 * A colourful procedural sample so the editor can be tried without a file: gradient
 * sky, sun, hills, a hue strip, a greyscale ramp and a skin-tone patch — enough
 * variety to see brightness/contrast/saturation and the greyscale/sepia filters.
 */
export function createSampleImage(): LoadedImage {
  const width = 1280
  const height = 853
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.75)
  sky.addColorStop(0, '#16307a')
  sky.addColorStop(0.6, '#3b82f6')
  sky.addColorStop(1, '#f59e0b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  const sun = ctx.createRadialGradient(
    width * 0.74,
    height * 0.3,
    8,
    width * 0.74,
    height * 0.3,
    170,
  )
  sun.addColorStop(0, '#fffbeb')
  sun.addColorStop(0.4, '#fde68a')
  sun.addColorStop(1, 'rgba(253,224,71,0)')
  ctx.fillStyle = sun
  ctx.beginPath()
  ctx.arc(width * 0.74, height * 0.3, 170, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#e8b48c'
  ctx.beginPath()
  ctx.arc(width * 0.2, height * 0.34, 74, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#166534'
  ctx.beginPath()
  ctx.moveTo(0, height * 0.72)
  ctx.quadraticCurveTo(width * 0.3, height * 0.6, width * 0.55, height * 0.72)
  ctx.quadraticCurveTo(width * 0.8, height * 0.85, width, height * 0.7)
  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#14532d'
  ctx.beginPath()
  ctx.moveTo(0, height * 0.83)
  ctx.quadraticCurveTo(width * 0.35, height * 0.72, width * 0.7, height * 0.86)
  ctx.quadraticCurveTo(width * 0.9, height * 0.93, width, height * 0.87)
  ctx.lineTo(width, height)
  ctx.lineTo(0, height)
  ctx.closePath()
  ctx.fill()

  const hues = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899']
  hues.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.fillRect(40 + i * 48, height - 96, 42, 54)
  })

  for (let i = 0; i < 8; i++) {
    const v = Math.round((255 * i) / 7)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(width - 40 - (8 - i) * 42, height - 96, 42, 54)
  }

  return {
    bitmap: canvas,
    dataUrl: canvas.toDataURL('image/png'),
    meta: { name: 'sample.png', width, height, type: 'image/png' },
  }
}
