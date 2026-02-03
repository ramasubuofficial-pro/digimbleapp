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

            // 2. Sync with Backend Session in background (Don't await it to prevent UI hang)
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession) {
                axios.post('/auth/api/set-session', {
                    access_token: currentSession.access_token,
                    user: currentSession.user
                }).catch(err => console.warn("Background session sync failed:", err))
            }

        } catch (e) {
            console.error("Auth initialization failed", e)
            setUser(authUser) // Fallback to basic auth user
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
