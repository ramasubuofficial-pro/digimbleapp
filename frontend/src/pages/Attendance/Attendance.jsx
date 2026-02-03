import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Modal from '../../components/UI/Modal'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { format } from 'date-fns'
import { MapPinIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useToast } from '../../contexts/ToastContext'

// Fix Leaflet Marker Icon
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

function MapUpdater({ center, zoom }) {
    const map = useMap()
    useEffect(() => {
        if (center) {
            map.setView(center, zoom)
            map.invalidateSize()
        }
    }, [center, zoom, map])
    return null
}

export default function Attendance() {
    // State
    const { addToast } = useToast()
    const [status, setStatus] = useState('loading') // loading, not_punched, punched_in, completed
    const [todayData, setTodayData] = useState(null)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [loading, setLoading] = useState(true)

    // History
    const [history, setHistory] = useState([])
    const [histMonth, setHistMonth] = useState(new Date().getMonth() + 1)
    const [histYear, setHistYear] = useState(new Date().getFullYear())

    // Location Modal
    const [isLocModalOpen, setIsLocModalOpen] = useState(false)
    const [locData, setLocData] = useState({ lat: 0, lng: 0, acc: 0, address: 'Detecting...' })
    const [isLocating, setIsLocating] = useState(false)
    const [isPunching, setIsPunching] = useState(false)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        loadToday()
        loadHistory()
    }, [histMonth, histYear])

    const loadToday = async () => {
        try {
            const res = await axios.get('/api/attendance/today')
            setTodayData(res.data)

            if (!res.data) {
                setStatus('not_punched')
            } else if (res.data.punch_out) {
                setStatus('completed')
            } else {
                setStatus('punched_in')
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const loadHistory = async () => {
        try {
            const res = await axios.get(`/api/attendance/history?month=${histMonth}&year=${histYear}`)
            setHistory(res.data)
        } catch (e) { console.error(e) }
    }

    // --- Geolocation Logic ---
    const resolveLocationName = async (lat, lon) => {
        try {
            const res = await axios.get(`/api/reverse-geocode`, {
                params: { lat, lon }
            })

            if (res.data && res.data.location) {
                return res.data.location
            }
        } catch (e) { console.warn("Backend Geo failed", e) }
        return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
    }

    const handlePunchClick = () => {
        if (status === 'completed') return
        setIsLocating(true)

        if (!navigator.geolocation) {
            addToast("Geolocation not supported", "error")
            setIsLocating(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude, accuracy } = pos.coords
                const address = await resolveLocationName(latitude, longitude)

                setLocData({
                    lat: latitude,
                    lng: longitude,
                    acc: accuracy,
                    address
                })
                setIsLocating(false)
                setIsLocModalOpen(true)
            },
            (err) => {
                console.warn("High Accuracy Geo failed. Retrying Low Accuracy...", err)
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const { latitude, longitude, accuracy } = pos.coords
                        const address = await resolveLocationName(latitude, longitude)
                        setLocData({ lat: latitude, lng: longitude, acc: accuracy, address })
                        setIsLocating(false)
                        setIsLocModalOpen(true)
                    },
                    (errFinal) => {
                        addToast("Unable to retrieve location.", "error")
                        setIsLocating(false)
                    },
                    { enableHighAccuracy: false, timeout: 10000 }
                )
            },
            { enableHighAccuracy: true, timeout: 5000 }
        )
    }

    const confirmPunch = async () => {
        setIsPunching(true)
        try {
            await axios.post('/api/attendance/punch', { location: locData.address })
            setIsLocModalOpen(false)
            loadToday()
            loadHistory()
            addToast(`Successfully ${status === 'not_punched' ? 'punched in' : 'punched out'}!`, 'success')
        } catch (e) { addToast(e.response?.data?.error || 'Error punching', 'error') }
        finally { setIsPunching(false) }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Attendance</h1>
                    <p className="text-slate-500 mt-1">Track your daily work hours.</p>
                </div>
                <div className="text-right mt-4 md:mt-0">
                    <div className="text-2xl font-bold text-emerald-600 font-mono">
                        {currentTime.toLocaleTimeString()}
                    </div>
                    <div className="text-sm text-slate-500">
                        {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Punch Card */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-6">
                    <div className={`px-4 py-1 rounded-full text-sm font-semibold 
                        ${status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                            status === 'punched_in' ? 'bg-amber-100 text-amber-600' :
                                'bg-slate-100 text-slate-500'}`}>
                        {status === 'completed' ? 'Day Completed' :
                            status === 'punched_in' ? 'Checked In' :
                                'Not Checked In'}
                    </div>

                    <div className="relative cursor-pointer group">
                        {status !== 'completed' && (
                            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                        )}
                        <button
                            onClick={handlePunchClick}
                            disabled={status === 'completed' || isLocating}
                            className={`relative w-48 h-48 rounded-full bg-white flex flex-col items-center justify-center border-4 ${status === 'completed' ? 'border-slate-100' : 'border-emerald-50'} shadow-xl transition-transform transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isLocating ? (
                                <span className="animate-pulse text-slate-500">Locating...</span>
                            ) : (
                                <>
                                    <ClockIcon className={`w-12 h-12 mb-2 ${status === 'completed' ? 'text-slate-400' : 'text-emerald-500'}`} />
                                    <span className="text-xl font-bold text-slate-700">
                                        {status === 'not_punched' ? 'Punch In' :
                                            status === 'punched_in' ? 'Punch Out' : 'Completed'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-sm text-center text-slate-500 max-w-xs">
                        {status === 'completed' ? 'You worked today. Great job!' :
                            status === 'punched_in' ? `Pxunched in at ${format(new Date(todayData.punch_in), 'h:mm a')}. Click to punch out.` :
                                'Click to mark your attendance for today.'}
                    </p>
                </div>

                {/* History */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                        <h3 className="text-xl font-bold text-slate-700">Attendance History</h3>
                        <div className="flex space-x-2">
                            <select
                                value={histMonth}
                                onChange={(e) => setHistMonth(parseInt(e.target.value))}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                                ))}
                            </select>
                            <select
                                value={histYear}
                                onChange={(e) => setHistYear(parseInt(e.target.value))}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-slate-500 border-b border-slate-200">Date</th>
                                    <th className="p-3 text-sm font-semibold text-slate-500 border-b border-slate-200">Punch In</th>
                                    <th className="p-3 text-sm font-semibold text-slate-500 border-b border-slate-200">In Location</th>
                                    <th className="p-3 text-sm font-semibold text-slate-500 border-b border-slate-200">Punch Out</th>
                                    <th className="p-3 text-sm font-semibold text-slate-500 border-b border-slate-200">Out Location</th>
                                    <th className="p-3 text-sm font-semibold text-slate-500 border-b border-slate-200">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700 text-sm">
                                {history.length === 0 ? (
                                    <tr><td colSpan="6" className="p-4 text-center text-slate-400">No records found.</td></tr>
                                ) : (
                                    history.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
                                            <td className="p-3 align-top">{format(new Date(row.date), 'MMM d, yyyy')}</td>
                                            <td className="p-3 font-mono align-top">{row.punch_in ? format(new Date(row.punch_in), 'h:mm a') : '-'}</td>
                                            <td className="p-3 text-xs text-slate-500 max-w-[150px] align-top truncate" title={row.location}>{row.location || '-'}</td>
                                            <td className="p-3 font-mono align-top">{row.punch_out ? format(new Date(row.punch_out), 'h:mm a') : '-'}</td>
                                            <td className="p-3 text-xs text-slate-500 max-w-[150px] align-top truncate" title={row.punch_out_location}>{row.punch_out_location || '-'}</td>
                                            <td className={`p-3 font-semibold align-top ${row.status === 'Present' ? 'text-emerald-600' : 'text-slate-600'}`}>{row.status}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Location Confirmation Modal */}
            <Modal isOpen={isLocModalOpen} onClose={() => setIsLocModalOpen(false)} title="Confirm Location" size="max-w-lg">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Please verify your exact location on the map.</p>

                    <div className="h-48 rounded-xl overflow-hidden border border-slate-200 relative z-0">
                        {isLocModalOpen && (
                            <MapContainer center={[locData.lat, locData.lng]} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />
                                <Marker position={[locData.lat, locData.lng]} />
                                <Circle center={[locData.lat, locData.lng]} radius={locData.acc} pathOptions={{ fillColor: '#10b981', color: '#10b981' }} />
                                <MapUpdater center={[locData.lat, locData.lng]} zoom={16} />
                            </MapContainer>
                        )}
                    </div>

                    <div className="w-full text-sm p-3 rounded-xl bg-emerald-50 text-emerald-800 font-medium flex items-center justify-start space-x-2 border border-emerald-100">
                        <MapPinIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span className="text-left break-words line-clamp-2">{locData.address}</span>
                    </div>

                    <div className="flex space-x-3 mt-6">
                        <button onClick={() => setIsLocModalOpen(false)} className="flex-1 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100 border border-slate-200">
                            Cancel
                        </button>
                        <button
                            onClick={confirmPunch}
                            disabled={isPunching}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-md disabled:opacity-50"
                        >
                            {isPunching ? 'Punching...' : 'Confirm & Punch'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
