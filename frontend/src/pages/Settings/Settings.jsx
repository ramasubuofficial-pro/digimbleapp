import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function Settings() {
    const { user, refreshUser } = useAuth()
    const { addToast } = useToast()
    const [fullName, setFullName] = useState('')
    const [saving, setSaving] = useState(false)

    // Sync state with user data
    useEffect(() => {
        if (user) {
            // Priority: direct property, then metadata
            const name = user.full_name || user.user_metadata?.full_name || ''
            setFullName(name)
        }
    }, [user])

    const handleSave = async () => {
        const trimmedName = fullName.trim()
        if (!trimmedName) {
            addToast('Full name is required', 'error')
            return
        }

        setSaving(true)
        try {
            // 1. Update Profile via Backend
            const res = await axios.post('/api/user/profile',
                { full_name: trimmedName },
                { timeout: 10000 } // Add 10s timeout
            )

            if (res.status === 200) {
                // 2. Refresh Local State
                await refreshUser()
                addToast('Profile updated successfully!', 'success')
            } else {
                throw new Error('Unexpected response status')
            }
        } catch (e) {
            console.error("Save Error:", e)
            const errorMsg = e.response?.data?.error || e.message || 'Failed to update profile'
            addToast(errorMsg, 'error')

            // If it timed out, maybe it actually succeeded in DB? Let's refresh anyway.
            if (e.code === 'ECONNABORTED') {
                refreshUser()
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Settings</h1>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <h2 className="text-xl font-bold text-slate-800 mb-6">Profile Settings</h2>
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {user?.user_metadata?.avatar_url || user?.avatar_url ? (
                            <img src={user.user_metadata?.avatar_url || user.avatar_url} className="w-24 h-24 rounded-full border-4 border-slate-50 shadow-lg object-cover" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-slate-50 shadow-lg">
                                {(user?.full_name?.[0] || user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 w-full space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center disabled:opacity-70"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
