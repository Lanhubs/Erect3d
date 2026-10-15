import { createHmac,timingSafeEqual } from 'node:crypto'
import { ApiError } from '../security/errors'
export class ArchiveTickets {
  constructor(private secret:string) {}
  private sign(payload:string) {return createHmac('sha256',this.secret).update(`erect-source-download:${payload}`).digest('base64url')}
  download(key:string) {
    const payload=Buffer.from(JSON.stringify({key,expires:Date.now()+120000})).toString('base64url')
    return `/private-assets/archive/${payload}.${this.sign(payload)}`
  }
  verify(token:string) {
    const [payload,signature,extra]=token.split('.'),expected=Buffer.from(this.sign(payload || '')),actual=Buffer.from(signature || '')
    const fail=()=>new ApiError(403,'ASSET_TICKET_INVALID','Private source ticket is invalid or expired')
    if (token.length>2048 || extra || actual.length!==expected.length || !timingSafeEqual(actual,expected))throw fail()
    let ticket:{key:string;expires:number}
    try {ticket=JSON.parse(Buffer.from(payload,'base64url').toString())}catch{throw fail()}
    if(!Number.isFinite(ticket.expires) || ticket.expires<Date.now() || !/^private\/[a-zA-Z0-9_./-]+\.zip$/.test(ticket.key) || ticket.key.split('/').some(part=>!part || part==='.' || part==='..'))throw fail()
    return ticket.key
  }
}
