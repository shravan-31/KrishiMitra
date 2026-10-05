import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

export default function Alerts() {
  const { activeFarm } = useFarmStore()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Filters
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('UNREAD')

  const apiFetch = useCallback(async (path, options = {}) => {
    options.credentials = 'include'
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    const res = await fetch(`${BACKEND_URL}${path}`, options)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'API failure' }))
      throw new Error(err.detail || 'API failure')
    }
    return res.json()
  }, [])

  const loadAlertsList = useCallback(async () => {
    if (!activeFarm) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') {
        params.append('is_read', statusFilter === 'READ' ? 'true' : 'false')
      }
      if (severityFilter !== 'ALL') {
        params.append('severity', severityFilter)
      }
      
      const res = await apiFetch(`/api/v1/alerts/${activeFarm.id}?${params.toString()}`)
      setAlerts(res)
    } catch (err) {
      toast.error('Failed to load alert logs')
    } finally {
      setLoading(false)
    }
  }, [activeFarm, statusFilter, severityFilter, apiFetch])

  useEffect(() => {
    loadAlertsList()
  }, [loadAlertsList])

  const handleMarkRead = async (id) => {
    try {
      await apiFetch(`/api/v1/alerts/${id}/read`, { method: 'PUT' })
      toast.success('Alert marked as read')
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
      // Reload list to respect filter if filter is UNREAD
      if (statusFilter === 'UNREAD') {
        setAlerts(prev => prev.filter(a => a.id !== id))
      }
    } catch (err) {
      toast.error('Operation failed')
    }
  }

  const handleClearRead = async () => {
    if (!activeFarm) return
    try {
      await apiFetch(`/api/v1/alerts/${activeFarm.id}/clear-read`, { method: 'DELETE' })
      toast.success('Cleared all read alerts')
      loadAlertsList()
    } catch (err) {
      toast.error('Failed to clear read alerts')
    }
  }

  const getSeverityStyle = (sev) => {
    switch (String(sev).toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: '#ef4444', label: '🔴 Critical' }
      case 'HIGH':
        return { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b', label: '🟠 High' }
      case 'MEDIUM':
        return { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)', text: '#3b82f6', label: '🔵 Medium' }
      default:
        return { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#10b981', label: '🟢 Low' }
    }
  }

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Real-time Notifications Log</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
              Detailed archive of automated sensor warnings, weather risks, yield calculations, and market price changes
            </p>
          </div>

          <button
            onClick={handleClearRead}
            disabled={loading || !activeFarm}
            style={{
              padding: '0.6rem 1.25rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: '#f87171',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
          >
            🗑️ Clear Read Logs
          </button>
        </div>

        {/* Filters bar */}
        <div className="glass-card" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Read Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="UNREAD" style={{ background: '#0a1a0a' }}>Unread Alerts</option>
              <option value="READ" style={{ background: '#0a1a0a' }}>Read Alerts</option>
              <option value="ALL" style={{ background: '#0a1a0a' }}>All Logs</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL" style={{ background: '#0a1a0a' }}>All Severities</option>
              <option value="CRITICAL" style={{ background: '#0a1a0a' }}>Critical</option>
              <option value="HIGH" style={{ background: '#0a1a0a' }}>High</option>
              <option value="MEDIUM" style={{ background: '#0a1a0a' }}>Medium</option>
              <option value="LOW" style={{ background: '#0a1a0a' }}>Low</option>
            </select>
          </div>

          {activeFarm && (
            <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
              Showing {alerts.length} events for <strong>{activeFarm.farm_name}</strong>
            </div>
          )}
        </div>

        {/* Notifications list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-card" style={{ height: '80px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="glass-card" style={{ height: '80px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="glass-card" style={{ height: '80px', animation: 'pulse 1.5s infinite' }}></div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <AnimatePresence initial={false}>
              {alerts.map((a) => {
                const style = getSeverityStyle(a.severity)
                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="glass-card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      background: a.is_read ? 'rgba(255,255,255,0.01)' : style.bg,
                      border: `1px solid ${a.is_read ? 'rgba(255,255,255,0.04)' : style.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '2rem'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.02)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          border: `1px solid ${style.text}50`,
                          color: style.text
                        }}>
                          {a.alert_type}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: style.text }}>
                          {style.label}
                        </span>
                      </div>
                      <h4 style={{ margin: '6px 0 0', fontSize: '1rem', fontWeight: 700 }}>{a.title}</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
                        {a.message}
                      </p>
                    </div>

                    {!a.is_read && (
                      <button
                        onClick={() => handleMarkRead(a.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '8px',
                          color: '#10b981',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; e.currentTarget.style.transform = 'scale(1.02)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        ✓ Mark Read
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
                <span style={{ fontSize: '3rem' }}>🔔</span>
                <h3 style={{ marginTop: '1rem', fontSize: '1.1rem' }}>No alerts match your current filters.</h3>
              </div>
            )}
          </div>
        )}

      </div>
    </FarmLayout>
  )
}
