import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// FCFA — sans décimales
const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 })
    .format(Math.round(n || 0)) + ' FCFA'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export default function Caisse({ session }) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear())
  const [visits, setVisits]               = useState([])
  const [clients, setClients]             = useState([])
  const [services, setServices]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [deleting, setDeleting]           = useState(null)

  // Formulaire nouvelle vente
  const [form, setForm] = useState({
    client_id: '',
    payment_method: 'especes',
    notes: '',
    visit_date: new Date().toISOString().split('T')[0],
  })
  const [cart, setCart]         = useState([])
  const [saving, setSaving]     = useState(false)

  // Ligne de saisie libre
  const [customName,  setCustomName]  = useState('Coupe')
  const [customPrice, setCustomPrice] = useState('1000')

  const uid   = session.user.id
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  useEffect(() => { fetchVisits() }, [selectedMonth, selectedYear])
  useEffect(() => { fetchClientsAndServices() }, [])

  const fetchVisits = async () => {
    setLoading(true)
    const start = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const end   = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('salon_visits')
      .select('*, salon_clients(name), salon_visit_services(service_name, price, quantity)')
      .eq('user_id', uid)
      .gte('visit_date', start)
      .lte('visit_date', end)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
    setVisits(data || [])
    setLoading(false)
  }

  const fetchClientsAndServices = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('salon_clients').select('id, name').eq('user_id', uid).order('name'),
      supabase.from('salon_services').select('id, name, price, category').eq('user_id', uid).eq('is_active', true).order('name'),
    ])
    setClients(c || [])
    setServices(s || [])
  }

  // Ajouter depuis le catalogue
  const addToCart = (svc) => {
    setCart(prev => {
      const existing = prev.find(i => i.service_id === svc.id)
      if (existing) return prev.map(i => i.service_id === svc.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { service_id: svc.id, service_name: svc.name, price: parseFloat(svc.price), quantity: 1 }]
    })
  }

  // Ajouter une ligne libre
  const addCustomLine = () => {
    const p = parseFloat(customPrice)
    if (!customName.trim() || !p || p <= 0) return
    const tempId = `custom_${Date.now()}`
    setCart(prev => {
      const existing = prev.find(i => i.service_name === customName.trim() && i.service_id?.startsWith('custom'))
      if (existing) return prev.map(i => i.service_id === existing.service_id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { service_id: tempId, service_name: customName.trim(), price: p, quantity: 1 }]
    })
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.service_id !== id))

  const updateQty = (id, qty) => {
    if (qty <= 0) { removeFromCart(id); return }
    setCart(prev => prev.map(i => i.service_id === id ? { ...i, quantity: qty } : i))
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const resetForm = () => {
    setShowForm(false)
    setForm({ client_id: '', payment_method: 'especes', notes: '', visit_date: new Date().toISOString().split('T')[0] })
    setCart([])
    setCustomName('Coupe')
    setCustomPrice('1000')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (cart.length === 0) { alert('Ajoutez au moins un service.'); return }
    setSaving(true)
    const { data: visit, error } = await supabase
      .from('salon_visits')
      .insert({
        user_id: uid,
        client_id: form.client_id || null,
        visit_date: form.visit_date,
        total,
        payment_method: form.payment_method,
        notes: form.notes,
      })
      .select()
      .single()

    if (!error && visit) {
      await supabase.from('salon_visit_services').insert(
        cart.map(i => ({
          visit_id: visit.id,
          service_id: i.service_id?.startsWith('custom') ? null : i.service_id,
          service_name: i.service_name,
          price: i.price,
          quantity: i.quantity,
        }))
      )
      resetForm()
      fetchVisits()
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette vente ?')) return
    setDeleting(id)
    await supabase.from('salon_visit_services').delete().eq('visit_id', id)
    await supabase.from('salon_visits').delete().eq('id', id)
    setVisits(prev => prev.filter(v => v.id !== id))
    setDeleting(null)
  }

  const totalMonth = visits.reduce((s, v) => s + parseFloat(v.total), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Caisse / Ventes</h1>
          <p className="page-subtitle">Enregistrez vos ventes et suivez votre chiffre d'affaires</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nouvelle vente</button>
      </div>

      {/* Sélecteur mois */}
      <div className="transactions-controls">
        <div className="month-selector">
          <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>📅</span>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
            {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Résumé */}
      <div className="transactions-summary">
        <div className="summary-chip">
          <span className="label">CA du mois</span>
          <span className="value" style={{ color: 'var(--success)' }}>{fmt(totalMonth)}</span>
        </div>
        <div className="summary-chip">
          <span className="label">Ventes</span>
          <span className="value">{visits.length}</span>
        </div>
        <div className="summary-chip">
          <span className="label">Moyenne / vente</span>
          <span className="value">{fmt(visits.length ? totalMonth / visits.length : 0)}</span>
        </div>
      </div>

      {/* Liste des ventes */}
      <div className="card">
        {loading ? (
          <div className="loading-spinner" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="spinner" /><span>Chargement…</span>
          </div>
        ) : visits.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <h3>Aucune vente ce mois</h3>
            <button className="btn btn-primary" style={{ marginTop: '14px' }} onClick={() => setShowForm(true)}>+ Nouvelle vente</button>
          </div>
        ) : (
          <div className="transaction-list">
            {visits.map(v => (
              <div key={v.id} className="transaction-item" style={{ alignItems: 'flex-start' }}>
                <div className="transaction-category-icon" style={{ background: 'rgba(232,57,29,0.08)', borderColor: 'rgba(232,57,29,0.12)', marginTop: '2px' }}>
                  ✂️
                </div>
                <div className="transaction-details" style={{ flex: 1 }}>
                  <span className="transaction-desc">{v.salon_clients?.name || 'Client de passage'}</span>
                  <div className="transaction-meta">
                    <span className="transaction-date">
                      {new Date(v.visit_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {v.payment_method === 'especes' ? '💵 Espèces' : v.payment_method === 'carte' ? '💳 Carte' : '🏦 Virement'}
                    </span>
                  </div>
                  {v.salon_visit_services?.length > 0 && (
                    <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {v.salon_visit_services.map((s, i) => (
                        <span key={i} style={{ fontSize: '11px', background: 'var(--card-2)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                          {s.service_name} ×{s.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="transaction-amount income">+{fmt(v.total)}</span>
                <button className="btn-icon" onClick={() => handleDelete(v.id)} disabled={deleting === v.id} title="Supprimer">
                  {deleting === v.id ? '⏳' : '🗑️'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn-add-mobile" onClick={() => setShowForm(true)} aria-label="Nouvelle vente">+</button>

      {/* ── Modal nouvelle vente ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => resetForm()}>
          <div className="modal" style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">✂️ Nouvelle vente</h2>
              <button className="modal-close" onClick={() => resetForm()}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              {/* Client + date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Client</label>
                  <select className="form-input" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                    <option value="">Client de passage</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.visit_date}
                    onChange={e => setForm({ ...form, visit_date: e.target.value })} required />
                </div>
              </div>

              {/* ── Catalogue de services (si configurés) ── */}
              {services.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Catalogue ✂️</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {services.map(s => (
                      <button key={s.id} type="button"
                        style={{
                          padding: '6px 12px', borderRadius: '8px',
                          border: `1px solid ${cart.find(i => i.service_id === s.id) ? 'var(--accent)' : 'var(--border)'}`,
                          background: cart.find(i => i.service_id === s.id) ? 'var(--accent-dim)' : 'var(--card-2)',
                          color: cart.find(i => i.service_id === s.id) ? 'var(--accent-2)' : 'var(--text)',
                          cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                        }}
                        onClick={() => addToCart(s)}>
                        {s.name} — {fmt(s.price)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Saisie libre — toujours disponible ── */}
              <div className="form-group">
                <label className="form-label">
                  {services.length > 0 ? 'Ou saisie libre' : 'Service ✂️'}
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Ex: Coupe, Rasage, Tresse…"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLine())}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      step="100"
                      placeholder="1000"
                      value={customPrice}
                      onChange={e => setCustomPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLine())}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '10px 16px', borderRadius: '10px', flexShrink: 0 }}
                    onClick={addCustomLine}
                  >
                    + Ajouter
                  </button>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '5px' }}>
                  Montant en FCFA — appuyez sur Entrée ou cliquez + Ajouter
                </p>
              </div>

              {/* ── Panier ── */}
              {cart.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', marginBottom: '18px', background: 'var(--card-2)' }}>
                  {cart.map(item => (
                    <div key={item.service_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{item.service_name}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.price)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button"
                          style={{ width: '26px', height: '26px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-3)', cursor: 'pointer', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => updateQty(item.service_id, item.quantity - 1)}>−</button>
                        <span style={{ width: '22px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>{item.quantity}</span>
                        <button type="button"
                          style={{ width: '26px', height: '26px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-3)', cursor: 'pointer', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => updateQty(item.service_id, item.quantity + 1)}>+</button>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.service_id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '18px', lineHeight: 1, padding: '2px 4px' }}>×</button>
                    </div>
                  ))}
                  {/* Total */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Total</span>
                    <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--success)', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(total)}
                    </span>
                  </div>
                </div>
              )}

              {/* Paiement */}
              <div className="form-group">
                <label className="form-label">Paiement</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['especes', '💵 Espèces'], ['carte', '💳 Carte'], ['virement', '🏦 Virement']].map(([val, label]) => (
                    <button key={val} type="button"
                      style={{
                        flex: 1, padding: '9px 8px', borderRadius: '10px',
                        border: `2px solid ${form.payment_method === val ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.payment_method === val ? 'var(--accent-dim)' : 'var(--card-2)',
                        cursor: 'pointer', fontSize: '13px',
                        fontWeight: form.payment_method === val ? 700 : 400,
                        color: form.payment_method === val ? 'var(--accent-2)' : 'var(--text)',
                        transition: 'all 0.15s',
                      }}
                      onClick={() => setForm({ ...form, payment_method: val })}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Notes (optionnel)</label>
                <textarea className="form-input" rows={2} placeholder="Remarques…"
                  value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => resetForm()}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving || cart.length === 0}>
                  {saving ? '⏳ Enregistrement…' : cart.length === 0 ? 'Ajoutez un service' : `✅ Valider — ${fmt(total)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
