import { Link, NavLink } from 'react-router-dom'
import { LogOut, Menu, UserCircle2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const NavItem = ({ item, onNavigate, mobile = false }) => {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl transition-all duration-200 ease-out border ${
          mobile
            ? `px-3.5 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm py-3'
                  : 'text-slate-700 border-transparent hover:bg-slate-100 hover:text-slate-900 font-medium py-3'
              }`
            : `px-3 py-2.5 text-[13.5px] leading-none ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm'
                  : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 hover:border-slate-100 font-medium'
              }`
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex items-center justify-center rounded-lg shrink-0 transition-all duration-200 ${
              mobile ? 'w-9 h-9' : 'w-7 h-7'
            } ${
              isActive
                ? 'bg-white border border-indigo-200 text-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-500 border border-transparent group-hover:bg-white group-hover:text-slate-700 group-hover:border-slate-200 group-hover:shadow-sm'
            }`}
          >
            <item.icon size={mobile ? 18 : 14} strokeWidth={isActive ? 2.4 : 1.9} />
          </span>
          <span className={`truncate ${mobile ? 'text-[15px] leading-tight' : ''}`}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

const NavContent = ({ groups = [], navItems = [], onNavigate, mobile = false }) => {
  return (
    <nav className={`space-y-6 overflow-y-auto flex-1 min-h-0 -mx-2 px-2 pr-1 [scrollbar-width:thin] ${mobile ? 'mt-4 space-y-7 pb-4' : 'mt-6 space-y-7'}`}>
      {navItems.length ? (
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} mobile={mobile} />
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <p className={`px-3 mb-2 font-bold uppercase text-slate-400 ${mobile ? 'text-[11px] tracking-[0.16em]' : 'text-[10px] tracking-[0.14em]'}`}>
              {group.label}
            </p>
            <div className={`space-y-1.5 ${mobile ? 'space-y-1.5' : 'space-y-1'}`}>
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onNavigate} mobile={mobile} />
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

  const navContent = (mobile = false) => (
    <div className={`flex flex-col min-h-0 ${mobile ? 'h-full' : 'h-full'}`}>
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

      <NavContent groups={groups} navItems={navItems} onNavigate={onNavigate} mobile={mobile} />

      <div className={`pt-4 border-t border-slate-100 shrink-0 ${mobile ? 'mt-2 pb-[max(1rem,env(safe-area-inset-bottom))]' : 'mt-4'}`}>
        <button
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2.5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm transition-all duration-200 ease-out active:scale-[0.98]"
        >
          <LogOut size={16} className="text-slate-500" /> Sign Out
        </button>
        {!mobile && <p className="text-center text-[10px] font-medium tracking-wide text-slate-400 mt-3">© 2026 Grace Theological Seminary</p>}
      </div>
    </div>
  )

  return (
    <div className="h-[100dvh] overflow-hidden md:grid md:grid-cols-[276px_1fr] bg-[#F8FAFC]">
      {/* Sidebar — LIGHT bento (desktop) */}
      <aside className="hidden md:flex h-[100dvh] bg-white border-r border-slate-200 p-5 flex-col overflow-hidden shrink-0">
        {navContent(false)}
      </aside>

      {/* Main — single-viewport preserved */}
      <main className="h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-[#F8FAFC] p-4 md:p-6 lg:p-8">
        {/* Mobile top bar — sticky, always shows the menu */}
        <div className="flex items-start justify-between gap-4 shrink-0">
          {title !== "Forms" ? (
            <div className="min-w-0">
              <h1 className="font-display text-[22px] sm:text-2xl md:text-[30px] font-extrabold tracking-[-0.04em] text-slate-900 leading-none">
                {title}
              </h1>
              <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 mt-2">
                Welcome back, {user?.fullName?.split(' ')[0] || user?.fullName}
                <span className="hidden sm:inline text-slate-300 mx-1.5">—</span>
                <span className="hidden sm:inline text-slate-500">here&apos;s what&apos;s happening today</span>
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Avatar shortcut on mobile — opens the drawer */}
            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open navigation"
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-slate-200 text-indigo-600 shadow-sm active:scale-[0.97] transition-all duration-200 ease-out"
            >
              <UserCircle2 size={20} />
            </button>
            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open navigation"
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-sm active:scale-[0.97] transition-all duration-200 ease-out"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        <motion.div
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile drawer — slide-over nav */}
      <AnimatePresence>
        {isOpen ? (
          <div className="md:hidden fixed inset-0 z-50">
            <motion.div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              className="absolute left-0 top-0 h-[100dvh] w-[86vw] max-w-[340px] bg-white border-r border-slate-200 shadow-2xl p-5 flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              role="dialog"
              aria-label="Navigation"
            >
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-[0.97] transition-all duration-200"
              >
                <X size={18} />
              </button>
              {navContent(true)}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default AppShell
