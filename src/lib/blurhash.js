import { encode } from 'blurhash'

// Decode via an HTMLImageElement — unlike createImageBitmap(), this handles SVG
// as well as every raster format. `forcedSize` gives SVGs (which often have no
// intrinsic pixel size) a concrete size to render at.
function loadImage(url, forcedSize) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    if (forcedSize) {
      img.width = forcedSize
      img.height = forcedSize
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The source image could not be decoded.'))
    img.src = url
  })
}

/**
 * Generate a BlurHash string from raw image bytes (raster or SVG).
 * @param {ArrayBuffer|Blob} bytes
 * @param {string} [mimeType]
 * @returns {Promise<{blurhash:string, width:number, height:number}>}
 */
export async function generateBlurhash(bytes, mimeType) {
  const type = mimeType || (bytes instanceof Blob ? bytes.type : '') || ''
  const isSvg = /svg/i.test(type)
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type })
  const url = URL.createObjectURL(blob)

  try {
    const img = await loadImage(url, isSvg ? 512 : 0)

    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    // SVGs may report no intrinsic size — fall back to a square default.
    if (!width || !height) {
      width = 512
      height = 512
    }

    // Downsample: keep the longest edge at <= 64px for encoding.
    const maxEdge = 64
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    // White backdrop so transparent areas (SVG/PNG) don't encode as black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const imageData = ctx.getImageData(0, 0, w, h)

    // Component counts scaled to aspect ratio (blurhash allows 1..9 each).
    const compX = w >= h ? 4 : 3
    const compY = h > w ? 4 : 3

    const blurhash = encode(imageData.data, w, h, compX, compY)
    return { blurhash, width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}
