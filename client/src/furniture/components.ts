export type SymbolComponent = { x: number; y: number; width: number; height: number; count: number; pixels: number[]; children?: SymbolComponent[] }
// Bounded connected-component extraction; annotations and enormous residual networks are discarded.
export function symbolComponents(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length), queue = new Int32Array(mask.length), components: SymbolComponent[] = []
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) continue
    let read = 0, write = 1, minX = width, maxX = 0, minY = height, maxY = 0
    queue[0] = index; visited[index] = 1
    const pixels: number[] = []
    while (read < write) {
      const pixel = queue[read++], x = pixel % width, y = Math.floor(pixel / width)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      if (pixels.length < 16000) pixels.push(pixel)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue
        const next = pixel + dy * width + dx
        if (mask[next] && !visited[next]) { visited[next] = 1; queue[write++] = next }
      }
    }
    if (write >= 12 && write < 16000 && maxX - minX >= 5 && maxY - minY >= 5 && components.length < 2000)
      components.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count: write, pixels })
  }
  return components
}
export function nestedSymbols(components: SymbolComponent[]) {
  const children = new Map<SymbolComponent, SymbolComponent[]>(), consumed = new Set<SymbolComponent>()
  for (const child of components) {
    const parent = components.filter(outer => outer !== child && outer.x < child.x && outer.y < child.y
      && outer.x + outer.width > child.x + child.width && outer.y + outer.height > child.y + child.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0]
    if (parent) { const list = children.get(parent) || []; list.push(child); children.set(parent, list); consumed.add(child) }
  }
  const collect = (c: SymbolComponent, depth = 0): SymbolComponent => { const inner = depth < 16 ? (children.get(c) || []).map(child => collect(child, depth + 1)) : []
    return { ...c, children: inner, pixels: [...c.pixels, ...inner.flatMap(i => i.pixels)].slice(0, 16000), count: c.count + inner.reduce((s, i) => s + i.count, 0) } }
  return components.filter(c => !consumed.has(c)).map(collect)
}
