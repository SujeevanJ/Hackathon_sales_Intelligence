import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Triggers from './pages/Triggers'
import OutreachBrief from './pages/OutreachBrief'
import Analytics from './pages/Analytics'
import Login from './pages/Login'
import { useState } from 'react'
import { useAuth } from './context/AuthContext'

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen bg-[#0d1117] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-56 transition-all duration-300">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/triggers" element={<Triggers />} />
        <Route path="/outreach" element={<Navigate to="/triggers" replace />} />
        <Route path="/outreach/:triggerId" element={<OutreachBrief />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
