import { detectFurniture, type FurnitureJob } from './detection'
self.onmessage = (event: MessageEvent<FurnitureJob>) => {
  try {
    self.postMessage({ candidates: detectFurniture(event.data) })
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : 'Furniture analysis failed' })
  }
}
