import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

export default function Health() {
  const { t } = useTranslation()
  const { activeFarm } = useFarmStore()
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(false)

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

  const loadHealth = useCallback(async () => {
    if (!activeFarm) return
    setLoading(true)
    try {
      const data = await apiFetch(`/api/v1/health/${activeFarm.id}`)
      setHealthData(data)
    } catch (err) {
      toast.error(err.message || t('health.loadError'))
    } finally {
      setLoading(false)
    }
  }, [activeFarm, apiFetch, t])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  const getGradeColor = (g) => {
    switch (g) {
      case 'A': return { bg: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
      case 'B': return { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }
      case 'C': return { bg: 'rgba(234,179,8,0.1)', color: '#facc15', border: '1px solid rgba(234,179,8,0.3)' }
      default: return { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
    }
  }

  // Radial Gauge Calculations
  const radius = 55
  const circumference = 2 * Math.PI * radius
  const score = healthData?.score || 0
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{t('health.title')}</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>{t('health.subtitle')}</p>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
            <Skeleton width="100%" height="300px" />
            <Skeleton width="100%" height="300px" />
          </div>
        ) : healthData ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'flex-start' }}>
            
            {/* Left Card: Score Summary */}
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{t('health.overallIndexTitle')}</h3>
              
              {/* Gauge */}
              <div style={{ position: 'relative', width: '130px', height: '130px' }}>
                <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke="url(#healthGrad)"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{score}%</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>{t('health.healthScore')}</span>
                </div>
              </div>

              {/* Grade Badge */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{
                  padding: '0.4rem 1.5rem',
                  borderRadius: '20px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  display: 'inline-block',
                  margin: '0 auto',
                  ...getGradeColor(healthData.grade)
                }}>
                  {t('health.grade', { grade: healthData.grade })}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  {score >= 80 ? t('health.conditionExcellent') : score >= 60 ? t('health.conditionOptimal') : t('health.conditionAttention')}
                </span>
              </div>
            </div>

            {/* Right Card: Component Breakdown Progress Indicators */}
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{t('health.componentAnalysis')}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <HealthBar label={t('health.soilStability')} score={healthData.breakdown?.soil?.score} status={healthData.breakdown?.soil?.status} color="#22c55e" emoji="🌱" />
                <HealthBar label={t('health.pathogenResistance')} score={healthData.breakdown?.disease?.score} status={healthData.breakdown?.disease?.status} color="#ef4444" emoji="🔬" />
                <HealthBar label={t('health.infestationControl')} score={healthData.breakdown?.pest?.score} status={healthData.breakdown?.pest?.status} color="#f59e0b" emoji="🐛" />
                <HealthBar label={t('health.microclimateSafety')} score={healthData.breakdown?.weather?.score} status={healthData.breakdown?.weather?.status} color="#0ea5e9" emoji="⛅" />
                <HealthBar label={t('health.hydrationIndex')} score={healthData.breakdown?.irrigation?.score} status={healthData.breakdown?.irrigation?.status} color="#3b82f6" emoji="💧" />
              </div>
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <p>{t('health.noFarmPrompt')}</p>
          </div>
        )}

        {/* Actionable Recommendations panel */}
        {!loading && healthData && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>{t('health.recommendationsTitle')}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {healthData.recommendations?.map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: rec.component === 'General' ? '#10b981' : '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('health.advisoryBadge', { component: rec.component })}
                  </span>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    {rec.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </FarmLayout>
  )
}

function HealthBar({ label, score, status, color, emoji }) {
  const hasScore = typeof score === 'number' && !Number.isNaN(score)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{emoji} {label}</span>
        <span style={{ color, fontWeight: 800 }}>
          {hasScore ? `${score}%` : 'N/A'}
          {status && status !== 'Measured' ? <span style={{ color: '#64748b', fontWeight: 500 }}> · {status}</span> : null}
        </span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${hasScore ? score : 0}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: color }}
        />
      </div>
    </div>
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
