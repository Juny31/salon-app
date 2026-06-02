import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' FCFA'
const CATEGORIES_SVC = ['Coupe', 'Couleur', 'Soin', 'Coiffage', 'Défrisage', 'Tresse / Natte', 'Extension', 'Autre']

export default function Services({ session }) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'Coupe', price: '', duration_minutes: '30' })
  const [saving, setSaving] = useState(false)
  const uid = session.user.id

  useEffect(() => { fetchServices() }, [])

  const fetchServices = async () => {
    setLoading(true)
    const { data } = await supabase.from('salon_services').select('*').eq('user_id', uid).order('category').order('name')
    setServices(data || [])
    setLoading(false)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ name: s.name, category: s.category, price: String(s.price), duration_minutes: String(s.duration_minutes) })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name, category: form.category, price: parseFloat(form.price) || 0, duration_minutes: parseInt(form.duration_minutes) || 30, user_id: uid, is_active: true }
    if (editing) {
      await supabase.from('salon_services').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('salon_services').insert(payload)
    }
    setShowForm(false); setEditing(null); setForm({ name: '', category: 'Coupe', price: '', duration_minutes: '30' })
    fetchServices()
    setSaving(false)
  }

  const handleToggle = async (s) => {
    await supabase.from('salon_services').update({ is_active: !s.is_active }).eq('id', s.id)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce service ?')) return
    await supabase.from('salon_services').delete().eq('id', id)
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const grouped = CATEGORIES_SVC.reduce((acc, cat) => {
    const items = services.filter(s => s.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Mes services ✂️</h1>
          <p className="page-subtitle">Configurez votre catalogue de prestations</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', category: 'Coupe', price: '', duration_minutes: '30' }); setShowForm(true) }}>
          + Ajouter
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="spinner" /><span>Chargement…</span>
        </div>
      ) : services.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <div className="empty-state-icon">✂️</div>
          <h3>Aucun service configuré</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Ajoutez vos prestations pour pouvoir les enregistrer en caisse.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowForm(true)}>+ Ajouter un service</button>
        </div>
      ) : Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{cat}</h3>
          <div className="card" style={{ padding: 0 }}>
            {items.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none', opacity: s.is_active ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>{s.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>⏱ {s.duration_minutes} min</div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '16px' }}>{fmt(s.price)}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)} title="Modifier">✏️</button>
                <button className={`toggle-btn ${s.is_active ? 'on' : 'off'}`} onClick={() => handleToggle(s)} title={s.is_active ? 'Désactiver' : 'Activer'} style={{ fontSize: '14px' }}>
                  {s.is_active ? '✅' : '⏸️'}
                </button>
                <button className="btn-icon" onClick={() => handleDelete(s.id)} title="Supprimer">🗑️</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? '✏️ Modifier le service' : '✂️ Nouveau service'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input className="form-input" placeholder="Ex: Coupe femme, Balayage, Défrisage…" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Catégorie</label>
                  <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES_SVC.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Durée (minutes)</label>
                  <input className="form-input" type="number" min="5" step="5" value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prix (€) *</label>
                  <input className="form-input" type="number" min="0" step="0.5" placeholder="0,00" value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })} required />
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
    </div>
  )
}
