import { useState, useEffect } from 'react'
import { Popover } from '@headlessui/react'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import axios from 'axios'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { useToast } from '../../contexts/ToastContext'

export default function NotificationPopover() {
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const { addToast } = useToast()

    const fetchNotifications = async () => {
        setLoading(true)
        try {
            const res = await axios.get('/api/notifications')
            const newNotifs = res.data.notifications || []
            const newUnreadCount = res.data.unread_count || 0

            // If unread count increased, show toast for the latest one
            if (newUnreadCount > unreadCount && newNotifs.length > 0) {
                const latest = newNotifs[0]
                if (!latest.is_read) {
                    addToast(latest.message, 'info')
                }
            }

            setNotifications(newNotifs)
            setUnreadCount(newUnreadCount)
        } catch (e) {
            console.error("Failed to fetch notifications", e)
        } finally {
            setLoading(false)
        }
    }

    // Initial load
    useEffect(() => {
        fetchNotifications()
        // Poll every 60s
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    const markAsRead = async (id) => {
        try {
            await axios.post(`/api/notifications/${id}/read`)
            // Optimistic update
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (e) { console.error(e) }
    }

    const markAllRead = async () => {
        try {
            await axios.post('/api/notifications/read-all')
            setNotifications(notifications.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        } catch (e) { console.error(e) }
    }

    return (
        <Popover>
            {({ open }) => (
                <>
                    <Popover.Button
                        onClick={() => !open && fetchNotifications()} // Refresh on open
                        className={`p-2 rounded-full transition relative focus:outline-none ${open ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-slate-600 hover:bg-white hover:shadow-sm'}`}
                    >
                        <BellIcon className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-slate-50 flex items-center justify-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </Popover.Button>

                    <Popover.Panel
                        anchor="bottom end"
                        transition
                        className="z-50 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
                    >
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center"
                                >
                                    <CheckIcon className="w-3 h-3 mr-1" />
                                    Mark all read
                                </button>
                            )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {loading && notifications.length === 0 && (
                                <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                            )}

                            {!loading && notifications.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No notifications yet.
                                </div>
                            )}

                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={!notif.is_read ? () => markAsRead(notif.id) : undefined}
                                    className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition cursor-pointer ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`text-sm ${!notif.is_read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>{notif.title}</h4>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                            {notif.created_at ? format(new Date(notif.created_at), 'MMM d, h:mm a') : ''}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                                    {notif.link && (
                                        <Link
                                            to={notif.link}
                                            onClick={() => markAsRead(notif.id)}
                                            className="text-[10px] text-emerald-600 hover:underline mt-2 inline-block font-medium"
                                        >
                                            View details &rarr;
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Popover.Panel>
                </>
            )}
        </Popover>
    )
}
