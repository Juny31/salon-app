import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'caisse',    label: 'Caisse',    icon: '💰' },
  { id: 'clients',   label: 'Clients',   icon: '👤' },
  { id: 'stock',     label: 'Stock',     icon: '📦' },
  { id: 'reports',   label: 'Rapports',  icon: '📈' },
  { id: 'services',  label: 'Services',  icon: '✂️' },
]

const BOTTOM_NAV = [
  { id: 'dashboard', icon: '📊', short: 'Tableau' },
  { id: 'caisse',    icon: '💰', short: 'Caisse'  },
  { id: 'clients',   icon: '👤', short: 'Clients' },
  { id: 'stock',     icon: '📦', short: 'Stock'   },
  { id: 'services',  icon: '✂️', short: 'Services'},
  { id: 'reports',   icon: '📈', short: 'Rapports'},
]

export default function Layout({ children, currentPage, setCurrentPage, session }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userInitial = session?.user?.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="app-layout">

      {/* ── Top Navigation ── */}
      <header className="mobile-header">

        {/* Logo */}
        <div className="mobile-header-logo">
          <div className="mobile-header-logo-icon">✂️</div>
          <span className="mobile-header-title">SalonApp</span>
        </div>

        {/* Nav items — center */}
        <nav className="top-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`top-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <span className="top-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="top-nav-right">
          <div style={{ position: 'relative' }}>
            <button className="mobile-user-btn" onClick={() => setShowUserMenu(v => !v)}>
              {userInitial}
            </button>
            {showUserMenu && (
              <>
                <div className="mobile-user-overlay" onClick={() => setShowUserMenu(false)} />
                <div className="mobile-user-menu">
                  <div className="mobile-user-email">{session?.user?.email}</div>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', fontSize: '13px', marginTop: '4px', justifyContent: 'flex-start' }}
                    onClick={() => supabase.auth.signOut()}
                  >
                    🚪 Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="main-content">{children}</main>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map(item => (
          <button
            key={item.id}
            className={`bottom-nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            {item.short}
          </button>
        ))}
      </nav>
    </div>
  )
}
