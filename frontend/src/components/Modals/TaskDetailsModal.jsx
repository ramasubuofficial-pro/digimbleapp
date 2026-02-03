import { useState, useEffect, Fragment, useRef } from 'react'
import { Dialog, Tab, Transition } from '@headlessui/react'
import {
    XMarkIcon,
    PaperClipIcon,
    ChatBubbleLeftEllipsisIcon,
    TrashIcon,
    DocumentIcon,
    ArrowDownTrayIcon,
    PaperAirplaneIcon,
    CalendarIcon,
    UserCircleIcon,
    FlagIcon,
    CheckCircleIcon,
    RectangleStackIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'

function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
}

export default function TaskDetailsModal({ isOpen, onClose, task, projects = [], team = [], onUpdate, onDelete }) {
    // Determine initial state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'Medium',
        status: 'To Do',
        start_date: '',
        deadline: '',
        assigned_to: '',
        project_id: ''
    })

    // Mock Data State
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')

    const [attachments, setAttachments] = useState([])
    const fileInputRef = useRef(null)

    useEffect(() => {
        if (task) {
            setFormData({
                title: task.title || '',
                description: task.description || '',
                priority: task.priority || 'Medium',
                status: task.status || 'To Do',
                deadline: task.deadline ? task.deadline.slice(0, 16) : '',
                assigned_to: task.assigned_to || '',
                project_id: task.project_id || ''
            })
        }
    }, [task])

    const handleSave = () => {
        onUpdate({ ...task, ...formData })
    }

    const handleSendComment = () => {
        if (!newComment.trim()) return
        const comment = {
            id: Date.now(),
            user: 'You',
            avatar: null,
            message: newComment,
            date: new Date().toISOString()
        }
        setComments([...comments, comment])
        setNewComment('')
    }

    const startUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (!file) return

        // create a mock attachment object from the real file
        const newAttachment = {
            id: Date.now(),
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            date: new Date().toISOString(),
            file: file
        }
        setAttachments([...attachments, newAttachment])

        // Reset input so same file can be selected again if needed
        e.target.value = ''
    }

    const removeAttachment = (id) => {
        setAttachments(attachments.filter(a => a.id !== id))
    }

    const handleDownload = (attachment) => {
        if (attachment.file) {
            const url = URL.createObjectURL(attachment.file)
            const a = document.createElement('a')
            a.href = url
            a.download = attachment.name
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } else {
            console.log("No downloadable file source found.")
        }
    }

    if (!isOpen) return null

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform rounded-[2rem] bg-white shadow-2xl transition-all overflow-hidden flex flex-col max-h-[90vh]">

                                {/* Header */}
                                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-white z-10">
                                    <div className="flex-1 pr-8">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={classNames(
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                                formData.status === 'Completed' ? "bg-emerald-100 text-emerald-600" :
                                                    formData.status === 'In Progress' ? "bg-amber-100 text-amber-600" :
                                                        "bg-slate-100 text-slate-500"
                                            )}>
                                                {formData.status}
                                            </span>
                                            <span className={classNames(
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                                formData.priority === 'High' ? "bg-red-100 text-red-600" :
                                                    formData.priority === 'Medium' ? "bg-orange-100 text-orange-600" :
                                                        "bg-blue-100 text-blue-600"
                                            )}>
                                                {formData.priority} Priority
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full text-2xl font-black text-slate-800 bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300"
                                            placeholder="Task Title"
                                        />
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                                    >
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Body with Tabs */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <Tab.Group as="div" className="flex-1 flex flex-col min-h-0">
                                        <div className="px-8 border-b border-slate-100 bg-white">
                                            <Tab.List className="flex space-x-8">
                                                {['Details', 'Comments', 'Attachments'].map((category) => (
                                                    <Tab
                                                        key={category}
                                                        className={({ selected }) =>
                                                            classNames(
                                                                'py-4 text-sm font-bold border-b-2 outline-none transition-colors duration-200',
                                                                selected
                                                                    ? 'text-emerald-600 border-emerald-600'
                                                                    : 'text-slate-400 border-transparent hover:text-slate-600'
                                                            )
                                                        }
                                                    >
                                                        {category}
                                                    </Tab>
                                                ))}
                                            </Tab.List>
                                        </div>

                                        <Tab.Panels className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
                                            {/* Details Panel */}
                                            <Tab.Panel className="space-y-8 outline-none animate-fade-in-up">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-6">
                                                        <div>
                                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Status</label>
                                                            <div className="relative">
                                                                <select
                                                                    value={formData.status}
                                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                                >
                                                                    <option value="To Do">To Do</option>
                                                                    <option value="In Progress">In Progress</option>
                                                                    <option value="Completed">Completed</option>
                                                                </select>
                                                                <CheckCircleIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                                                            <div className="relative">
                                                                <select
                                                                    value={formData.priority}
                                                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                                >
                                                                    <option value="Low">Low</option>
                                                                    <option value="Medium">Medium</option>
                                                                    <option value="High">High</option>
                                                                </select>
                                                                <FlagIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Project</label>
                                                            <div className="relative">
                                                                <select
                                                                    value={formData.project_id}
                                                                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                                >
                                                                    <option value="">No Project</option>
                                                                    <option value="personal">Personal</option>
                                                                    {projects.map(p => (
                                                                        <option key={p.id} value={p.id}>{p.title}</option>
                                                                    ))}
                                                                </select>
                                                                <RectangleStackIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-6">
                                                        <div>
                                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Assignee</label>
                                                            <div className="relative">
                                                                <select
                                                                    value={formData.assigned_to}
                                                                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                                                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                                >
                                                                    <option value="">Unassigned</option>
                                                                    {team.map(member => (
                                                                        <option key={member.id} value={member.id}>{member.full_name}</option>
                                                                    ))}
                                                                </select>
                                                                <UserCircleIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Due Date</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="datetime-local"
                                                                    value={formData.deadline}
                                                                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                                                    className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                                />
                                                                {/* <CalendarIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" /> */}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                                                    <textarea
                                                        rows="6"
                                                        value={formData.description}
                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none leading-relaxed"
                                                        placeholder="Add a detailed description..."
                                                    ></textarea>
                                                </div>
                                            </Tab.Panel>

                                            {/* Comments Panel */}
                                            <Tab.Panel className="space-y-6 outline-none animate-fade-in-up h-full flex flex-col">
                                                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                                                    {comments.length === 0 ? (
                                                        <div className="text-center py-10 opacity-50">
                                                            <ChatBubbleLeftEllipsisIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                                                            <p className="text-sm font-medium text-slate-500">No comments yet</p>
                                                        </div>
                                                    ) : (
                                                        comments.map((comment) => (
                                                            <div key={comment.id} className="flex gap-4">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                                                                    {comment.user.charAt(0)}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-bold text-slate-800">{comment.user}</span>
                                                                        <span className="text-xs text-slate-400">{format(new Date(comment.date), 'MMM d, h:mm a')}</span>
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-r-xl rounded-bl-xl border border-slate-100 shadow-sm inline-block">
                                                                        {comment.message}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                                                        placeholder="Write a comment..."
                                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                                    />
                                                    <button
                                                        onClick={handleSendComment}
                                                        disabled={!newComment.trim()}
                                                        className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                                                    >
                                                        <PaperAirplaneIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </Tab.Panel>

                                            {/* Attachments Panel */}
                                            <Tab.Panel className="space-y-6 outline-none animate-fade-in-up">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                />
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-sm font-bold text-slate-700">Attached Files</h4>
                                                    <button onClick={startUpload} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors">
                                                        <PaperClipIcon className="w-4 h-4" />
                                                        Upload File
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    {attachments.length === 0 ? (
                                                        <p className="text-slate-400 text-sm italic">No files attached.</p>
                                                    ) : (
                                                        attachments.map(file => (
                                                            <div key={file.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-shadow group">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                                        <DocumentIcon className="w-6 h-6" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-800">{file.name}</p>
                                                                        <p className="text-xs text-slate-400">{file.size} • {format(new Date(file.date), 'MMM d, yyyy')}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleDownload(file)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                                                    </button>
                                                                    <button onClick={() => removeAttachment(file.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                                        <TrashIcon className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </Tab.Panel>
                                        </Tab.Panels>
                                    </Tab.Group>
                                </div>

                                {/* Footer */}
                                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
                                    <button
                                        onClick={() => onDelete && onDelete(task)}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors w-full sm:w-auto"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                        Delete Task
                                    </button>
                                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                                        <button
                                            onClick={onClose}
                                            className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-200/50 rounded-xl transition-colors text-sm w-full sm:w-auto"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="px-8 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all text-sm w-full sm:w-auto"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>

                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
