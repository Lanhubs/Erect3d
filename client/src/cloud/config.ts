// Projects always use the backend; IndexedDB is their offline working cache.
export const cloudEnabled = true
export const registrationEnabled =
  import.meta.env?.VITE_PUBLIC_REGISTRATION === 'true' || Boolean(import.meta.env?.DEV)
