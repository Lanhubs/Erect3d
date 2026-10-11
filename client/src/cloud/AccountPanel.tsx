import { useState } from 'react'
import { refreshAccount, signIn, signOut, useAccount } from './account'
import { registrationEnabled } from './config'
export function AccountPanel() {
  const { user, checking, error: sessionError } = useAccount()
  const [register, setRegister] = useState(false), [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await action(); setPassword('') } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  if (user) return <div className="cloud-account"><span>{user.name} · {user.email}</span>
    <button disabled={busy} onClick={() => void submit(signOut)}>Sign out</button>{error && <p role="alert">{error}</p>}</div>
  return <section className="cloud-signin" aria-label="Cloud account">
    <h2>{register ? 'Create a cloud account' : 'Sign in to cloud projects'}</h2>
    <p>Local projects stay on this device. Cloud projects use your private account and save revisions on the server.</p>
    {checking ? <p role="status">Checking your session…</p> : <form onSubmit={event => {
      event.preventDefault(); void submit(() => signIn(email, password, register ? name : undefined))
    }}>
      {register && <label>Name<input required autoComplete="name" value={name} maxLength={200} onChange={e => setName(e.target.value)} /></label>}
      <label>Email<input required type="email" autoComplete="username" value={email} maxLength={254} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input required type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={12} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      {registrationEnabled && <button type="button" disabled={busy} onClick={() => setRegister(value => !value)}>{register ? 'Use existing account' : 'Create account'}</button>}
    </form>}
    {(error || sessionError) && <p role="alert">{error || sessionError} <button onClick={() => void refreshAccount()}>Retry session</button></p>}
  </section>
}
