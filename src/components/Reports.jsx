import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc']
const COLORS = ['#6366F1','#F97316','#10B981','#F59E0B','#EF4444','#8B5CF6','#14B8A6','#EC4899']

export default function Reports({ session }) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [visits, setVisits] = useState([])
  const [barData, setBarData] = useState([])
  const [loading, setLoading] = useState(true)
  const uid = session.user.id
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  useEffect(() => { loadReport() }, [selectedMonth, selectedYear])

  const loadReport = async () => {
    setLoading(true)
    const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const end = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

    const [{ data: monthVisits }, { data: yearVisits }] = await Promise.all([
      supabase.from('salon_visits')
        .select('*, salon_clients(name), salon_visit_services(service_name, price, quantity)')
        .eq('user_id', uid).gte('visit_date', start).lte('visit_date', end),
      supabase.from('salon_visits')
        .select('visit_date, total')
        .eq('user_id', uid)
        .gte('visit_date', `${selectedYear}-01-01`)
        .lte('visit_date', `${selectedYear}-12-31`),
    ])

    setVisits(monthVisits || [])

    // Bar chart par mois
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ name: MONTHS_SHORT[i], ca: 0, visits: 0 }))
    for (const v of (yearVisits || [])) {
      const m = parseInt(v.visit_date.slice(5, 7)) - 1
      byMonth[m].ca += parseFloat(v.total)
      byMonth[m].visits += 1
    }
    setBarData(byMonth)
    setLoading(false)
  }

  const totalCA = visits.reduce((s, v) => s + parseFloat(v.total), 0)
  const avgBasket = visits.length ? totalCA / visits.length : 0

  // Top services
  const serviceCount = {}
  const serviceCA = {}
  for (const v of visits) {
    for (const s of (v.salon_visit_services || [])) {
      serviceCount[s.service_name] = (serviceCount[s.service_name] || 0) + s.quantity
      serviceCA[s.service_name] = (serviceCA[s.service_name] || 0) + s.price * s.quantity
    }
  }
  const topServices = Object.entries(serviceCA)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, ca]) => ({ name, ca, count: serviceCount[name] }))

  // Top clients
  const clientCA = {}
  const clientCount = {}
  for (const v of visits) {
    const name = v.salon_clients?.name || 'Passage'
    clientCA[name] = (clientCA[name] || 0) + parseFloat(v.total)
    clientCount[name] = (clientCount[name] || 0) + 1
  }
  const topClients = Object.entries(clientCA)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="loading-spinner"><div className="spinner" /><span>Chargement…</span></div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rapports</h1>
        <p className="page-subtitle">Analyse de votre activité</p>
      </div>

      <div className="transactions-controls">
        <div className="month-selector">
          <span style={{ fontSize: '13px', color: '#6B7280' }}>📅</span>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
            {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#D1FAE5' }}>💰</div>
          <div className="stat-info">
            <span className="stat-label">CA du mois</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>{fmt(totalCA)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#EEF2FF' }}>👤</div>
          <div className="stat-info">
            <span className="stat-label">Clients servis</span>
            <span className="stat-value">{visits.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#FEF3C7' }}>📊</div>
          <div className="stat-info">
            <span className="stat-label">Panier moyen</span>
            <span className="stat-value">{fmt(avgBasket)}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#F3E8FF' }}>✂️</div>
          <div className="stat-info">
            <span className="stat-label">Nb prestations</span>
            <span className="stat-value">{Object.values(serviceCount).reduce((s, v) => s + v, 0)}</span>
          </div>
        </div>
      </div>

      {/* Graphique CA annuel */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h2 className="card-title">CA mensuel {selectedYear}</h2>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v > 0 ? `${v}€` : '0'} />
            <Tooltip formatter={v => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
            <Bar dataKey="ca" fill="#6366F1" radius={[4, 4, 0, 0]}
              label={{ position: 'top', fontSize: 10, fill: '#94a3b8', formatter: v => v > 0 ? `${v}€` : '' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Top services */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Top services</h2>
          </div>
          {topServices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '16px 0', fontSize: '14px' }}>Aucune donnée ce mois.</p>
          ) : (
            <>
              <div style={{ marginBottom: '16px' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={topServices} dataKey="ca" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                      {topServices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f1f5f9' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {topServices.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '13px' }}>{s.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>×{s.count}</span>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--success)' }}>{fmt(s.ca)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Top clients */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Top clients</h2>
          </div>
          {topClients.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '16px 0', fontSize: '14px' }}>Aucune donnée ce mois.</p>
          ) : topClients.map(([name, ca], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${COLORS[i % COLORS.length]}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: COLORS[i % COLORS.length] }}>
                {name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{clientCount[name]} visite{clientCount[name] > 1 ? 's' : ''}</div>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(ca)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
