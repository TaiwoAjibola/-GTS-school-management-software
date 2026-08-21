import { Link, NavLink } from 'react-router-dom'
import { LogOut, Menu, UserCircle2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const NavItem = ({ item, onNavigate }) => {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] leading-none transition-all duration-200 ease-out border ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm'
            : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-100 font-medium'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-200 ${
              isActive
                ? 'bg-white border border-indigo-200 text-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-500 border border-transparent group-hover:bg-white group-hover:text-slate-700 group-hover:border-slate-200 group-hover:shadow-sm'
            }`}
          >
            <item.icon size={14} strokeWidth={isActive ? 2.4 : 1.9} />
          </span>
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

const NavContent = ({ groups = [], navItems = [], onNavigate }) => {
  return (
    <nav className="mt-6 space-y-7 overflow-y-auto flex-1 -mx-2 px-2 pr-1 [scrollbar-width:thin]">
      {navItems.length ? (
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {group.label}
            </p>
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
    <div className="h-full flex flex-col min-h-0">
      {/* Logo — white with indigo accent */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden shrink-0">
          <img src="/logo.svg" alt="GTS Logo" className="h-8 w-auto" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[14.5px] font-bold tracking-[-0.03em] text-slate-900 leading-none">
            Grace Theological Seminary
          </p>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 mt-1">
            Academic Management
          </p>
        </div>
      </div>

      {/* User — light bento */}
      <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <UserCircle2 size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-900 truncate leading-none">
              {user?.fullName}
            </p>
            <p className="text-xs font-medium capitalize text-slate-500 mt-1 truncate">
              {user?.role}
            </p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm ring-4 ring-emerald-50 shrink-0" aria-hidden />
        </div>
      </div>

      <NavContent groups={groups} navItems={navItems} onNavigate={onNavigate} />

      <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
        <button
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm transition-all duration-200 ease-out"
        >
          <LogOut size={16} className="text-slate-500" /> Sign Out
        </button>
        <p className="text-center text-[10px] font-medium tracking-wide text-slate-400 mt-3">© 2026 Grace Theological Seminary</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen overflow-hidden md:grid md:grid-cols-[276px_1fr] bg-[#F8FAFC]">
      {/* Sidebar — LIGHT bento */}
      <aside className="hidden md:flex h-screen bg-white border-r border-slate-200 p-5 flex-col overflow-hidden shrink-0">
        {navContent}
      </aside>

      {/* Main — single-viewport preserved */}
      <main className="h-screen min-h-0 flex flex-col overflow-hidden bg-[#F8FAFC] p-4 md:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 shrink-0">
          {title !== "Forms" ? (
            <div className="min-w-0">
              <h1 className="font-display text-2xl md:text-[30px] font-extrabold tracking-[-0.04em] text-slate-900 leading-none">
                {title}
              </h1>
              <p className="text-[13px] font-medium text-slate-500 mt-2">
                Welcome back, {user?.fullName?.split(' ')[0] || user?.fullName}
                <span className="hidden sm:inline text-slate-300 mx-1.5">—</span>
                <span className="hidden sm:inline text-slate-500">here&apos;s what&apos;s happening today</span>
              </p>
            </div>
          ) : null}
          <button
            onClick={() => setIsOpen((value) => !value)}
            aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
            className="md:hidden inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 ease-out shrink-0 ml-auto"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isOpen ? (
          <div className="md:hidden mt-4 mb-6 shrink-0 rounded-2xl bg-white border border-slate-200 shadow-md p-4 max-h-[42vh] overflow-y-auto">
            {navContent}
          </div>
        ) : null}

        <motion.div
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}

export default AppShell
