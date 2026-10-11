import type { Actor } from '../modules/auth/session'
export type ApiEnv = { Variables: { actor: Actor; requestId: string } }
