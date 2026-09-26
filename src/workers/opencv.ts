import cvModule from '@techstark/opencv-js'

let ready: Promise<typeof cvModule> | undefined

function openCV() {
  ready ??= (async () => {
    const cv = await cvModule
    if (!cv.Mat) await new Promise<void>(resolve => { cv.onRuntimeInitialized = resolve })
    return cv
  })()
  return ready
}

export async function preparePlan(pixels: Uint8ClampedArray, width: number, height: number) {
  const cv = await openCV()
  const rgba = new cv.Mat(height, width, cv.CV_8UC4)
  const gray = new cv.Mat(), smooth = new cv.Mat(), binary = new cv.Mat(), fine = new cv.Mat()
  try {
    rgba.data.set(pixels)
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
    cv.threshold(gray, fine, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU)
    if (Math.min(width, height) >= 300) cv.medianBlur(gray, smooth, 3)
    cv.threshold(Math.min(width, height) >= 300 ? smooth : gray, binary, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU)
    return { structural: Uint8Array.from(binary.data, value => value > 0 ? 1 : 0),
      fine: Uint8Array.from(fine.data, value => value > 0 ? 1 : 0) }
  } finally {
    rgba.delete(); gray.delete(); smooth.delete(); binary.delete(); fine.delete()
  }
}
