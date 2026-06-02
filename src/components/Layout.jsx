import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Tableau de bord',  short: 'Tableau' },
  { id: 'caisse',    icon: '💰', label: 'Caisse / Ventes',  short: 'Caisse'  },
  { id: 'clients',   icon: '👤', label: 'Clients',           short: 'Clients' },
  { id: 'stock',     icon: '📦', label: 'Stock produits',    short: 'Stock'   },
  { id: 'reports',   icon: '📈', label: 'Rapports',          short: 'Rapports'},
  { id: 'services',  icon: '✂️', label: 'Mes services',      short: 'Services'},
]

export default function Layout({ children, currentPage, setCurrentPage, session }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userInitial = session?.user?.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">✂️</div>
          <h2>SalonApp</h2>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}>
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{userInitial}</div>
            <span className="user-email">{session?.user?.email}</span>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: '13px' }}
            onClick={() => supabase.auth.signOut()}>
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <div className="mobile-header-logo">
          <div className="mobile-header-logo-icon">✂️</div>
          <span className="mobile-header-title">SalonApp</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="mobile-user-btn" onClick={() => setShowUserMenu(v => !v)}>
            {userInitial}
          </button>
          {showUserMenu && (
            <>
              <div className="mobile-user-overlay" onClick={() => setShowUserMenu(false)} />
              <div className="mobile-user-menu">
                <div className="mobile-user-email">{session?.user?.email}</div>
                <button className="btn btn-ghost"
                  style={{ width: '100%', fontSize: '13px', marginTop: '8px' }}
                  onClick={() => supabase.auth.signOut()}>
                  🚪 Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav">
        {NAV_ITEMS.slice(0, 5).map(item => (
          <button key={item.id}
            className={`bottom-nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}>
            <span className="bottom-nav-icon">{item.icon}</span>
            {item.short.split(' ')[0]}
          </button>
        ))}
      </nav>
    </div>
  )
}
