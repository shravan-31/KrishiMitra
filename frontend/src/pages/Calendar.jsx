import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

const TASK_TYPES = [
  { value: 'irrigation', label: '💧 Irrigation' },
  { value: 'fertilizer', label: '🌱 Fertilizer' },
  { value: 'pesticide', label: '🔬 Pesticide' },
  { value: 'harvest', label: '🌾 Harvesting' },
  { value: 'sowing', label: '🌱 Sowing' },
  { value: 'pruning', label: '🌿 Pruning' },
  { value: 'tillage', label: '🚜 Tillage' },
  { value: 'other', label: '📋 Other' }
]

export default function Calendar() {
  const { activeFarm } = useFarmStore()
  
  // List states
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')

  // Form states
  const [taskName, setTaskName] = useState('')
  const [taskType, setTaskType] = useState('irrigation')
  const [scheduledAt, setScheduledAt] = useState('')
  const [urgency, setUrgency] = useState('NORMAL')
  const [cost, setCost] = useState(0)
  const [submitting, setSubmitting] = useState(false)

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

  const loadTasks = useCallback(async () => {
    if (!activeFarm) return
    setLoading(true)
    try {
      const data = await apiFetch(`/calendar?farm_id=${activeFarm.id}`)
      setTasks(data || [])
    } catch (err) {
      console.error(err)
      toast.error("Failed to load crop calendar tasks")
    } finally {
      setLoading(false)
    }
  }, [activeFarm, apiFetch])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!activeFarm) return
    if (!taskName.trim()) {
      toast.error("Please enter a task name")
      return
    }
    if (!scheduledAt) {
      toast.error("Please choose a schedule date/time")
      return
    }

    setSubmitting(true)
    const payload = {
      farm_id: activeFarm.id,
      task_name: taskName,
      task_type: taskType,
      scheduled_at: new Date(scheduledAt).toISOString(),
      urgency: urgency,
      cost_estimate: parseFloat(cost)
    }

    try {
      await apiFetch('/calendar', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      toast.success("Task scheduled on your crop calendar!")
      setTaskName('')
      setScheduledAt('')
      setCost(0)
      setUrgency('NORMAL')
      loadTasks()
    } catch (err) {
      toast.error(err.message || "Failed to schedule task")
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleComplete = async (task) => {
    try {
      await apiFetch(`/calendar/${task.id}/complete?completed=${!task.completed}`, {
        method: 'PUT'
      })
      toast.success(task.completed ? "Task marked incomplete" : "Task completed!")
      loadTasks()
    } catch (err) {
      toast.error("Failed to update task state")
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      await apiFetch(`/calendar/${taskId}`, {
        method: 'DELETE'
      })
      toast.success("Task removed from crop calendar")
      loadTasks()
    } catch (err) {
      toast.error("Failed to delete task")
    }
  }

  const filteredTasks = tasks.filter(t => filterType === 'all' || t.task_type === filterType)

  const getUrgencyStyles = (u) => {
    switch (String(u).toUpperCase()) {
      case 'CRITICAL': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
      case 'HIGH': return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }
      default: return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }
    }
  }

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Agronomy Task Calendar</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>Log and check off field activities, scheduled sprays, fertilizer timing, and harvesting windows.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Calendar List Panel */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Scheduled Activities</h3>
              
              {/* Type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
              >
                <option value="all">All Types</option>
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Skeleton width="100%" height="60px" />
                <Skeleton width="100%" height="60px" />
                <Skeleton width="100%" height="60px" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <span style={{ fontSize: '3rem' }}>📅</span>
                <p style={{ fontSize: '0.9rem', margin: '8px 0 0' }}>No tasks scheduled. Add one using the form on the right!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      background: task.completed ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '14px',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: task.completed ? 0.6 : 1,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleComplete(task)}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '6px',
                          border: '2px solid #10b981',
                          cursor: 'pointer',
                          accentColor: '#10b981'
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', textDecoration: task.completed ? 'line-through' : 'none' }}>
                          {task.task_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', gap: '0.5rem' }}>
                          <span>{TASK_TYPES.find(t => t.value === task.task_type)?.label || '📋 Action'}</span>
                          <span>•</span>
                          <span>{new Date(task.scheduled_at).toLocaleDateString()} at {new Date(task.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          {task.cost_estimate > 0 && (
                            <>
                              <span>•</span>
                              <span>Est: ₹{task.cost_estimate}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        ...getUrgencyStyles(task.urgency)
                      }}>
                        {task.urgency}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduling Form Panel */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Schedule Activity</h3>
            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Task / Operation Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apply NPK fertilizer, Weed weeding"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Task Category</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Cost Estimate (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={cost || ''}
                    onChange={(e) => setCost(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="glow-btn"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  opacity: submitting ? 0.5 : 1
                }}
              >
                {submitting ? 'Scheduling activity...' : 'Add to Crop Calendar'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </FarmLayout>
  )
}

function Skeleton({ width, height }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '6px',
        animation: 'pulse 1.5s infinite ease-in-out'
      }}
    />
  )
}
