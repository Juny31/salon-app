import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LinearGradient, defs,
} from 'recharts'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' FCFA'
const fmtShort = (n) => {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return Math.round(n)
}

const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function StarRating({ value = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          fontSize: '12px',
          color: i <= Math.round(value) ? '#f59e0b' : 'rgba(255,255,255,0.15)',
        }}>★</span>
      ))}
      <span style={{ fontSize: '11px', color: 'var(--text-3)', marginLeft: '4px' }}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(22,22,22,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#ff5533' }}>
        {fmt(payload[0].value)}
      </div>
    </div>
  )
}

export default function Dashboard({ session, setCurrentPage }) {
  const [stats, setStats] = useState({ caToday: 0, clientsToday: 0, caMonth: 0, caLastMonth: 0, clientsMonth: 0, clientsLastMonth: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [topClients, setTopClients] = useState([])
  const [barData, setBarData] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const uid = session.user.id

    const [
      { data: todayV },
      { data: monthV },
      { data: lastMonthV },
      { data: allClients },
      { data: recent },
      { data: yearV },
      { data: aboVisits },
    ] = await Promise.all([
      supabase.from('salon_visits').select('total').eq('user_id', uid).eq('visit_date', today),
      supabase.from('salon_visits').select('id, total, client_id').eq('user_id', uid).gte('visit_date', monthStart),
      supabase.from('salon_visits').select('total').eq('user_id', uid).gte('visit_date', lastMonthStart).lte('visit_date', lastMonthEnd),
      supabase.from('salon_clients').select('id, name').eq('user_id', uid),
      supabase.from('salon_visits').select('id, visit_date, total, payment_method, salon_clients(name)').eq('user_id', uid).order('visit_date', { ascending: false }).limit(5),
      supabase.from('salon_visits').select('visit_date, total').eq('user_id', uid).gte('visit_date', `${now.getFullYear()}-01-01`),
      supabase.from('salon_visit_services').select('visit_id, service_name').in('service_name', ['Standard','Premium','VIP']),
    ])

    const caToday    = (todayV || []).reduce((s, v) => s + parseFloat(v.total), 0)
    const caMonth    = (monthV || []).reduce((s, v) => s + parseFloat(v.total), 0)
    const caLastMonth = (lastMonthV || []).reduce((s, v) => s + parseFloat(v.total), 0)
    const clientsMonth = new Set((monthV || []).filter(v => v.client_id).map(v => v.client_id)).size
    const clientsLastMonth = (lastMonthV || []).length

    // Bar chart par mois
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ name: MONTHS_SHORT[i], ca: 0 }))
    for (const v of (yearV || [])) {
      const m = parseInt(v.visit_date.slice(5, 7)) - 1
      byMonth[m].ca += parseFloat(v.total)
    }

    // Top clients du mois
    const clientCA = {}
    for (const v of (monthV || [])) {
      if (v.client_id) clientCA[v.client_id] = (clientCA[v.client_id] || 0) + parseFloat(v.total)
    }
    const topList = Object.entries(clientCA)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, ca]) => ({
        id,
        name: (allClients || []).find(c => c.id === id)?.name || 'Client',
        ca,
        visits: (monthV || []).filter(v => v.client_id === id).length,
      }))

    // Abonnements du mois (visites qui ont un service Standard/Premium/VIP)
    const monthVisitIds = new Set((monthV || []).map(v => v.id).filter(Boolean))
    const abosMonth = (aboVisits || []).filter(a => monthVisitIds.has(a.visit_id)).length

    setStats({ caToday, clientsToday: (todayV || []).length, caMonth, caLastMonth, clientsMonth, clientsLastMonth, abosMonth })
    setRecentVisits(recent || [])
    setTopClients(topList)
    setBarData(byMonth)
    setLoading(false)
  }

  const trend = (current, previous) => {
    if (!previous) return null
    const pct = Math.round(((current - previous) / previous) * 100)
    return { pct, up: pct >= 0 }
  }

  const caMonthTrend = trend(stats.caMonth, stats.caLastMonth)
  const clientsTrend = trend(stats.clientsMonth, stats.clientsLastMonth)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="loading-spinner"><div className="spinner" /><span>Chargement…</span></div>
    </div>
  )

  const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{monthName}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCurrentPage('caisse')}>
          + Nouvelle vente
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="stats-grid">

        {/* Total clients */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">👤</div>
            <span className="stat-label">Total Clients</span>
          </div>
          <div className="stat-value">{stats.clientsMonth}</div>
          <div className="stat-trend">
            <span className="stat-trend-label">vs mois dernier</span>
            {clientsTrend && (
              <span className={`trend-chip ${clientsTrend.up ? 'up' : 'down'}`}>
                {clientsTrend.up ? '↑' : '↓'} {Math.abs(clientsTrend.pct)}%
              </span>
            )}
          </div>
        </div>

        {/* CA mois */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">💰</div>
            <span className="stat-label">CA du mois</span>
          </div>
          <div className="stat-value" style={{ fontSize: '28px' }}>{fmt(stats.caMonth)}</div>
          <div className="stat-trend">
            <span className="stat-trend-label">vs mois dernier</span>
            {caMonthTrend && (
              <span className={`trend-chip ${caMonthTrend.up ? 'up' : 'down'}`}>
                {caMonthTrend.up ? '↑' : '↓'} {Math.abs(caMonthTrend.pct)}%
              </span>
            )}
          </div>
        </div>

        {/* CA aujourd'hui */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">📅</div>
            <span className="stat-label">Aujourd'hui</span>
          </div>
          <div className="stat-value" style={{ fontSize: '28px' }}>{fmt(stats.caToday)}</div>
          <div className="stat-trend">
            <span className="stat-trend-label">{stats.clientsToday} client{stats.clientsToday > 1 ? 's' : ''} servi{stats.clientsToday > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Abonnements */}
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">👑</div>
            <span className="stat-label">Abonnements</span>
          </div>
          <div className="stat-value">{stats.abosMonth || 0}</div>
          <div className="stat-trend">
            <span className="stat-trend-label">ce mois</span>
            {stats.abosMonth > 0 && <span className="trend-chip up">actif</span>}
          </div>
        </div>
      </div>

      {/* ── Dashboard Grid ── */}
      <div className="dashboard-grid">

        {/* Left — Revenue chart */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Chiffre d'affaires</div>
              <div className="card-subtitle">Revenus mensuels {now.getFullYear()}</div>
            </div>
            <div className="period-filter">
              {['month', '6month', 'year'].map(p => (
                <button key={p} className={`period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                  {p === 'month' ? 'Mois' : p === '6month' ? '6 Mois' : 'Année'}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#ff5533" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8b1a00" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="ca" fill="url(#barGrad)" radius={[6, 6, 3, 3]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right — Top clients */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Top Clients</div>
            <div className="period-filter">
              <button className="period-btn active">Mois</button>
            </div>
          </div>

          {topClients.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px', opacity: 0.3 }}>👤</div>
              <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Aucune donnée ce mois</p>
              <button className="btn btn-primary" style={{ marginTop: '14px', fontSize: '13px' }} onClick={() => setCurrentPage('caisse')}>
                + Nouvelle vente
              </button>
            </div>
          ) : (
            <div className="person-list">
              {topClients.map((c, i) => (
                <div key={c.id} className="person-item">
                  <div className="person-avatar">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="person-info">
                    <div className="person-name">{c.name}</div>
                    <div style={{ marginTop: '4px' }}>
                      <StarRating value={Math.min(5, 3.5 + (c.visits * 0.3))} />
                    </div>
                  </div>
                  <div className="person-count-badge">
                    {c.visits} <span>visite{c.visits > 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Dernières ventes ── */}
      {recentVisits.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="card-header">
            <div className="card-title">Dernières ventes</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentPage('caisse')}>Tout voir →</button>
          </div>
          <div className="transaction-list">
            {recentVisits.map(v => (
              <div key={v.id} className="transaction-item">
                <div className="transaction-category-icon" style={{ background: 'rgba(232,57,29,0.08)', borderColor: 'rgba(232,57,29,0.12)' }}>
                  ✂️
                </div>
                <div className="transaction-details">
                  <span className="transaction-desc">{v.salon_clients?.name || 'Client de passage'}</span>
                  <div className="transaction-meta">
                    <span className="transaction-date">
                      {new Date(v.visit_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {v.payment_method === 'especes' ? '💵 Espèces' : v.payment_method === 'carte' ? '💳 Carte' : '🏦 Virement'}
                    </span>
                  </div>
                </div>
                <span className="transaction-amount income">+{fmt(v.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn-add-mobile" onClick={() => setCurrentPage('caisse')} aria-label="Nouvelle vente">+</button>
    </div>
  )
}
