export class ProposalError extends Error {
  status: 409 | 422; code: string
  constructor(status: 409 | 422, code: string, message: string) {
    super(message); this.status = status; this.code = code
  }
}
