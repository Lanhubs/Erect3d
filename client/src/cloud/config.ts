export const cloudEnabled = import.meta.env?.VITE_ENABLE_CLOUD === 'true' || Boolean(import.meta.env?.DEV)
export const registrationEnabled = import.meta.env?.VITE_PUBLIC_REGISTRATION === 'true' || Boolean(import.meta.env?.DEV)
