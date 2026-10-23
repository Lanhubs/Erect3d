export const token = () =>
  crypto.getRandomValues(new Uint8Array(32)).toBase64({ alphabet: 'base64url', omitPadding: true })
export const digest = (value: string) => new Bun.CryptoHasher('sha256').update(value).digest('hex')
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    )
  return value
}
export const checksum = (value: unknown) => digest(JSON.stringify(canonical(value)))
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
