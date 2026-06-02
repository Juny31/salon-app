import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 })
    .format(Math.round(n || 0)) + ' FCFA'

const SUBSCRIPTION_TIERS = ['VIP', 'Premium', 'Standard']

const TIER_STYLE = {
  VIP:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  emoji: '👑' },
  Premium:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)', emoji: '💎' },
  Standard: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)',  emoji: '⭐' },
}

export default function Clients({ session }) {
  const [tab, setTab]               = useState('abonnes') // 'abonnes' | 'tous'
  const [subscribers, setSubscribers] = useState([])
  const [allClients, setAllClients]  = useState([])
  const [loading, setLoading]        = useState(true)
  const [selected, setSelected]      = useState(null)
  const [clientVisits, setClientVisits] = useState([])
  const [showForm, setShowForm]      = useState(false)
  const [search, setSearch]          = useState('')
  const [form, setForm]              = useState({ name: '', phone: '', notes: '' })
  const [saving, setSaving]          = useState(false)
  const uid = session.user.id

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)

    // Tous les clients
    const { data: clients } = await supabase
      .from('salon_clients')
      .select('id, name, phone, notes')
      .eq('user_id', uid)
      .order('name')

    // Toutes les visites avec leurs services
    const { data: visits } = await supabase
      .from('salon_visits')
      .select('id, client_id, visit_date, total, salon_visit_services(service_name, price)')
      .eq('user_id', uid)
      .order('visit_date', { ascending: false })

    setAllClients(clients || [])

    // Calculer le profil abonnement pour chaque client
    const clientMap = {}
    for (const v of (visits || [])) {
      if (!v.client_id) continue
      if (!clientMap[v.client_id]) {
        clientMap[v.client_id] = {
          id: v.client_id,
          totalSpent: 0,
          visits: [],
          subscriptionTier: null,
          visitsThisMonth: 0,
        }
      }
      clientMap[v.client_id].totalSpent += parseFloat(v.total)
      clientMap[v.client_id].visits.push(v)

      // Détecter le tier d'abonnement (le plus élevé trouvé)
      for (const svc of (v.salon_visit_services || [])) {
        const tier = SUBSCRIPTION_TIERS.find(t => svc.service_name === t)
        if (tier) {
          const current = clientMap[v.client_id].subscriptionTier
          if (!current || SUBSCRIPTION_TIERS.indexOf(tier) < SUBSCRIPTION_TIERS.indexOf(current)) {
            clientMap[v.client_id].subscriptionTier = tier
          }
        }
      }

      // Visites ce mois
      if (v.visit_date >= monthStart) {
        clientMap[v.client_id].visitsThisMonth++
      }
    }

    // Abonnés = clients avec un tier détecté
    const subs = Object.values(clientMap)
      .filter(c => c.subscriptionTier)
      .map(c => ({
        ...c,
        ...(clients || []).find(cl => cl.id === c.id),
        lastVisit: c.visits[0]?.visit_date || null,
        totalVisits: c.visits.length,
        usedThisMonth: c.visitsThisMonth > 0,
      }))
      .sort((a, b) => SUBSCRIPTION_TIERS.indexOf(a.subscriptionTier) - SUBSCRIPTION_TIERS.indexOf(b.subscriptionTier))

    setSubscribers(subs)
    setLoading(false)
  }

  const selectClient = async (client) => {
    setSelected(client)
    const { data } = await supabase
      .from('salon_visits')
      .select('*, salon_visit_services(service_name, price, quantity)')
      .eq('client_id', client.id)
      .order('visit_date', { ascending: false })
    setClientVisits(data || [])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('salon_clients').insert({ ...form, user_id: uid })
    if (!error) { setShowForm(false); setForm({ name: '', phone: '', notes: '' }); fetchData() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce client ?')) return
    await supabase.from('salon_clients').delete().eq('id', id)
    setAllClients(prev => prev.filter(c => c.id !== id))
    setSubscribers(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const monthName = now.toLocaleDateString('fr-FR', { month: 'long' })

  // ── Vue détail client ──
  if (selected) return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>← Retour</button>
          <div>
            <h1 className="page-title">{selected.name}</h1>
            {selected.phone && <p className="page-subtitle">📞 {selected.phone}</p>}
          </div>
        </div>
        {selected.subscriptionTier && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: TIER_STYLE[selected.subscriptionTier].bg,
            border: `1px solid ${TIER_STYLE[selected.subscriptionTier].border}`,
            borderRadius: '12px', padding: '8px 16px',
          }}>
            <span style={{ fontSize: '18px' }}>{TIER_STYLE[selected.subscriptionTier].emoji}</span>
            <span style={{ fontWeight: 700, color: TIER_STYLE[selected.subscriptionTier].color, fontSize: '15px' }}>
              Abonnement {selected.subscriptionTier}
            </span>
          </div>
        )}
      </div>

      {/* Stats abonné */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">📅</div>
            <span className="stat-label">Visites ce mois</span>
          </div>
          <div className="stat-value">{selected.visitsThisMonth || 0}</div>
          <div className="stat-trend">
            <span className={`trend-chip ${selected.usedThisMonth ? 'up' : 'down'}`}>
              {selected.usedThisMonth ? '✓ Actif' : '✗ Absent'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">🔁</div>
            <span className="stat-label">Total visites</span>
          </div>
          <div className="stat-value">{selected.totalVisits || clientVisits.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">💰</div>
            <span className="stat-label">Total dépensé</span>
          </div>
          <div className="stat-value" style={{ fontSize: '20px' }}>{fmt(selected.totalSpent || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-icon-wrapper">🕐</div>
            <span className="stat-label">Dernière visite</span>
          </div>
          <div className="stat-value" style={{ fontSize: '16px' }}>
            {selected.lastVisit
              ? new Date(selected.lastVisit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
              : '—'}
          </div>
        </div>
      </div>

      {selected.notes && (
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>📝 {selected.notes}</div>
      )}

      {/* Historique */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Historique des visites</h2>
        </div>
        {clientVisits.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>Aucune visite enregistrée.</p>
          </div>
        ) : (
          <div className="transaction-list">
            {clientVisits.map(v => (
              <div key={v.id} className="transaction-item" style={{ alignItems: 'flex-start' }}>
                <div className="transaction-category-icon" style={{ background: 'rgba(232,57,29,0.08)', borderColor: 'rgba(232,57,29,0.12)', marginTop: '2px' }}>✂️</div>
                <div className="transaction-details" style={{ flex: 1 }}>
                  <span className="transaction-desc">
                    {new Date(v.visit_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {v.salon_visit_services?.length > 0 && (
                    <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {v.salon_visit_services.map((s, i) => {
                        const tier = SUBSCRIPTION_TIERS.find(t => s.service_name === t)
                        return (
                          <span key={i} style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                            background: tier ? TIER_STYLE[tier].bg : 'var(--card-2)',
                            color: tier ? TIER_STYLE[tier].color : 'var(--text-2)',
                            border: `1px solid ${tier ? TIER_STYLE[tier].border : 'var(--border)'}`,
                            fontWeight: tier ? 700 : 400,
                          }}>
                            {tier && TIER_STYLE[tier].emoji} {s.service_name} ×{s.quantity}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <span className="transaction-amount income">+{fmt(v.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── Vue principale ──
  const filteredAll = allClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            {subscribers.length} abonné{subscribers.length > 1 ? 's' : ''} · {allClients.length} client{allClients.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nouveau client</button>
      </div>

      {/* Onglets */}
      <div className="type-filter" style={{ marginBottom: '20px', width: 'fit-content' }}>
        <button className={`type-filter-btn ${tab === 'abonnes' ? 'active' : ''}`} onClick={() => setTab('abonnes')}>
          👑 Abonnés ({subscribers.length})
        </button>
        <button className={`type-filter-btn ${tab === 'tous' ? 'active' : ''}`} onClick={() => setTab('tous')}>
          👤 Tous ({allClients.length})
        </button>
      </div>

      {/* ── Vue Abonnés ── */}
      {tab === 'abonnes' && (
        <>
          {loading ? (
            <div className="loading-spinner" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="spinner" /><span>Chargement…</span>
            </div>
          ) : subscribers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👑</div>
              <h3>Aucun abonné</h3>
              <p>Les clients avec un abonnement Standard, Premium ou VIP apparaîtront ici.</p>
            </div>
          ) : (
            <>
              {/* Résumé par tier */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {SUBSCRIPTION_TIERS.map(tier => {
                  const count = subscribers.filter(s => s.subscriptionTier === tier).length
                  const activeCount = subscribers.filter(s => s.subscriptionTier === tier && s.usedThisMonth).length
                  if (count === 0) return null
                  const style = TIER_STYLE[tier]
                  return (
                    <div key={tier} className="stat-card" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                      <div className="stat-card-top">
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(0,0,0,0.2)', fontSize: '18px' }}>
                          {style.emoji}
                        </div>
                        <span className="stat-label" style={{ color: style.color }}>{tier}</span>
                      </div>
                      <div className="stat-value" style={{ color: style.color }}>{count}</div>
                      <div className="stat-trend">
                        <span className="stat-trend-label">abonné{count > 1 ? 's' : ''}</span>
                        <span className="trend-chip up">{activeCount}/{count} actifs en {monthName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Liste abonnés */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Utilisation — {monthName}</h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    {subscribers.filter(s => s.usedThisMonth).length} / {subscribers.length} venus ce mois
                  </span>
                </div>
                <div className="transaction-list">
                  {subscribers.map(sub => {
                    const style = TIER_STYLE[sub.subscriptionTier]
                    return (
                      <div key={sub.id} className="transaction-item" style={{ cursor: 'pointer' }}
                        onClick={() => selectClient(sub)}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                          background: style.bg, border: `1px solid ${style.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                        }}>
                          {style.emoji}
                        </div>
                        <div className="transaction-details" style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="transaction-desc">{sub.name}</span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
                              background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                            }}>
                              {sub.subscriptionTier}
                            </span>
                          </div>
                          <div className="transaction-meta">
                            <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                              {sub.visitsThisMonth} visite{sub.visitsThisMonth > 1 ? 's' : ''} en {monthName}
                            </span>
                            {sub.lastVisit && (
                              <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                                · Dernier : {new Date(sub.lastVisit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
                            background: sub.usedThisMonth ? 'var(--green-dim)' : 'var(--red-dim)',
                            color: sub.usedThisMonth ? 'var(--green)' : 'var(--red)',
                          }}>
                            {sub.usedThisMonth ? '✓ Actif' : '✗ Absent'}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-3)', fontSize: '18px', marginLeft: '4px' }}>›</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Vue Tous ── */}
      {tab === 'tous' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <input className="form-input" style={{ maxWidth: '320px' }} type="text"
              placeholder="🔍 Rechercher un client…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card">
            {loading ? (
              <div className="loading-spinner" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div className="spinner" /><span>Chargement…</span>
              </div>
            ) : filteredAll.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👤</div>
                <h3>{search ? 'Aucun résultat' : 'Aucun client'}</h3>
                {!search && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Ajouter un client</button>}
              </div>
            ) : (
              <div className="transaction-list">
                {filteredAll.map(c => {
                  const sub = subscribers.find(s => s.id === c.id)
                  return (
                    <div key={c.id} className="transaction-item" style={{ cursor: 'pointer' }}
                      onClick={() => selectClient(sub || { ...c, totalSpent: 0, totalVisits: 0, visitsThisMonth: 0 })}>
                      <div className="transaction-category-icon" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '16px', fontWeight: 700 }}>
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="transaction-details" style={{ flex: 1 }}>
                        <span className="transaction-desc">{c.name}</span>
                        <div className="transaction-meta">
                          {c.phone && <span>📞 {c.phone}</span>}
                          {sub && (
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                              background: TIER_STYLE[sub.subscriptionTier].bg,
                              color: TIER_STYLE[sub.subscriptionTier].color,
                            }}>
                              {TIER_STYLE[sub.subscriptionTier].emoji} {sub.subscriptionTier}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-3)', fontSize: '18px' }}>›</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal nouveau client */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">👤 Nouveau client</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" placeholder="Prénom Nom" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input className="form-input" type="tel" placeholder="06 xx xx xx xx" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳…' : '✅ Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
