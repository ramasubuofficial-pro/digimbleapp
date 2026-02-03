import { Link, useLocation } from 'react-router-dom'
import {
    HomeIcon,
    ClipboardDocumentListIcon,
    FolderIcon,
    ClockIcon,
    CalendarIcon,
    ChartBarIcon,
    UsersIcon,
    Cog6ToothIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import clsx from 'clsx'

const Sidebar = ({ isOpen, onClose }) => {
    const { pathname } = useLocation()
    const { user, signOut, isAdmin } = useAuth()

    const navItems = [
        { name: 'Dashboard', path: '/', icon: HomeIcon },
        { name: 'Tasks', path: '/tasks', icon: ClipboardDocumentListIcon },
        { name: 'Projects', path: '/projects', icon: FolderIcon },
        { name: 'Attendance', path: '/attendance', icon: ClockIcon },
        { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
    ]

    // Admin only items
    if (isAdmin) {
        navItems.push({ name: 'Reports', path: '/reports', icon: ChartBarIcon })
    }

    // Everyone sees Team & Settings
    navItems.push({ name: 'Team', path: '/team', icon: UsersIcon })
    navItems.push({ name: 'Settings', path: '/settings', icon: Cog6ToothIcon })

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 h-full w-72 bg-white border-r border-slate-100 flex flex-col z-50 transition-transform duration-300 ease-in-out transform shadow-2xl lg:shadow-none",
                // Mobile: Default hidden (-translate-x-full), Open (translate-x-0)
                // Desktop: Always visible (translate-x-0)
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                <div className="p-6 flex items-center justify-between border-b border-slate-50">
                    <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
                            D
                        </div>
                        <span className="font-black text-slate-800 text-lg tracking-tighter uppercase truncate">DIGIANCHORZ</span>
                    </div>
                    {/* Close Button (Mobile Only) */}
                    <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-1.5 mt-6 overflow-y-auto no-scrollbar">
                    {navItems.map((item) => {
                        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path))
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                onClick={() => onClose && window.innerWidth < 1024 && onClose()} // Close on mobileNav
                                className={clsx(
                                    "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium",
                                    isActive
                                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                                        : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                                )}
                            >
                                <item.icon className={clsx("w-5 h-5", isActive ? "text-white" : "group-hover:text-emerald-600")} />
                                <span>{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center p-3 rounded-xl hover:bg-slate-50 transition cursor-pointer group">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold mr-3 border-2 border-white shadow-sm overflow-hidden min-w-[2.5rem]">
                            {(user?.avatar_url || user?.user_metadata?.avatar_url) ? (
                                <img src={user?.avatar_url || user?.user_metadata?.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span>{(user?.full_name?.[0] || user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-800 truncate">
                                {user?.full_name || user?.user_metadata?.full_name || 'User'}
                            </h4>
                            <button onClick={signOut} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center mt-0.5">
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    )
}

export default Sidebar
