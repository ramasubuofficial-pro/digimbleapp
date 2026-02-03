import Modal from '../UI/Modal'
import { format } from 'date-fns'

export default function ViewTaskModal({ isOpen, onClose, task }) {
    if (!task) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Task Details">
            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">{task.title}</h3>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">{task.description || 'No description provided.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Project</p>
                        <p className="font-bold text-slate-700">{task.project?.title || task.project_name || 'Personal'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <p className={`font-bold ${task.status === 'Completed' ? 'text-emerald-600' : task.status === 'In Progress' ? 'text-amber-600' : 'text-slate-600'}`}>{task.status}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assignee</p>
                        <p className="font-bold text-slate-700">{task.assignee?.full_name || 'Unassigned'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deadline</p>
                        <p className="font-bold text-slate-700">{task.deadline ? format(new Date(task.deadline), 'PPp') : 'None'}</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end">
                    <button onClick={onClose} className="w-full sm:w-auto sm:px-8 py-3 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition">Close</button>
                </div>
            </div>
        </Modal>
    )
}
