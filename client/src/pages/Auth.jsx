import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function Auth({ mode, onSession }) {
  const navigate = useNavigate()
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    zoneCode: 'GT',
    skillCode: 'basic_life_support',
  })

  useEffect(() => {
    api('/api/meta').then(setMeta).catch(() => {})
  }, [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const result = await api(path, { method: 'POST', body: JSON.stringify(form) })
      onSession({ token: result.token, user: result.user })
      navigate(result.user.role === 'admin' ? '/admin' : '/responder')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="split">
      <form className="card" onSubmit={submit}>
        <p className="eyebrow">{mode === 'login' ? 'Registered users' : 'Responder registration'}</p>
        <h1>{mode === 'login' ? 'Sign in' : 'Create a responder account'}</h1>
        {error && <p className="error">{error}</p>}
        <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></label>
        <label>Password<input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={mode === 'register' ? 8 : 1} /></label>
        {mode === 'register' && (
          <>
            <label>Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} required /></label>
            <label>
              Base zone
              <select value={form.zoneCode} onChange={(event) => update('zoneCode', event.target.value)}>
                {meta?.zones?.map((zone) => <option key={zone.code} value={zone.code}>{zone.name}</option>)}
              </select>
            </label>
            <label>
              Skill to submit for review
              <select value={form.skillCode} onChange={(event) => update('skillCode', event.target.value)}>
                {meta?.skills?.map((skill) => <option key={skill.code} value={skill.code}>{skill.name}</option>)}
              </select>
            </label>
          </>
        )}
        <button className="primary" type="submit">{mode === 'login' ? 'Sign in' : 'Register'}</button>
        <p>{mode === 'login' ? <Link to="/register">Register as a responder</Link> : <Link to="/login">Already registered</Link>}</p>
      </form>
      <aside className="card">
        <h2>Demo accounts</h2>
        <p>Admin: admin@civicare.demo / CiviCare#Admin1</p>
        <p>Responder: gt01@civicare.demo / Responder#1</p>
        <p>Guest reports do not need an account. A submitted certificate stays pending until an admin reviews it.</p>
      </aside>
    </section>
  )
}
