export function pointerCursor(active: boolean) {
  const canvas = document.querySelector<HTMLCanvasElement>('.viewer canvas')
  if (canvas) canvas.style.cursor = active ? 'pointer' : ''
}
