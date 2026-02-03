import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'
import { Bars3Icon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import NotificationPopover from '../UI/NotificationPopover'
import GlobalSearchModal from '../Modals/GlobalSearchModal'

const MainLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    // Lock Body Scroll when sidebar is open (Mobile)
    useEffect(() => {
        if (isSidebarOpen && window.innerWidth < 1024) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [isSidebarOpen])

    // Keyboard Shortcut for Search (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsSearchOpen(true)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-800 flex flex-col lg:block">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="flex-1 lg:ml-72 p-4 lg:p-8 min-h-screen transition-all duration-300">

                {/* Header (Search, Notifications, Mobile Toggle) */}
                <header className="flex justify-between items-center mb-6 lg:mb-8 sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md py-3 lg:static lg:bg-transparent lg:py-0 px-1 sm:px-0">
                    <div className="flex items-center gap-3">
                        {/* Mobile Toggle Button */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <Bars3Icon className="w-6 h-6" />
                        </button>

                        <h1 className="text-lg sm:text-xl lg:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight uppercase">
                            DIGIANCHORZ
                        </h1>
                    </div>

                    <div className="flex items-center space-x-1 lg:space-x-4">
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="p-2 text-slate-400 hover:text-slate-600 transition rounded-full hover:bg-white hover:shadow-sm"
                            title="Search (Ctrl+K)"
                        >
                            <MagnifyingGlassIcon className="w-6 h-6" />
                        </button>
                        <NotificationPopover />
                    </div>
                </header>

                <div className="animate-fade-in-up">
                    <Outlet />
                </div>
            </main>

            <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </div>
    )
}

export default MainLayout
