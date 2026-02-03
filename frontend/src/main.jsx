import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import './services/axiosConfig'

// Configure Axios Base URL
// If VITE_API_URL is set (e.g. for Mobile/Production), use it.
// Otherwise, default to '' which allows the Vite proxy to handle '/api' requests in dev.
axios.defaults.baseURL = import.meta.env.VITE_API_URL || ''

// Add credential handling if needed (for cookies across domains)
axios.defaults.withCredentials = true

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
