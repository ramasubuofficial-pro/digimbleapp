import { useState } from 'react'
import { supabase } from '../services/supabase'
import { useNavigate } from 'react-router-dom'

const Login = () => {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const navigate = useNavigate()

    const handleGoogleLogin = async () => {
        setLoading(true)
        setErrorMsg('')
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            })
            if (error) throw error
        } catch (error) {
            setErrorMsg(error.message)
            setLoading(false)
        }
    }

    const handleEmailLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            navigate('/')
        } catch (error) {
            setErrorMsg(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#fdfdfd] relative overflow-hidden font-sans">
            <div className="w-full max-w-[440px] bg-white rounded-[1.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.06)] p-12 border border-[#f0f0f0] relative z-10 mx-4">
                <div className="text-center mb-10">
                    <h1 className="text-[2rem] font-bold text-[#10b981] tracking-wider mb-2">
                        DIGIANCHORZ
                    </h1>
                    <p className="text-[#64748b] text-[0.95rem]">Project Management Reimagined</p>
                </div>

                {errorMsg && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="relative">
                        <input
                            type="email"
                            placeholder="Email address"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-5 py-[0.9rem] bg-white border border-[#e2e8f0] rounded-xl focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] outline-none transition-all placeholder:text-[#94a3b8] text-[#1e293b]"
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-5 py-[0.9rem] bg-white border border-[#e2e8f0] rounded-xl focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] outline-none transition-all placeholder:text-[#94a3b8] text-[#1e293b]"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-[1rem] bg-[#059669] text-white font-bold rounded-xl hover:bg-[#047857] active:scale-[0.99] transition-all duration-200 shadow-md disabled:opacity-70 mt-4 text-[1rem]"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#f1f5f9]"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-[#94a3b8]">Or</span>
                    </div>
                </div>

                <div className="px-2">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        type="button"
                        className="w-full flex items-center justify-center space-x-3 bg-white border border-[#e2e8f0] py-[0.9rem] rounded-xl hover:bg-[#f8fafc] active:scale-[0.99] transition-all shadow-sm font-semibold text-[#334155]"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                        <span>Continue with Google</span>
                    </button>
                </div>

                <p className="mt-10 text-center text-[0.75rem] text-[#94a3b8] leading-relaxed">
                    By continuing, you agree to our <a href="#" className="text-[#94a3b8] hover:text-[#10b981] underline underline-offset-2">Terms of Service</a> and <a href="#" className="text-[#94a3b8] hover:text-[#10b981] underline underline-offset-2">Privacy Policy</a>.
                </p>
            </div>
        </div>
    )
}

export default Login
