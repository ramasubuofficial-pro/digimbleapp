import { useState, useEffect } from 'react'
import axios from 'axios'
import {
    FolderIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    ChartBarIcon,
    UsersIcon,
    BriefcaseIcon,
    ArrowUpIcon,
    ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { useAuth } from '../../contexts/AuthContext'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

export default function Dashboard() {
    const { user } = useAuth()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await axios.get('/api/stats')
                setStats(res.data)
            } catch (e) {
                console.error("Dashboard Stats Fetch Error:", e)
            } finally {
                setLoading(false)
            }
        }
        fetchDashboardData()
    }, [])

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    )

    const isAdmin = user?.role === 'Admin'

    const cards = [
        {
            name: isAdmin ? 'Managed Projects' : 'My Projects',
            value: stats?.total_projects || '0',
            icon: FolderIcon,
            color: 'bg-blue-50 text-blue-600',
            bg: 'bg-blue-100/50'
        },
        {
            name: isAdmin ? 'Total Tasks' : 'My Tasks',
            value: stats?.total_tasks || '0',
            icon: ClipboardDocumentListIcon,
            color: 'bg-emerald-50 text-emerald-600',
            bg: 'bg-emerald-100/50'
        },
        {
            name: 'Pending Tasks',
            value: (stats?.task_stats?.['To Do'] || 0) + (stats?.task_stats?.['In Progress'] || 0),
            icon: ClockIcon,
            color: 'bg-orange-50 text-orange-600',
            bg: 'bg-orange-100/50'
        }
    ]

    const barData = {
        labels: ['To Do', 'In Progress', 'Completed'],
        datasets: [{
            label: 'Tasks',
            data: [
                stats?.task_stats?.['To Do'] || 0,
                stats?.task_stats?.['In Progress'] || 0,
                stats?.task_stats?.['Completed'] || 0
            ],
            backgroundColor: [
                'rgba(241, 245, 249, 1)',
                'rgba(245, 158, 11, 0.9)',
                'rgba(16, 185, 129, 0.9)'
            ],
            borderRadius: 12,
            borderWidth: 0
        }]
    }

    const lineData = {
        labels: stats?.charts?.trend?.labels || [],
        datasets: [{
            label: 'Task Activity',
            data: stats?.charts?.trend?.data || [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#fff',
            pointBorderWidth: 2
        }]
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Overview</h2>
                    <p className="text-slate-500 font-medium text-sm">Welcome back, <span className="text-emerald-600 font-bold">{user?.full_name || 'Member'}</span></p>
                </div>
                {isAdmin && (
                    <div className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200">
                        <ChartBarIcon className="w-3 h-3 mr-2" />
                        Admin Mode
                    </div>
                )}
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <div key={card.name} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{card.name}</p>
                                <h3 className="text-4xl font-black text-slate-800">{card.value}</h3>
                            </div>
                            <div className={`p-4 rounded-2xl ${card.bg} ${card.color} group-hover:rotate-6 transition-transform`}>
                                <card.icon className="w-7 h-7" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Insights Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Task Distribution */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Task Distribution</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Status</span>
                    </div>
                    <div className="h-64">
                        <Bar
                            data={barData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { beginAtZero: true, grid: { display: false }, ticks: { font: { weight: 'black', size: 10 } } },
                                    x: { grid: { display: false }, ticks: { font: { weight: 'black', size: 10 } } }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Activity Trend */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Member Activity</h3>
                        <div className="flex items-center text-[#10b981] font-bold text-xs">
                            <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                            {stats?.charts?.trend?.data?.reduce((a, b) => a + b, 0) || 0} Total Actions
                        </div>
                    </div>
                    <div className="h-64">
                        <Line
                            data={lineData}
                            options={{
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: { beginAtZero: true, grid: { color: '#f1f5f9', borderDash: [4, 4] }, ticks: { font: { weight: 'black', size: 10 } } },
                                    x: { grid: { display: false }, ticks: { font: { weight: 'black', size: 10 } } }
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* --- ADMIN ONLY: TEAM INSIGHTS --- */}
            {isAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Team Performance Table */}
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center space-x-3">
                                <div className="p-3 bg-indigo-50 rounded-2xl">
                                    <UsersIcon className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Team Insights</h3>
                            </div>
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full">INDIVIDUAL PERFORMANCE</span>
                        </div>
                        <div className="space-y-6">
                            {stats?.member_stats?.map((member, i) => (
                                <div key={i} className="flex items-center group">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs border-2 border-white shadow-sm mr-4">
                                        {member.name[0]}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm font-bold text-slate-700">{member.name}</span>
                                            <span className="text-xs font-black text-emerald-600">{Math.round((member.completed / member.total) * 100 || 0)}% Done</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${(member.completed / member.total) * 100 || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Project Performance */}
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center space-x-3">
                                <div className="p-3 bg-amber-50 rounded-2xl">
                                    <BriefcaseIcon className="w-5 h-5 text-amber-600" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Project Health</h3>
                            </div>
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full">DELIVERY PROGRESS</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {stats?.project_performance?.slice(0, 4).map((proj, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-50">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{proj.title}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">{proj.completed} / {proj.total} Tasks</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-12 h-12 flex items-center justify-center">
                                            <svg className="w-12 h-12 transform -rotate-90">
                                                <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                                                <circle cx="24" cy="24" r="20" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * proj.progress) / 100} strokeLinecap="round" />
                                            </svg>
                                            <span className="absolute text-[10px] font-black text-slate-800">{proj.progress}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
