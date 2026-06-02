import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)

export default function Dashboard({ session, setCurrentPage }) {
  const [stats, setStats] = useState({ caToday: 0, clientsToday: 0, caMonth: 0, lowStock: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [lowStockItems, setLowStockItems] = useState([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const uid = session.user.id

    const [{ data: todayVisits }, { data: monthVisits }, { data: products }, { data: recent }] =
      await Promise.all([
        supabase.from('salon_visits').select('total').eq('user_id', uid).eq('visit_date', today),
        supabase.from('salon_visits').select('total').eq('user_id', uid).gte('visit_date', monthStart),
        supabase.from('salon_products').select('id, name, stock_quantity, min_stock, unit').eq('user_id', uid),
        supabase.from('salon_visits')
          .select('id, visit_date, total, payment_method, salon_clients(name)')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

    const caToday = (todayVisits || []).reduce((s, v) => s + parseFloat(v.total), 0)
    const caMonth = (monthVisits || []).reduce((s, v) => s + parseFloat(v.total), 0)
    const low = (products || []).filter(p => p.stock_quantity <= p.min_stock)

    setStats({ caToday, clientsToday: (todayVisits || []).length, caMonth, lowStock: low.length })
    setRecentVisits(recent || [])
    setLowStockItems(low.slice(0, 4))
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="loading-spinner"><div className="spinner" /><span>Chargement…</span></div>
    </div>
  )

  const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="dashboard">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">{monthName}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCurrentPage('caisse')}>
          + Nouvelle vente
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#D1FAE5' }}>💰</div>
          <div className="stat-info">
            <span className="stat-label">CA aujourd'hui</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>{fmt(stats.caToday)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#EEF2FF' }}>👤</div>
          <div className="stat-info">
            <span className="stat-label">Clients aujourd'hui</span>
            <span className="stat-value">{stats.clientsToday}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#FEF3C7' }}>📅</div>
          <div className="stat-info">
            <span className="stat-label">CA du mois</span>
            <span className="stat-value">{fmt(stats.caMonth)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: stats.lowStock > 0 ? '#FEE2E2' : '#D1FAE5' }}>
            {stats.lowStock > 0 ? '⚠️' : '📦'}
          </div>
          <div className="stat-info">
            <span className="stat-label">Produits en rupture</span>
            <span className="stat-value" style={{ color: stats.lowStock > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {stats.lowStock}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Dernières ventes */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Dernières ventes</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage('caisse')}>Voir tout →</button>
          </div>
          {recentVisits.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div style={{ fontSize: '32px' }}>💰</div>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Aucune vente enregistrée</p>
              <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => setCurrentPage('caisse')}>
                + Nouvelle vente
              </button>
            </div>
          ) : (
            <div className="transaction-list">
              {recentVisits.map(v => (
                <div key={v.id} className="transaction-item">
                  <div className="transaction-category-icon" style={{ background: '#D1FAE522', borderColor: '#D1FAE533' }}>
                    👤
                  </div>
                  <div className="transaction-details">
                    <span className="transaction-desc">{v.salon_clients?.name || 'Client passage'}</span>
                    <div className="transaction-meta">
                      <span className="transaction-date">
                        {new Date(v.visit_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {v.payment_method === 'especes' ? '💵 Espèces' : v.payment_method === 'carte' ? '💳 Carte' : '🏦 Virement'}
                      </span>
                    </div>
                  </div>
                  <span className="transaction-amount income">+{fmt(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertes stock */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚠️ Stock faible</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage('stock')}>Gérer →</button>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div style={{ fontSize: '32px' }}>✅</div>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Tous les stocks sont OK</p>
            </div>
          ) : (
            <div className="transaction-list">
              {lowStockItems.map(p => (
                <div key={p.id} className="transaction-item">
                  <div className="transaction-category-icon" style={{ background: '#FEE2E222', borderColor: '#FEE2E233' }}>
                    📦
                  </div>
                  <div className="transaction-details">
                    <span className="transaction-desc">{p.name}</span>
                    <div className="transaction-meta">
                      <span style={{ color: 'var(--danger)', fontSize: '12px' }}>
                        Stock: {p.stock_quantity} {p.unit} (min: {p.min_stock})
                      </span>
                    </div>
                  </div>
                  <span className="transaction-amount expense">⚠️</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button className="btn-add-mobile" onClick={() => setCurrentPage('caisse')} aria-label="Nouvelle vente">+</button>
    </div>
  )
}
