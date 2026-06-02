import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' FCFA'

const CATEGORIES = ['Shampoing', 'Soin / Masque', 'Coloration', 'Défrisant', 'Styling', 'Outillage', 'Autre']

export default function Stock({ session }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showMovement, setShowMovement] = useState(null) // product for movement
  const [movQty, setMovQty] = useState('')
  const [movReason, setMovReason] = useState('achat')
  const [movType, setMovType] = useState('in')
  const [form, setForm] = useState({ name: '', category: 'Autre', stock_quantity: '', min_stock: '', unit: 'unité', price: '' })
  const [saving, setSaving] = useState(false)
  const [filterLow, setFilterLow] = useState(false)
  const uid = session.user.id

  useEffect(() => { fetchProducts() }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data } = await supabase.from('salon_products').select('*').eq('user_id', uid).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('salon_products').insert({
      ...form,
      user_id: uid,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      price: parseFloat(form.price) || 0,
    })
    if (!error) { setShowForm(false); setForm({ name: '', category: 'Autre', stock_quantity: '', min_stock: '', unit: 'unité', price: '' }); fetchProducts() }
    setSaving(false)
  }

  const handleMovement = async (e) => {
    e.preventDefault()
    if (!showMovement || !movQty) return
    setSaving(true)
    const qty = parseFloat(movQty)
    const change = movType === 'in' ? qty : -qty
    const newQty = Math.max(0, showMovement.stock_quantity + change)

    await Promise.all([
      supabase.from('salon_products').update({ stock_quantity: newQty }).eq('id', showMovement.id),
      supabase.from('salon_stock_movements').insert({
        user_id: uid, product_id: showMovement.id,
        quantity_change: change, reason: movReason,
        movement_date: new Date().toISOString().split('T')[0]
      })
    ])
    setProducts(prev => prev.map(p => p.id === showMovement.id ? { ...p, stock_quantity: newQty } : p))
    setShowMovement(null); setMovQty(''); setMovReason('achat'); setMovType('in')
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce produit ?')) return
    await supabase.from('salon_products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  const displayed = filterLow ? products.filter(p => p.stock_quantity <= p.min_stock) : products
  const lowCount = products.filter(p => p.stock_quantity <= p.min_stock).length

  const stockLevel = (p) => {
    if (p.min_stock <= 0) return 100
    return Math.min((p.stock_quantity / (p.min_stock * 2)) * 100, 100)
  }
  const stockColor = (p) => {
    if (p.stock_quantity <= 0) return '#EF4444'
    if (p.stock_quantity <= p.min_stock) return '#F59E0B'
    return '#10B981'
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Stock produits</h1>
          <p className="page-subtitle">{products.length} produit{products.length > 1 ? 's' : ''} · {lowCount > 0 ? `⚠️ ${lowCount} en rupture` : '✅ Tous OK'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Ajouter produit</button>
      </div>

      <div className="transactions-controls">
        <div className="type-filter">
          <button className={`type-filter-btn ${!filterLow ? 'active' : ''}`} onClick={() => setFilterLow(false)}>Tous ({products.length})</button>
          <button className={`type-filter-btn ${filterLow ? 'active' : ''}`} onClick={() => setFilterLow(true)}>
            ⚠️ Stock faible ({lowCount})
          </button>
        </div>
      </div>

      <div className="budget-grid">
        {loading ? (
          <div className="loading-spinner" style={{ padding: '40px', gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="spinner" /><span>Chargement…</span>
          </div>
        ) : displayed.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">📦</div>
            <h3>{filterLow ? 'Aucun produit en rupture' : 'Aucun produit'}</h3>
            {!filterLow && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Ajouter un produit</button>}
          </div>
        ) : displayed.map(p => {
          const color = stockColor(p)
          const level = stockLevel(p)
          const isLow = p.stock_quantity <= p.min_stock
          return (
            <div key={p.id} className="budget-card">
              <div className="budget-card-header">
                <div className="budget-cat-info">
                  <span className="budget-cat-icon">📦</span>
                  <div>
                    <span className="budget-cat-name">{p.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{p.category}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setShowMovement(p); setMovType('in') }} title="Entrée stock">📥</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setShowMovement(p); setMovType('out') }} title="Sortie stock">📤</button>
                  <button className="btn btn-sm btn-ghost" style={{ color: '#EF4444' }} onClick={() => handleDelete(p.id)} title="Supprimer">🗑️</button>
                </div>
              </div>

              <div className="budget-amounts">
                <span className="budget-spent" style={{ color }}>
                  {p.stock_quantity} {p.unit}
                </span>
                <span className="budget-limit">min: {p.min_stock} {p.unit}</span>
              </div>

              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${level}%`, background: color }} />
              </div>

              <div className="budget-status">
                {p.price > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(p.price)} / {p.unit}</span>}
                <span style={{ fontSize: '12px', color: isLow ? '#EF4444' : '#10B981', fontWeight: isLow ? 700 : 400 }}>
                  {p.stock_quantity <= 0 ? '🚨 Rupture totale' : isLow ? '⚠️ Stock faible' : '✅ OK'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal ajout produit */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📦 Nouveau produit</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" placeholder="Ex: Shampoing kératine 500ml" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Catégorie</label>
                  <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unité</label>
                  <input className="form-input" placeholder="unité, ml, g, L…" value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock actuel</label>
                  <input className="form-input" type="number" min="0" step="0.1" placeholder="0" value={form.stock_quantity}
                    onChange={e => setForm({ ...form, stock_quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock minimum (alerte)</label>
                  <input className="form-input" type="number" min="0" step="0.1" placeholder="0" value={form.min_stock}
                    onChange={e => setForm({ ...form, min_stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prix unitaire (€)</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '⏳…' : '✅ Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal mouvement de stock */}
      {showMovement && (
        <div className="modal-overlay" onClick={() => setShowMovement(null)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{movType === 'in' ? '📥 Entrée stock' : '📤 Sortie stock'}</h2>
              <button className="modal-close" onClick={() => setShowMovement(null)}>✕</button>
            </div>
            <p style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
              {showMovement.name} — stock actuel : <strong>{showMovement.stock_quantity} {showMovement.unit}</strong>
            </p>
            <form onSubmit={handleMovement}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[['in', '📥 Entrée'], ['out', '📤 Sortie']].map(([v, l]) => (
                  <button key={v} type="button"
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${movType === v ? 'var(--primary)' : 'var(--border)'}`, background: movType === v ? '#EEF2FF' : 'var(--surface-2)', cursor: 'pointer', fontSize: '13px', fontWeight: movType === v ? 700 : 400, color: 'var(--text)' }}
                    onClick={() => setMovType(v)}>{l}</button>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Quantité ({showMovement.unit})</label>
                <input className="form-input" type="number" min="0.1" step="0.1" placeholder="0" value={movQty}
                  onChange={e => setMovQty(e.target.value)} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Motif</label>
                <select className="form-input" value={movReason} onChange={e => setMovReason(e.target.value)}>
                  {movType === 'in'
                    ? [['achat', '🛒 Achat'], ['retour', '↩️ Retour'], ['inventaire', '📋 Inventaire']].map(([v, l]) => <option key={v} value={v}>{l}</option>)
                    : [['utilisation', '✂️ Utilisation'], ['perte', '🗑️ Perte / Casse'], ['inventaire', '📋 Inventaire']].map(([v, l]) => <option key={v} value={v}>{l}</option>)
                  }
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMovement(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '⏳…' : '✅ Valider'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
