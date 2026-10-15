import {arenaCanopyBuffers,type CanopyParameters} from '../geometry/arenaCanopyBuffers'
self.onmessage=(event:MessageEvent<CanopyParameters>)=>{
  const buffers=arenaCanopyBuffers(event.data)
  self.postMessage(buffers,{transfer:[buffers.positions.buffer,buffers.uvs.buffer,buffers.normals.buffer,buffers.indices.buffer]})
}
