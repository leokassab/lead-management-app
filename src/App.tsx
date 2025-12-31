import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { Layout } from './components/layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Queue from './pages/Queue'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Sequences from './pages/Sequences'
import SequenceBuilder from './pages/SequenceBuilder'
import Calendar from './pages/Calendar'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const { initialize, initialized } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/queue"
          element={
            <ProtectedRoute>
              <Layout>
                <Queue />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads"
          element={
            <ProtectedRoute>
              <Layout>
                <Leads />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <LeadDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sequences"
          element={
            <ProtectedRoute>
              <Layout>
                <Sequences />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sequences/new"
          element={
            <ProtectedRoute>
              <Layout>
                <SequenceBuilder />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sequences/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <SequenceBuilder />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendrier"
          element={
            <ProtectedRoute>
              <Layout>
                <Calendar />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistiques"
          element={
            <ProtectedRoute>
              <Layout>
                <Statistics />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/parametres"
          element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
