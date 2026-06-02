import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Caisse from './components/Caisse'
import Clients from './components/Clients'
import Stock from './components/Stock'
import Reports from './components/Reports'
import Services from './components/Services'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner">
        <div className="spinner"></div>
        <span>Chargement…</span>
      </div>
    </div>
  )

  if (!session) return <Auth />

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage} session={session}>
      {currentPage === 'dashboard' && <Dashboard session={session} setCurrentPage={setCurrentPage} />}
      {currentPage === 'caisse'    && <Caisse session={session} />}
      {currentPage === 'clients'   && <Clients session={session} />}
      {currentPage === 'stock'     && <Stock session={session} />}
      {currentPage === 'reports'   && <Reports session={session} />}
      {currentPage === 'services'  && <Services session={session} />}
    </Layout>
  )
}
