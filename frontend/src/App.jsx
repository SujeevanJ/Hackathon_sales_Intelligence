import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Triggers from './pages/Triggers'
import OutreachBrief from './pages/OutreachBrief'
import Outreaches from './pages/Outreaches'
import Analytics from './pages/Analytics'
import GlobalMap from './pages/GlobalMap'
import Login from './pages/Login'
import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { ChatWidget } from './components/ui/ChatWidget'

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
      <ChatWidget />
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
        <Route path="/map" element={<GlobalMap />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/triggers" element={<Triggers />} />
        <Route path="/outreach" element={<Outreaches />} />
        <Route path="/outreach/:triggerId" element={<OutreachBrief />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
