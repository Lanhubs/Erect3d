import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { ApiError } from '../security/errors'
const invalid=()=>new ApiError(422,'INVALID_ARCHIVE','Private source archive is invalid')
function crc32(bytes:Uint8Array) {
  let crc=0xffffffff
  for (const byte of bytes) {crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  return (crc^0xffffffff)>>>0
}
// One fixed-name entry: no extraction paths, external tools, metadata removal or image encoding.
export function zipSource(bytes:Uint8Array):Uint8Array {
  const compressed=deflateRawSync(bytes,{level:9}),name=Buffer.from('source'),crc=crc32(bytes)
  const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22)
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8)
  local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26)
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10)
  central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28)
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10)
  end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+compressed.length,16)
  return new Uint8Array(Buffer.concat([local,name,compressed,central,name,end]))
}
export function unpackSource(key:string,bytes:Uint8Array,maximum:number):Uint8Array<ArrayBuffer> {
  if (!key.endsWith('.zip')) {if(bytes.length>maximum)throw new ApiError(413,'ASSET_TOO_LARGE','Object exceeded its permitted size');return new Uint8Array(bytes)}
  const data=Buffer.from(bytes)
  if(data.length<110 || data.readUInt32LE(0)!==0x04034b50 || data.readUInt16LE(6)!==0 || data.readUInt16LE(8)!==8 || data.readUInt16LE(26)!==6 || data.readUInt16LE(28)!==0 || data.subarray(30,36).toString()!=='source')throw invalid()
  const size=data.readUInt32LE(22),compressed=data.readUInt32LE(18),offset=36+compressed
  if(size>maximum)throw new ApiError(413,'ASSET_TOO_LARGE','Unpacked source exceeded its permitted size')
  if(offset+74!==data.length || data.readUInt32LE(offset)!==0x02014b50 || data.readUInt32LE(data.length-22)!==0x06054b50 || data.readUInt16LE(data.length-12)!==1)throw invalid()
  let original:Buffer
  try {original=inflateRawSync(data.subarray(36,offset),{maxOutputLength:Math.max(1,size)})}catch{throw invalid()}
  if(original.length!==size || crc32(original)!==data.readUInt32LE(14))throw invalid()
  return new Uint8Array(original)
}
