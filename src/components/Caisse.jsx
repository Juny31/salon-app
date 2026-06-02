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
  const [customName,  setCustomName]  = useState('')
  const [customPrice, setCustomPrice] = useState('')

  // Accès rapide — services fréquents
  const QUICK_SERVICES = [
    { name: 'Coupe',    price: 1000,  emoji: '✂️' },
    { name: 'Standard', price: 3000,  emoji: '⭐',  badge: 'Abonnement' },
    { name: 'Premium',  price: 7000,  emoji: '💎',  badge: 'Abonnement' },
    { name: 'VIP',      price: 30000, emoji: '👑',  badge: 'Abonnement' },
  ]

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

  // Ajouter depuis le catalogue ou accès rapide
  const addToCart = (svc) => {
    setCart(prev => {
      // Recherche par nom + prix pour les quick services
      const existing = prev.find(i =>
        i.service_id === svc.id ||
        (i.service_name === svc.name && i.price === parseFloat(svc.price))
      )
      if (existing) return prev.map(i =>
        (i.service_id === svc.id || (i.service_name === svc.name && i.price === parseFloat(svc.price)))
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
      return [...prev, {
        service_id: svc.id,
        service_name: svc.name,
        price: parseFloat(svc.price),
        quantity: 1,
      }]
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
          <span className="label">Abonnements</span>
          <span className="value">{visits.filter(v => v.salon_visit_services?.some(s => ['Standard','Premium','VIP'].includes(s.service_name))).length}</span>
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

              {/* ── 1. Coupe ── */}
              <div className="form-group">
                <label className="form-label">✂️ Coupe</label>
                <button type="button"
                  onClick={() => addToCart({ id: 'quick_Coupe', name: 'Coupe', price: 1000 })}
                  style={{
                    width: '100%', padding: '14px 18px', borderRadius: '12px', textAlign: 'left',
                    border: `1.5px solid ${cart.find(i => i.service_name === 'Coupe') ? 'var(--accent)' : 'var(--border)'}`,
                    background: cart.find(i => i.service_name === 'Coupe') ? 'var(--accent-dim)' : 'var(--card-2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>✂️</span>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: cart.find(i => i.service_name === 'Coupe') ? 'var(--accent-2)' : 'var(--text)' }}>
                      Coupe
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cart.find(i => i.service_name === 'Coupe') ? 'var(--accent-2)' : 'var(--text-2)' }}>
                      1 000 FCFA
                    </span>
                    {cart.find(i => i.service_name === 'Coupe') && (
                      <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '11px', fontWeight: 700, width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {cart.find(i => i.service_name === 'Coupe').quantity}
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* ── 2. Abonnement ── */}
              <div className="form-group">
                <label className="form-label">👑 Abonnement</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { name: 'Standard', price: 3000, emoji: '⭐', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.25)' },
                    { name: 'Premium',  price: 7000, emoji: '💎', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)' },
                    { name: 'VIP',      price: 30000, emoji: '👑', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
                  ].map(s => {
                    const inCart = cart.find(i => i.service_name === s.name)
                    const toggleAbo = () => {
                      // Un seul abonnement à la fois — retirer les autres
                      setCart(prev => {
                        const withoutAbo = prev.filter(i => !['Standard','Premium','VIP'].includes(i.service_name))
                        if (inCart) return withoutAbo // désélectionner si déjà là
                        return [...withoutAbo, { service_id: `quick_${s.name}`, service_name: s.name, price: s.price, quantity: 1 }]
                      })
                    }
                    return (
                      <button key={s.name} type="button" onClick={toggleAbo}
                        style={{
                          padding: '14px 10px', borderRadius: '12px', textAlign: 'center',
                          border: `1.5px solid ${inCart ? s.border : 'var(--border)'}`,
                          background: inCart ? s.bg : 'var(--card-2)',
                          cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                        }}>
                        {inCart && (
                          <span style={{
                            position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px',
                            background: s.color, borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '9px', color: '#000', fontWeight: 800,
                          }}>✓</span>
                        )}
                        <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.emoji}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: inCart ? s.color : 'var(--text)', marginBottom: '3px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: inCart ? s.color : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                          {new Intl.NumberFormat('fr-FR').format(s.price)} FCFA
                        </div>
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>
                  Un seul abonnement par visite · cliquez à nouveau pour désélectionner
                </p>
              </div>

              {/* ── 3. Saisie libre (optionnel) ── */}
              <div className="form-group">
                <label className="form-label">Autre (optionnel)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input className="form-input" type="text" placeholder="Nom du service…"
                    value={customName} style={{ flex: 2 }}
                    onChange={e => setCustomName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLine())} />
                  <input className="form-input" type="number" min="1" step="any" placeholder="FCFA"
                    value={customPrice} style={{ flex: 1 }}
                    onChange={e => setCustomPrice(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLine())} />
                  <button type="button" className="btn btn-secondary"
                    style={{ flexShrink: 0, borderRadius: '10px', padding: '10px 14px' }}
                    onClick={addCustomLine}>+</button>
                </div>
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

              {/* Paiement — espèces uniquement */}
              <div className="form-group">
                <label className="form-label">Paiement</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--card-2)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '12px 16px',
                }}>
                  <span style={{ fontSize: '20px' }}>💵</span>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>Espèces</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-3)' }}>Seul mode accepté</span>
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
