import { Link, NavLink } from 'react-router-dom'
import { LogOut, Menu, UserCircle2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const NavItem = ({ item, onNavigate, variant }) => {
  const isGold = variant === 'gold'
  return (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        isGold
          ? `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-gold-500 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`
          : `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-gold-500/15 text-gold-600 border border-gold-500/30 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
      }
    >
      <item.icon size={16} />
      <span>{item.label}</span>
    </NavLink>
  )
}

const NavContent = ({ groups = [], navItems = [], onNavigate }) => {
  return (
    <nav className="mt-6 space-y-6 overflow-y-auto flex-1 -mx-2 px-2">
      {navItems.length ? (
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))
      )}
    </nav>
  )
}

const AppShell = ({ title, navItems = [], groups = [], children }) => {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const onNavigate = () => setIsOpen(false)

  const navContent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/20 flex-shrink-0">
          <img src="/logo.svg" alt="GTS Logo" className="h-9 w-auto" />
        </div>
        <div>
          <p className="font-display text-lg font-bold text-white leading-tight">Grace Theological Seminary</p>
          <p className="text-xs text-gold-300">Academic Management</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 p-3 border border-white/10">
        <div className="flex items-center gap-2 text-slate-200">
          <UserCircle2 size={16} className="text-gold-300" />
          <span className="text-sm font-medium truncate">{user?.fullName}</span>
        </div>
        <p className="text-xs text-gold-300 mt-1.5 capitalize">{user?.role}</p>
      </div>

      <NavContent groups={groups} navItems={navItems} onNavigate={onNavigate} />

      <button
        onClick={logout}
        className="mt-4 w-full bg-white/10 hover:bg-white/15 transition-colors text-sm rounded-lg px-3 py-2 flex items-center justify-center gap-2 text-slate-200"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )

  return (
    <div className="min-h-screen md:grid md:grid-cols-[264px_1fr]">
      <aside className="hidden md:flex sticky top-0 h-screen bg-slate-950 text-white p-6 border-r border-slate-800 flex-col">
        {navContent}
      </aside>

      <main className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.fullName?.split(' ')[0] || user?.fullName}</p>
          </div>
          <button
            onClick={() => setIsOpen((value) => !value)}
            className="md:hidden inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isOpen ? (
          <div className="md:hidden mb-6 rounded-2xl bg-slate-950 text-white p-4 border border-slate-800 max-h-[70vh] overflow-y-auto">
            {navContent}
          </div>
        ) : null}

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {children}
        </motion.div>
      </main>
    </div>
  )
}

export default AppShell