import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import axios from 'axios'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                initializeUser(session.user)
            } else {
                setLoading(false)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                initializeUser(session.user)
            } else {
                setUser(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const initializeUser = async (authUser) => {
        try {
            // 0. Sync with Backend Session FIRST to validate access
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession) {
                try {
                    await axios.post('/auth/api/set-session', {
                        access_token: currentSession.access_token,
                        user: currentSession.user
                    })
                } catch (apiError) {
                    // CRITICAL: Backend rejected the login (e.g. Not Invited)
                    if (apiError.response?.status === 403) {
                        console.error("Login Rejected by Backend:", apiError.response.data.error)
                        await supabase.auth.signOut()
                        setUser(null)
                        setLoading(false)
                        // Show Alert to User
                        alert(apiError.response.data.error || "Invalid credential, ask your admin to invite you.")
                        return
                    }
                    throw apiError
                }
            }

            // 1. Fetch Latest Data from users table (Source of truth for name/role)
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (error) throw error

            const fullUser = { ...authUser, ...data }
            setUser(fullUser)
            setLoading(false)

        } catch (e) {
            console.error("Auth initialization failed", e)
            // Check if it was a missing user in DB error
            if (e.code === 'PGRST116') { // JSON object requested, multiple (or no) rows returned
                await supabase.auth.signOut()
                setUser(null)
                alert("Invalid credential, ask your admin to invite you.")
            } else {
                setUser(authUser) // Fallback to basic auth user
            }
            setLoading(false)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        try { await axios.post('/api/logout') } catch (e) { }
        setUser(null)
    }

    const refreshUser = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            await initializeUser(session.user)
        }
    }

    return (
        <AuthContext.Provider value={{ user, signOut, loading, refreshUser, isAdmin: user?.role === 'Admin' }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
