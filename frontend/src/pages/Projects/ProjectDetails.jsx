import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import Modal from '../../components/UI/Modal'
import TaskDetailsModal from '../../components/Modals/TaskDetailsModal'
import ViewTaskModal from '../../components/Modals/ViewTaskModal'
import ConfirmationModal from '../../components/UI/ConfirmationModal'
import {
    CalendarIcon,
    UserGroupIcon,
    CheckCircleIcon,
    ClockIcon,
    PlusIcon,
    ArrowLeftIcon,
    TrashIcon,
    PencilSquareIcon,
    EyeIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function ProjectDetails() {
    const { id } = useParams()
    const { isAdmin } = useAuth()
    const { addToast } = useToast()
    const [project, setProject] = useState(null)
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('board') // board, team, settings

    // Modals
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState(null)
    const [taskToDelete, setTaskToDelete] = useState(null)

    // View Modal
    const [isViewTaskModalOpen, setIsViewTaskModalOpen] = useState(false)
    const [viewingTask, setViewingTask] = useState(null)

    // Data for modals
    const [allUsers, setAllUsers] = useState([])

    useEffect(() => {
        fetchData()
        fetchUsers() // Fetch full team for assignments
    }, [id])

    const fetchData = async () => {
        try {
            const [pRes, tRes] = await Promise.all([
                axios.get(`/api/projects/${id}`),
                axios.get(`/api/projects/${id}/tasks`)
            ])
            setProject(pRes.data)
            setTasks(tRes.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const fetchUsers = async () => {
        if (allUsers.length > 0) return
        try {
            const res = await axios.get('/api/team')
            setAllUsers(res.data)
        } catch (e) { console.error(e) }
    }

    // --- Actions ---
    const handleCreateTask = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        const payload = {
            project_id: id,
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            assigned_to: formData.get('assigned_to'),
            deadline: formData.get('deadline') ? new Date(formData.get('deadline')).toISOString() : null
        }

        try {
            await axios.post('/api/tasks', payload)
            setIsTaskModalOpen(false)
            fetchData() // Refresh tasks
            addToast('Task created successfully!', 'success')
        } catch (e) { addToast(e.response?.data?.error || 'Error creating task', 'error') }
    }

    const handleUpdateTaskDetails = async (updatedTask) => {
        try {
            const payload = {
                title: updatedTask.title,
                description: updatedTask.description,
                priority: updatedTask.priority,
                status: updatedTask.status,
                project_id: updatedTask.project_id || id, // Default to current project if not set
                assigned_to: updatedTask.assigned_to,
                deadline: updatedTask.deadline
            }

            await axios.patch(`/api/tasks/${updatedTask.id}`, payload)

            // Optimistic update
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? {
                ...t,
                ...payload,
                assignee: project.members?.find(m => m.id == payload.assigned_to) || t.assignee
            } : t))

            setIsEditTaskModalOpen(false)
            setEditingTask(null)
            addToast('Task updated successfully!', 'success')
        } catch (e) {
            console.error(e)
            addToast(e.response?.data?.error || 'Error updating task', 'error')
        }
    }

    // Handler to delete from within the edit modal
    const handleDeleteFromModal = (task) => {
        setIsEditTaskModalOpen(false)
        setEditingTask(null)
        handleDeleteTask(task)
    }

    const handleDeleteTask = (task) => {
        setTaskToDelete(task)
        setIsDeleteModalOpen(true)
    }

    const confirmDeleteTask = async () => {
        if (!taskToDelete) return
        try {
            await axios.delete(`/api/tasks/${taskToDelete.id}`)
            setTasks(tasks.filter(t => t.id !== taskToDelete.id))
            setIsDeleteModalOpen(false)
            setTaskToDelete(null)
            addToast('Task deleted successfully', 'success')
        } catch (e) {
            console.error(e)
            addToast('Error deleting task', 'error')
        }
    }

    const handleAddMember = async (e) => {
        e.preventDefault()
        const userId = e.target.user_id.value
        try {
            await axios.post(`/api/projects/${id}/members`, { user_id: userId })
            setIsMemberModalOpen(false)
            fetchData() // Refresh project
            addToast('Member added successfully!', 'success')
        } catch (e) { addToast('Error adding member', 'error') }
    }

    const moveTask = async (taskId, currentStatus) => {
        const nextStatus = currentStatus === 'To Do' ? 'In Progress' : (currentStatus === 'In Progress' ? 'Completed' : 'To Do')
        // Optimistic
        const oldTasks = [...tasks]
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: nextStatus } : t))

        try {
            await axios.patch(`/api/tasks/${taskId}`, { status: nextStatus })
        } catch (e) {
            setTasks(oldTasks)
            console.error(e)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading project...</div>
    if (!project) return <div className="p-8 text-center text-red-500">Project not found.</div>

    // Kanban Columns
    const todoTasks = tasks.filter(t => t.status === 'To Do')
    const progressTasks = tasks.filter(t => t.status === 'In Progress')
    const completedTasks = tasks.filter(t => t.status === 'Completed')

    const TaskCard = ({ task }) => (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition group relative">
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${task.priority === 'High' ? 'bg-red-100 text-red-600' :
                    (task.priority === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600')
                    }`}>{task.priority}</span>
                <div className="flex space-x-1">
                    <button
                        onClick={() => { setViewingTask({ ...task, project_name: project.title }); setIsViewTaskModalOpen(true); }}
                        className="text-slate-300 hover:text-emerald-500 p-1 rounded hover:bg-slate-50 lg:opacity-0 lg:group-hover:opacity-100 transition"
                        title="View Task"
                    >
                        <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setEditingTask(task); setIsEditTaskModalOpen(true); }}
                        className="text-slate-300 hover:text-emerald-500 p-1 rounded hover:bg-slate-50 lg:opacity-0 lg:group-hover:opacity-100 transition"
                        title="Edit Task"
                    >
                        <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDeleteTask(task)}
                        className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-slate-50 lg:opacity-0 lg:group-hover:opacity-100 transition"
                        title="Delete Task"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveTask(task.id, task.status)} className="text-slate-300 hover:text-blue-500 p-1 lg:hidden lg:group-hover:block" title="Move to next status">
                        <ArrowLeftIcon className="w-4 h-4 rotate-180" />
                    </button>
                </div>
            </div>
            <h4
                onClick={() => { setViewingTask({ ...task, project_name: project.title }); setIsViewTaskModalOpen(true); }}
                className="font-semibold text-slate-800 text-sm mb-1 cursor-pointer hover:text-emerald-600 transition"
            >
                {task.title}
            </h4>
            <div className="flex items-center justify-between mt-3">
                <div className="flex -space-x-2">
                    {task.assignee ? (
                        <img
                            src={task.assignee.avatar_url || `https://ui-avatars.com/api/?name=${task.assignee.full_name}`}
                            className="w-6 h-6 rounded-full border-2 border-white"
                            title={task.assignee.full_name}
                        />
                    ) : <span className="text-xs text-slate-300 italic">Unassigned</span>}
                </div>
                <span className="text-xs text-slate-400 font-medium">
                    {format(new Date(task.created_at), 'MMM d')}
                </span>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center space-x-2 text-sm text-slate-500 mb-2">
                    <Link to="/projects" className="hover:text-emerald-600">Projects</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-medium">{project.title}</span>
                </div>
                <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">{project.title}</h1>
                        <p className="text-slate-500 max-w-2xl">{project.description}</p>
                        <div className="flex items-start gap-8 mt-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Timeline</h4>
                                <div className="flex items-center text-sm font-medium text-slate-700">
                                    <CalendarIcon className="w-4 h-4 mr-2 text-slate-400" />
                                    <span>
                                        {project.start_date ? format(new Date(project.start_date), 'MMM d') : 'TBD'} -
                                        {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'TBD'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Team</h4>
                                <div className="flex -space-x-2">
                                    {project.members && project.members.map((m, i) => (
                                        <img key={i} src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.full_name}`} className="w-8 h-8 rounded-full border-2 border-white" title={m.full_name} />
                                    ))}
                                    {(!project.members || project.members.length === 0) && <span className="text-xs text-slate-400 italic">No members</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {isAdmin && (
                            <button
                                onClick={() => { fetchUsers(); setIsMemberModalOpen(true) }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition flex items-center"
                            >
                                <UserGroupIcon className="w-5 h-5 mr-2" />
                                Add Member
                            </button>
                        )}
                        <button
                            onClick={() => { fetchUsers(); setIsTaskModalOpen(true) }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 transition flex items-center"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            Add Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex overflow-x-auto pb-4 space-x-6 h-[calc(100vh-350px)]">
                {/* To Do */}
                <div className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200">
                    <div className="p-4 flex items-center justify-between border-b border-white/50">
                        <h3 className="font-bold text-slate-700">To Do</h3>
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{todoTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {todoTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>

                {/* In Progress */}
                <div className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200">
                    <div className="p-4 flex items-center justify-between border-b border-white/50">
                        <h3 className="font-bold text-amber-700">In Progress</h3>
                        <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-xs font-bold">{progressTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {progressTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>

                {/* Completed */}
                <div className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200">
                    <div className="p-4 flex items-center justify-between border-b border-white/50">
                        <h3 className="font-bold text-emerald-700">Completed</h3>
                        <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-bold">{completedTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {completedTasks.map(t => <TaskCard key={t.id} task={t} />)}
                    </div>
                </div>
            </div>

            {/* Create Task Modal */}
            <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="New Project Task" size="max-w-lg">
                <form onSubmit={handleCreateTask} className="space-y-4">
                    <input name="title" required placeholder="Task Title" className="w-full px-4 py-2 border rounded-lg bg-slate-50 focus:bg-white transition" />
                    <textarea name="description" required placeholder="Description" rows="3" className="w-full px-4 py-2 border rounded-lg bg-slate-50 focus:bg-white transition"></textarea>

                    <div className="flex space-x-4">
                        <div className="w-1/3">
                            <select name="priority" className="w-full px-4 py-2 border rounded-lg bg-slate-50">
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                        <div className="w-1/3">
                            <select name="assigned_to" required className="w-full px-4 py-2 border rounded-lg bg-slate-50">
                                <option value="">Assignee</option>
                                {project.members && project.members.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                            </select>
                        </div>
                        <div className="w-1/3">
                            <input name="deadline" type="datetime-local" className="w-full px-2 py-2 border rounded-lg bg-slate-50" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-lg">Create Task</button>
                    </div>
                </form>
            </Modal>

            {/* Rich Edit Task Modal */}
            <TaskDetailsModal
                isOpen={isEditTaskModalOpen}
                onClose={() => { setIsEditTaskModalOpen(false); setEditingTask(null); }}
                task={editingTask}
                projects={[project]} // Pass current project as the only option
                team={allUsers.length > 0 ? allUsers : (project.members || [])}
                onUpdate={handleUpdateTaskDetails}
                onDelete={handleDeleteFromModal}
            />

            {/* Simple View Task Modal */}
            <ViewTaskModal
                isOpen={isViewTaskModalOpen}
                onClose={() => { setIsViewTaskModalOpen(false); setViewingTask(null); }}
                task={viewingTask}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => { setIsDeleteModalOpen(false); setTaskToDelete(null); }}
                onConfirm={confirmDeleteTask}
                title="Confirm Deletion"
                message={<>Are you sure you want to delete <span className="font-bold text-slate-800">{taskToDelete?.title}</span>? This action cannot be undone.</>}
                confirmText="Delete Permanently"
                isDanger={true}
            />

            {/* Add Member Modal */}
            <Modal isOpen={isMemberModalOpen} onClose={() => setIsMemberModalOpen(false)} title="Add Team Member" size="max-w-sm">
                <form onSubmit={handleAddMember} className="space-y-4">
                    <p className="text-sm text-slate-500">Select a user to add to this project.</p>
                    <select name="user_id" required className="w-full px-4 py-2 border rounded-lg bg-slate-50">
                        <option value="">Select User...</option>
                        {allUsers.map(u => (
                            <option key={u.id} value={u.id} disabled={project.members?.some(m => m.id === u.id)}>
                                {u.full_name || u.email}
                            </option>
                        ))}
                    </select>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsMemberModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-lg">Add Member</button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
