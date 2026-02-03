import { useState, useEffect } from 'react'
import axios from 'axios'
import Modal from '../../components/UI/Modal'
import TaskDetailsModal from '../../components/Modals/TaskDetailsModal'
import ViewTaskModal from '../../components/Modals/ViewTaskModal'
import ConfirmationModal from '../../components/UI/ConfirmationModal'
import {
    PlusIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    EyeIcon,
    ChevronDownIcon,
    ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { format, isPast, isToday, isTomorrow } from 'date-fns'

export default function Tasks() {
    const { user } = useAuth()
    const { addToast } = useToast()
    const [tasks, setTasks] = useState([])
    const [projects, setProjects] = useState([])
    const [team, setTeam] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('')

    // Create Modal
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'Medium', project_id: '', assigned_to: '', deadline: '' })

    // Edit Modal (Rich Details)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [taskToEdit, setTaskToEdit] = useState(null)

    // Delete Confirmation
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState(null)

    // View Modal (Simple Read-Only) - User might generic view, but Edit is now Rich
    const [selectedTask, setSelectedTask] = useState(null)
    const [isViewOpen, setIsViewOpen] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [tasksRes, projectsRes, teamRes] = await Promise.all([
                axios.get('/api/tasks'),
                axios.get('/api/projects'),
                axios.get('/api/team')
            ])
            setTasks(tasksRes.data)
            setProjects(projectsRes.data)
            setTeam(teamRes.data)
        } catch (e) {
            console.error("Fetch Data Error:", e)
            const status = e.response?.status ? `(${e.response.status})` : ''
            const errorMsg = e.response?.data?.error || e.message || 'Unknown Error'
            addToast(`Failed to load data: ${errorMsg} ${status}`, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        try {
            await axios.post('/api/tasks', newTask)
            setIsCreateOpen(false)
            setNewTask({ title: '', description: '', priority: 'Medium', project_id: '', assigned_to: '', deadline: '' })
            fetchData()
            addToast('Task created successfully!', 'success')
        } catch (e) {
            addToast(e.response?.data?.error || 'Error creating task', 'error')
        }
    }

    const handleEditClick = (task) => {
        setTaskToEdit(task)
        setIsEditOpen(true)
    }

    const handleUpdateTaskDetails = async (updatedTask) => {
        try {
            // Format deadline if necessary or send as is depending on backend
            // The modal sends back the Full task object with updates
            const payload = {
                title: updatedTask.title,
                description: updatedTask.description,
                priority: updatedTask.priority,
                status: updatedTask.status,
                project_id: updatedTask.project_id,
                assigned_to: updatedTask.assigned_to,
                deadline: updatedTask.deadline
            }

            await axios.patch(`/api/tasks/${updatedTask.id}`, payload)

            // Update local state optimizing performance
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...t, ...payload, assignee: team.find(m => m.id == payload.assigned_to) || t.assignee, project: projects.find(p => p.id == payload.project_id) || t.project } : t))

            setIsEditOpen(false)
            setTaskToEdit(null)
            addToast('Task updated successfully!', 'success')
        } catch (e) {
            console.error(e)
            addToast(e.response?.data?.error || 'Error updating task', 'error')
        }
    }

    const handleDeleteFromModal = (task) => {
        setIsEditOpen(false)
        setTaskToEdit(null)
        handleDeleteClick(task)
    }

    const handleUpdateStatus = async (taskId, newStatus) => {
        try {
            await axios.patch(`/api/tasks/${taskId}`, { status: newStatus })
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
            addToast(`Updated to ${newStatus}`, 'success')
        } catch (e) {
            addToast('Failed to update status', 'error')
        }
    }

    const confirmDelete = async () => {
        if (!taskToDelete) return
        try {
            await axios.delete(`/api/tasks/${taskToDelete.id}`)
            setTasks(prev => prev.filter(t => t.id !== taskToDelete.id))
            setIsDeleteOpen(false)
            setTaskToDelete(null)
            addToast('Task deleted successfully', 'success')
        } catch (e) {
            addToast('Error deleting task', 'error')
        }
    }

    const handleDeleteClick = (task) => {
        setTaskToDelete(task)
        setIsDeleteOpen(true)
    }

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.project?.title?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = !filterStatus || t.status === filterStatus
        return matchesSearch && matchesStatus
    })

    const getDeadlineStyle = (date, status) => {
        if (!date) return { text: '-', color: 'text-slate-400' }
        if (status === 'Completed') return { text: format(new Date(date), 'MMM d, yyyy'), color: 'text-slate-400 line-through' }

        const d = new Date(date)
        if (isPast(d) && !isToday(d)) return { text: `${format(d, 'MMM d')} (Overdue)`, color: 'text-red-500 font-bold' }
        if (isToday(d)) return { text: 'Today', color: 'text-orange-500 font-bold' }
        if (isTomorrow(d)) return { text: 'Tomorrow', color: 'text-amber-500 font-medium' }

        return { text: format(d, 'MMM d'), color: 'text-slate-600' }
    }

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
    )

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">All Tasks</h2>
                    <p className="text-slate-500 font-medium text-sm">Centralized task management for all projects.</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/30 active:scale-95"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add New Task
                </button>
            </header>

            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tasks or projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
                    {['', 'To Do', 'In Progress', 'Completed'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterStatus === status
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            {status || 'All Tasks'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tasks Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Task Details</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Project</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Priority</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assignee</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Due Date</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredTasks.map(task => {
                                const deadline = getDeadlineStyle(task.deadline, task.status)
                                return (
                                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-slate-800 line-clamp-1">{task.title}</div>
                                            <div className="text-xs text-slate-400 font-medium line-clamp-1 mt-0.5">{task.description || 'No description'}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                {task.project?.title || 'Personal'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="relative inline-block">
                                                <select
                                                    value={task.status}
                                                    onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                                                    className={`appearance-none text-[10px] font-black border-none rounded-full px-4 py-1.5 focus:ring-0 pr-8 cursor-pointer shadow-sm transition-all ${task.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                                        task.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}
                                                >
                                                    <option value="To Do">TO DO</option>
                                                    <option value="In Progress">IN PROGRESS</option>
                                                    <option value="Completed">COMPLETED</option>
                                                </select>
                                                <ChevronDownIcon className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${task.priority === 'High' ? 'text-red-500' :
                                                task.priority === 'Medium' ? 'text-amber-500' :
                                                    'text-emerald-500'
                                                }`}>
                                                {task.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 border-2 border-white shadow-sm overflow-hidden">
                                                    {task.assignee?.avatar_url ? (
                                                        <img src={task.assignee.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{task.assignee?.full_name?.[0] || '?'}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">
                                                    {task.assignee?.full_name?.split(' ')[0] || 'Unassigned'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className={`text-xs ${deadline.color}`}>{deadline.text}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end space-x-2 md:space-x-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { setSelectedTask(task); setIsViewOpen(true); }}
                                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditClick(task)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(task)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredTasks.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClipboardDocumentListIcon className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No tasks found</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Task">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Title</label>
                        <input required value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none" placeholder="Task name..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Project</label>
                            <select required value={newTask.project_id} onChange={e => setNewTask({ ...newTask, project_id: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20">
                                <option value="">Select Project</option>
                                <option value="personal">Personal</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                            <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20">
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Assignee</label>
                            <select value={newTask.assigned_to} onChange={e => setNewTask({ ...newTask, assigned_to: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20">
                                <option value="">Select Member</option>
                                {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Deadline</label>
                            <input type="datetime-local" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                        <textarea rows="3" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"></textarea>
                    </div>
                    <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                        <button type="button" onClick={() => setIsCreateOpen(false)} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition w-full sm:w-auto order-2 sm:order-1">Cancel</button>
                        <button type="submit" className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 transition active:scale-95 w-full sm:w-auto order-1 sm:order-2">Create Task</button>
                    </div>
                </form>
            </Modal>

            {/* View Task Modal - Simple Read Only */}
            <ViewTaskModal
                isOpen={isViewOpen}
                onClose={() => setIsViewOpen(false)}
                task={selectedTask}
            />

            {/* NEW Task Details Modal (Replaces old Edit Task) */}
            <TaskDetailsModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                task={taskToEdit}
                projects={projects}
                team={team}
                onUpdate={handleUpdateTaskDetails}
                onDelete={handleDeleteFromModal}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Task"
                message={<>Are you sure you want to delete <span className="font-bold text-slate-800">"{taskToDelete?.title}"</span> permanently? This action cannot be undone.</>}
                confirmText="Delete"
                isDanger={true}
            />
        </div>
    )
}
