import { Link, NavLink } from 'react-router-dom'
import { LogOut, Menu, UserCircle2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const AppShell = ({ title, navItems = [], children }) => {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const navContent = (
    <div className="h-full flex flex-col">
      <Link to="/" className="block">
        <h1 className="text-xl font-semibold tracking-tight">SAMS</h1>
        <p className="text-sm text-slate-400 mt-1">Seminary Academic System</p>
      </Link>

      <div className="mt-8 rounded-2xl bg-white/5 p-3 border border-white/10">
        <div className="flex items-center gap-2 text-slate-200">
          <UserCircle2 size={16} />
          <span className="text-sm font-medium">{user?.fullName}</span>
        </div>
        <p className="text-xs text-slate-400 mt-2 capitalize">{user?.role}</p>
      </div>

      <nav className="mt-8 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-white text-slate-950'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className="mt-auto w-full bg-white/10 hover:bg-white/15 transition-colors text-sm rounded-lg px-3 py-2 flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="hidden md:block sticky top-0 h-screen bg-slate-950 text-white p-6 border-r border-slate-800">
        {navContent}
      </aside>

      <main className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">Welcome, {user?.fullName}</p>
          </div>
          <button
            onClick={() => setIsOpen((value) => !value)}
            className="md:hidden inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isOpen ? (
          <div className="md:hidden mb-6 rounded-2xl bg-slate-950 text-white p-4 border border-slate-800">
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
