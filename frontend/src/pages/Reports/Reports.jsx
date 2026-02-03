import { useState, useEffect } from 'react'
import axios from 'axios'
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function Reports() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState('')
    const [attendanceLog, setAttendanceLog] = useState([])
    const [logLoading, setLogLoading] = useState(true)

    useEffect(() => {
        fetchStats()
        fetchUsers()
        fetchAttendanceLog()
    }, [])

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/stats')
            setStats(res.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/team')
            setUsers(res.data)
        } catch (e) { console.error(e) }
    }

    const fetchAttendanceLog = async (userId = selectedUser) => {
        setLogLoading(true)
        try {
            const params = userId ? { user_id: userId } : {}
            const res = await axios.get('/api/admin/attendance-history', { params })
            setAttendanceLog(res.data)
        } catch (e) { console.error(e) }
        finally { setLogLoading(false) }
    }

    const handleUserChange = (e) => {
        const uid = e.target.value
        setSelectedUser(uid)
        fetchAttendanceLog(uid)
    }

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    )

    const taskData = stats ? {
        labels: ['To Do', 'In Progress', 'Completed'],
        datasets: [{
            label: 'Tasks',
            data: [
                stats.task_stats?.todo || 0,
                stats.task_stats?.inprogress || 0,
                stats.task_stats?.completed || 0
            ],
            backgroundColor: ['#e2e8f0', '#f59e0b', '#10b981'],
            borderRadius: 8
        }]
    } : null

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-black text-slate-800 tracking-[0.1em] uppercase">REPORTS</h1>
            </header>

            {/* Top Cards: Export & Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#1e293b] rounded-3xl p-8 text-white relative overflow-hidden group shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                        <ChartBarIcon className="w-32 h-32" />
                    </div>

                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2">Export Data</h2>
                        <p className="text-slate-400 mb-8 max-w-md">Download project metrics and task logs for external analysis.</p>

                        <div className="flex flex-wrap gap-4">
                            <a
                                href="/api/export/csv"
                                className="flex items-center px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl font-semibold transition-all group"
                            >
                                <DocumentTextIcon className="w-5 h-5 mr-3 text-slate-400 group-hover:text-white" />
                                EXPORT CSV
                            </a>
                            <button
                                onClick={() => window.print()}
                                className="flex items-center px-6 py-3 bg-[#10b981] hover:bg-[#059669] rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                            >
                                <ArrowDownTrayIcon className="w-5 h-5 mr-3" />
                                GENERATE PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <ChartBarIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">System Health</h2>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-center text-sm mb-2">
                                <span className="text-slate-500 font-medium">API LATENCY</span>
                                <span className="text-[#10b981] font-bold">45ms</span>
                            </div>
                            <div className="w-full h-2 bg-slate-50 rounded-full">
                                <div className="h-full bg-[#10b981] rounded-full w-[45%]" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center text-sm mb-2">
                                <span className="text-slate-500 font-medium">DATABASE LOAD</span>
                                <span className="text-orange-500 font-bold">12%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-50 rounded-full">
                                <div className="h-full bg-orange-500 rounded-full w-[12%]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance Table Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="p-8 pb-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-emerald-50 rounded-2xl">
                            <DocumentTextIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Team Attendance Log</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href={`/api/admin/export/attendance${selectedUser ? `?user_id=${selectedUser}` : ''}`}
                            className="bg-[#f0fdf4] text-[#10b981] px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center border border-[#dcfce7] hover:bg-emerald-100 transition-colors uppercase tracking-wider"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                            DOWNLOAD REPORT
                        </a>

                        <div className="relative">
                            <select
                                value={selectedUser}
                                onChange={handleUserChange}
                                className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none uppercase tracking-wider"
                            >
                                <option value="">All Members</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        <button
                            onClick={() => fetchAttendanceLog()}
                            className="p-2.5 bg-slate-50 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                        >
                            <ArrowPathIcon className={`w-5 h-5 ${logLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">MEMBER</th>
                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">PUNCHED IN</th>
                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">PUNCHED OUT</th>
                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">HOURS</th>
                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">STATUS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {attendanceLog.map((row, i) => {
                                // Calculate hours (approximate if both in/out exist)
                                let hours = "-- h";
                                if (row.punch_in && row.punch_out) {
                                    const diff = new Date(row.punch_out) - new Date(row.punch_in);
                                    hours = (diff / (1000 * 60 * 60)).toFixed(1) + " h";
                                }

                                return (
                                    <tr key={i} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs ring-4 ring-white shadow-sm overflow-hidden">
                                                    {(row.user_name?.[0] || '?').toUpperCase()}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{row.user_name || 'Admin'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-sm font-medium text-slate-500">
                                            {new Date(row.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="text-sm font-bold text-slate-700">
                                                {row.punch_in ? new Date(row.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                                            </div>
                                            {row.location && (
                                                <div className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]" title={row.location}>
                                                    {row.location}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-sm font-bold text-slate-700">
                                            {row.punch_out ? new Date(row.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                                        </td>
                                        <td className="px-8 py-5 text-sm font-black text-emerald-600/80">
                                            {hours}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${row.status === 'Present'
                                                    ? 'bg-[#f0fdf4] text-[#10b981]'
                                                    : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {attendanceLog.length === 0 && !logLoading && (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center text-slate-400 font-medium">
                                        No attendance records found for the selected filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Task Distribution (Optional but good to keep) */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
                <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center">
                    <ChartBarIcon className="w-6 h-6 mr-3 text-amber-500" />
                    Task Performance Distribution
                </h2>
                <div className="h-80">
                    {taskData && <Bar
                        data={taskData}
                        options={{
                            maintainAspectRatio: false,
                            responsive: true,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#1e293b',
                                    padding: 12,
                                    titleFont: { size: 14, weight: 'bold' },
                                    bodyFont: { size: 13 },
                                    cornerRadius: 12,
                                    displayColors: false
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    grid: { color: '#f1f5f9' },
                                    ticks: { font: { weight: 'bold' } }
                                },
                                x: {
                                    grid: { display: false },
                                    ticks: { font: { weight: 'bold' } }
                                }
                            }
                        }}
                    />}
                </div>
            </div>
        </div>
    )
}
