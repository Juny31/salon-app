import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    else if (isSignUp) setMessage('Compte créé ! Vérifiez vos emails.')
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">✂️</div>
        <h1 className="auth-title">SalonApp</h1>
        <p className="auth-subtitle">Gestion de salon de coiffure</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <input className="form-input" type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          <input className="form-input" type="password" placeholder="Mot de passe" value={password}
            onChange={e => setPassword(e.target.value)} required />
          {message && <div className="auth-message">{message}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? '…' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: '8px' }}
          onClick={() => setIsSignUp(v => !v)}>
          {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
        </button>
      </div>
    </div>
  )
}
