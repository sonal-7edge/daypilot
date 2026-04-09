import React, { useState } from 'react'
import Planner from './pages/Planner.jsx'
import Tempo from './pages/Tempo.jsx'
import './App.css'

const NAV = [
  { id: 'planner', label: 'Day Planner' },
  { id: 'tempo',   label: 'Tempo' },
]

export default function App() {
  const [page, setPage] = useState('planner')
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">◈</span>
          <span className="logo-text">daypilot</span>
        </div>
        <nav>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span style={{ color: 'var(--text2)' }}>live</span>
        </div>
      </aside>
      <main className="main-content">
        {page === 'planner' && <Planner />}
        {page === 'tempo'   && <Tempo />}
      </main>
    </div>
  )
}
