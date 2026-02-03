import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import MainLayout from './components/Layout/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Tasks from './pages/Tasks/Tasks'
import Projects from './pages/Projects/Projects'
import ProjectDetails from './pages/Projects/ProjectDetails'
import Attendance from './pages/Attendance/Attendance'
import Team from './pages/Team/Team'
import Settings from './pages/Settings/Settings'
import Reports from './pages/Reports/Reports'
import Calendar from './pages/Calendar/Calendar'

// Placeholder components if they don't exist yet
const Placeholder = ({ title }) => <div className="p-8"><h1 className="text-2xl font-bold">{title}</h1><p>Coming Soon</p></div>

// Guards
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="team" element={<Team />} />
          <Route path="settings" element={<Settings />} />
          {/* Fallback for now */}
          <Route path="calendar" element={<Calendar />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
