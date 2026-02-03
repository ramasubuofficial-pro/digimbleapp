import axios from 'axios'
import { supabase } from './supabase'

// 1. Set Base URL
axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

// 2. Add specific header for ngrok to avoid browser warning page
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'

// 3. Request Interceptor: Attach Bearer Token
axios.interceptors.request.use(async (config) => {
    // Skip if it's a login/auth request that doesn't need token (optional logic)

    // Get current session from Supabase
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
}, (error) => {
    return Promise.reject(error)
})

// 4. Response Interceptor: Handle 401s (Optional Global Logout)
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            console.warn("Unauthorized access - 401 received")
            // Optionally force logout here
        }
        return Promise.reject(error)
    }
)

export default axios
