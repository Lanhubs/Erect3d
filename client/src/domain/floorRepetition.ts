// Allocation safety, not an architectural storey limit. The geometry compiler
// also checks actual instance multiplicity before allocating GPU matrices.
export const maxFloorInstances = 2_000_000
export const floorsPerRenderPage = 64
export function floorPages(indices: number[]) {
  const pages: number[][] = []
  for (const index of indices) {
    const bucket = Math.floor(index / floorsPerRenderPage)
    const previous = pages.at(-1)
    if (previous && Math.floor(previous[0] / floorsPerRenderPage) === bucket) previous.push(index)
    else pages.push([index])
  }
  return pages
}
