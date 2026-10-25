import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isAuthed } from './lib/api'
import Login from './pages/Login'
import Library from './pages/Library'
import ShowDetail from './pages/ShowDetail'
import Pending from './pages/Pending'
import Settings from './pages/Settings'

function Nav() {
  const loc = useLocation()
  const items = [
    { to: '/', label: '追剧' },
    { to: '/pending', label: '待审核' },
    { to: '/settings', label: '设置' },
  ]
  return (
    <nav className="nav">
      {items.map((it) => (
        <a key={it.to} href={`#${it.to}`} className={loc.pathname === it.to ? 'active' : ''}>
          {it.label}
        </a>
      ))}
    </nav>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">剧迹 DramaTrace</span>
      </header>
      <main className="content">{children}</main>
      <Nav />
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    setAuthed(isAuthed())
  }, [])

  if (authed === null) return <div className="loading">加载中…</div>
  if (!authed) {
    return (
      <Routes>
        <Route path="*" element={<Login onLogin={() => setAuthed(true)} />} />
      </Routes>
    )
  }
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/show/:id" element={<ShowDetail />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
