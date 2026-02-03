import { useState, useEffect } from 'react'
import axios from 'axios'
import Modal from '../../components/UI/Modal'
import { PlusIcon, CalendarIcon, UserGroupIcon, EllipsisVerticalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function Projects() {
    const { isAdmin } = useAuth()
    const { addToast } = useToast()
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('Active')

    // Modals
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editProject, setEditProject] = useState(null)
    const [deleteId, setDeleteId] = useState(null)

    // Data for modals
    const [team, setTeam] = useState([])

    useEffect(() => {
        fetchProjects()
        fetchTeam()
    }, [])

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/projects')
            setProjects(res.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const fetchTeam = async () => {
        try {
            const res = await axios.get('/api/team')
            setTeam(res.data)
        } catch (e) {
            console.error('Fetch Team Error:', e)
            addToast(`Could not load team: ${e.response?.status || 'Network Error'}`, 'error')
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)

        const payload = {
            title: formData.get('title'),
            description: formData.get('description'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            status: 'Active',
            members: Array.from(e.target.querySelectorAll('select[name="members"] option:checked')).map(o => o.value)
        }

        try {
            await axios.post('/api/projects', payload)
            setIsCreateOpen(false)
            fetchProjects()
            addToast('Project created successfully!', 'success')
        } catch (e) {
            console.error('Create Project Error:', e)
            const msg = e.response?.data?.error || e.message || 'Unknown Error'
            addToast(`Error: ${msg} (${e.response?.status || 'Connection Failed'})`, 'error')
        }
    }

    const handleDelete = async () => {
        try {
            await axios.delete(`/api/projects/${deleteId}`)
            setDeleteId(null)
            fetchProjects()
            addToast('Project deleted successfully', 'success')
        } catch (e) { addToast('Error deleting project', 'error') }
    }

    const handleUpdateStatus = async (id, status) => {
        try {
            await axios.patch(`/api/projects/${id}`, { status })
            fetchProjects()
            addToast(`Project marked as ${status}`, 'success')
        } catch (e) {
            console.error(e)
            addToast('Failed to update status', 'error')
        }
    }

    const filteredProjects = projects.filter(p => {
        if (statusFilter === 'All') return true
        return p.status === statusFilter
    })

    if (loading) return <div className="p-8 text-center text-slate-500">Loading projects...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-bold text-slate-800">Projects</h2>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="All">All Projects</option>
                    </select>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    New Project
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                    <div key={project.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition p-6 flex flex-col h-full group relative">
                        {/* Status Badge (Admin Editable) */}
                        {isAdmin ? (
                            <Menu as="div" className="absolute top-4 right-4 z-10">
                                <Menu.Button className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                                    {project.status}
                                </Menu.Button>
                                <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-32 origin-top-right bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
                                        <div className="p-1">
                                            {['Active', 'Completed'].map((status) => (
                                                <Menu.Item key={status}>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => handleUpdateStatus(project.id, status)}
                                                            className={`${active ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
                                                                } group flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium`}
                                                        >
                                                            {status}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            ))}
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        ) : (
                            <div className={`absolute top-4 right-4 text-xs font-bold px-2 py-1 rounded-full ${project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {project.status}
                            </div>
                        )}

                        <Link to={`/projects/${project.id}`} className="block mb-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition">{project.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-2 h-10">{project.description}</p>
                        </Link>

                        <div className="mt-auto space-y-4">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <div className="flex items-center">
                                    <CalendarIcon className="w-4 h-4 mr-1" />
                                    <span>{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'No Deadline'}</span>
                                </div>
                                <div className="flex items-center">
                                    <UserGroupIcon className="w-4 h-4 mr-1" />
                                    <span>{project.members ? project.members.length : 0} Members</span>
                                </div>
                            </div>

                            {/* Member Avatars (First 3) */}
                            <div className="flex -space-x-2 overflow-hidden py-1">
                                {project.members && project.members.slice(0, 4).map((m, i) => (
                                    <img
                                        key={i}
                                        src={m.avatar_url || `https://ui-avatars.com/api/?name=${m.full_name}`}
                                        className="inline-block h-8 w-8 rounded-full ring-2 ring-white"
                                        title={m.full_name}
                                    />
                                ))}
                                {project.members && project.members.length > 4 && (
                                    <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-white bg-slate-100 text-xs text-slate-500 font-bold">
                                        +{project.members.length - 4}
                                    </div>
                                )}
                            </div>

                            {/* Actions Dropdown for Admin */}
                            {isAdmin && (
                                <div className="absolute bottom-4 right-4">
                                    <button onClick={() => setDeleteId(project.id)} className="text-slate-300 hover:text-red-500 p-1">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {filteredProjects.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400">
                        No projects found.
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Project" size="max-w-lg">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                        <input name="title" required className="w-full px-4 py-2 border rounded-lg bg-slate-50 focus:bg-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <textarea name="description" rows="3" className="w-full px-4 py-2 border rounded-lg bg-slate-50 focus:bg-white"></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                            <input name="start_date" type="date" required className="w-full px-4 py-2 border rounded-lg bg-slate-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                            <input name="end_date" type="date" required className="w-full px-4 py-2 border rounded-lg bg-slate-50" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Members</label>
                        <select name="members" multiple className="w-full px-4 py-2 border rounded-lg bg-slate-50 h-32">
                            {team.map(u => (
                                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg">Create Project</button>
                    </div>
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Project" size="max-w-sm">
                <div className="text-center">
                    <p className="text-sm text-slate-500 mb-6">Are you sure? This will delete all tasks within the project.</p>
                    <div className="flex space-x-3 justify-center">
                        <button onClick={() => setDeleteId(null)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg">Cancel</button>
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-lg">Yes, Delete</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
