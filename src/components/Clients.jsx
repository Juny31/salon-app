import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' FCFA'

export default function Clients({ session }) {
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [clientVisits, setClientVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const uid = session.user.id

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('salon_clients')
      .select('*, salon_visits(id, total, visit_date)')
      .eq('user_id', uid)
      .order('name')
    setClients(data || [])
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
    if (!error) { setShowForm(false); setForm({ name: '', phone: '', email: '', notes: '' }); fetchClients() }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce client ?')) return
    await supabase.from('salon_clients').delete().eq('id', id)
    setClients(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalCA = (c) => (c.salon_visits || []).reduce((s, v) => s + parseFloat(v.total), 0)
  const lastVisit = (c) => c.salon_visits?.length ? c.salon_visits.sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0].visit_date : null

  if (selected) return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>← Retour</button>
          <div>
            <h1 className="page-title">{selected.name}</h1>
            {selected.phone && <p className="page-subtitle">📞 {selected.phone}</p>}
          </div>
        </div>
        <button className="btn btn-danger" onClick={() => handleDelete(selected.id)} style={{ background: '#FEE2E2', color: '#EF4444', border: 'none' }}>
          🗑️ Supprimer
        </button>
      </div>

      {/* Stats client */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#D1FAE5' }}>💰</div>
          <div className="stat-info">
            <span className="stat-label">CA total</span>
            <span className="stat-value" style={{ color: 'var(--success)' }}>{fmt(totalCA(selected))}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#EEF2FF' }}>📅</div>
          <div className="stat-info">
            <span className="stat-label">Nb visites</span>
            <span className="stat-value">{clientVisits.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#FEF3C7' }}>🕐</div>
          <div className="stat-info">
            <span className="stat-label">Dernière visite</span>
            <span className="stat-value" style={{ fontSize: '14px' }}>
              {lastVisit(selected) ? new Date(lastVisit(selected)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#F3E8FF' }}>📊</div>
          <div className="stat-info">
            <span className="stat-label">Panier moyen</span>
            <span className="stat-value">{fmt(clientVisits.length ? totalCA(selected) / clientVisits.length : 0)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {selected.notes && (
        <div className="alert alert-info" style={{ marginBottom: '16px' }}>📝 {selected.notes}</div>
      )}

      {/* Historique visites */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Historique des visites</h2>
        </div>
        {clientVisits.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Aucune visite enregistrée pour ce client.</p>
          </div>
        ) : (
          <div className="transaction-list">
            {clientVisits.map(v => (
              <div key={v.id} className="transaction-item" style={{ alignItems: 'flex-start' }}>
                <div className="transaction-category-icon" style={{ background: '#D1FAE522', borderColor: '#D1FAE533', marginTop: '2px' }}>✂️</div>
                <div className="transaction-details" style={{ flex: 1 }}>
                  <span className="transaction-desc">
                    {new Date(v.visit_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {v.salon_visit_services?.length > 0 && (
                    <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {v.salon_visit_services.map((s, i) => (
                        <span key={i} style={{ fontSize: '11px', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                          {s.service_name} ×{s.quantity}
                        </span>
                      ))}
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

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nouveau client</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input className="form-input" style={{ maxWidth: '320px' }} type="text" placeholder="🔍 Rechercher un client…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="spinner" /><span>Chargement…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <h3>{search ? 'Aucun résultat' : 'Aucun client'}</h3>
            {!search && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Ajouter un client</button>}
          </div>
        ) : (
          <div className="transaction-list">
            {filtered.map(c => (
              <div key={c.id} className="transaction-item" style={{ cursor: 'pointer' }} onClick={() => selectClient(c)}>
                <div className="transaction-category-icon" style={{ background: '#EEF2FF22', borderColor: '#EEF2FF33', fontSize: '18px' }}>
                  {c.name[0].toUpperCase()}
                </div>
                <div className="transaction-details" style={{ flex: 1 }}>
                  <span className="transaction-desc">{c.name}</span>
                  <div className="transaction-meta">
                    {c.phone && <span>📞 {c.phone}</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {(c.salon_visits || []).length} visite{(c.salon_visits || []).length > 1 ? 's' : ''}
                    </span>
                    {lastVisit(c) && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        Dernier : {new Date(lastVisit(c)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="transaction-amount income">{fmt(totalCA(c))}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input className="form-input" type="tel" placeholder="06 xx xx xx xx" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="email@exemple.com" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (allergies, préférences…)</label>
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
