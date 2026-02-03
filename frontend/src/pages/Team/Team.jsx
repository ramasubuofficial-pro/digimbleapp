import { useState, useEffect } from 'react'
import axios from 'axios'
import Modal from '../../components/UI/Modal'
import { PlusIcon, TrashIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function Team() {
    const { user, isAdmin } = useAuth()
    const { addToast } = useToast()
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)

    const [isInviteOpen, setIsInviteOpen] = useState(false)
    const [deleteId, setDeleteId] = useState(null)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('Member')
    const [sending, setSending] = useState(false)

    useEffect(() => {
        fetchTeam()
    }, [])

    const fetchTeam = async () => {
        try {
            const res = await axios.get('/api/team')
            setMembers(res.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setSending(true)
        try {
            await axios.post('/api/invite', { email: inviteEmail, role: inviteRole })
            setIsInviteOpen(false)
            setInviteEmail('')
            addToast('Invitation sent successfully!', 'success')
        } catch (e) { addToast(e.response?.data?.error || 'Error sending invite', 'error') }
        finally { setSending(false) }
    }

    const handleDelete = async () => {
        try {
            await axios.delete(`/api/team/${deleteId}`)
            setDeleteId(null)
            fetchTeam()
            addToast('Member removed successfully', 'success')
        } catch (e) { addToast(e.response?.data?.error || 'Error removing member', 'error') }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Loading team...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Team Directory</h2>
                    <p className="text-sm text-slate-500">Manage your team members and their roles.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/30"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Invite Member
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {members.map(member => {
                    const isMe = member.id === user?.id

                    return (
                        <div key={member.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition flex items-center space-x-4 relative group">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600 border-2 border-slate-50 overflow-hidden">
                                {member.avatar_url ? (
                                    <img src={member.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{(member.full_name?.[0] || member.email?.[0] || 'U').toUpperCase()}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800">
                                    {member.full_name || 'Unknown User'}
                                    {isMe && <span className="ml-2 text-xs text-slate-400 font-normal">(You)</span>}
                                </h3>
                                <p className="text-xs text-slate-500 truncate max-w-[150px]" title={member.email}>{member.email}</p>
                                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${member.role === 'Admin' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {member.role || 'Member'}
                                </span>
                            </div>
                            {isAdmin && !isMe && (
                                <button
                                    onClick={() => setDeleteId(member.id)}
                                    className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition p-1 lg:opacity-0 lg:group-hover:opacity-100"
                                    title="Remove Member"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Invite Modal */}
            <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite New Member" size="max-w-md">
                <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                        >
                            <option value="Member">Team Member</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setIsInviteOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={sending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-lg disabled:opacity-50">
                            {sending ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Member?" size="max-w-sm">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                        <TrashIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Are you sure you want to remove this member? This action cannot be undone.</p>
                    <div className="flex space-x-3 justify-center">
                        <button onClick={() => setDeleteId(null)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg">Cancel</button>
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-lg">Remove</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
