import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

const FEATURES = [
  { key: 'disease', path: '/disease', color: '#ef4444', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSR5SdpZo8jgkELYT6aBxnW0h3CIXetvuXduw&s' },
  { key: 'soil', path: '/soil', color: '#22c55e', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS58IuoIBTZH9EuQHKjREpaY33XYE3npLCNHQ&s' },
  { key: 'weather', path: '/weather', color: '#0ea5e9', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQC5AwE7hGhEIbOGFIOvQrwWC9OZzNE9cgnng&s' },
  { key: 'pest', path: '/pest', color: '#f59e0b', image: 'https://www.livemint.com/lm-img/img/2025/07/02/600x338/2-0-1290266725-Farmer-Pesticides11-20171127PG-0_1679594906526_1751468290344.jpg' },
  { key: 'yield', path: '/yield', color: '#8b5cf6', image: 'https://www.sblcorp.ai/wp-content/uploads/2024/06/yield-prediction.webp' },
  { key: 'crops', path: '/crops', color: '#06b6d4', image: 'https://storage.googleapis.com/kaggle-datasets-images/1449477/2397200/500fc4e03b13ef8d2482d646c960966a/dataset-cover.jpg?t=2021-07-05-13-18-58' },
  { key: 'calendar', path: '/calendar', color: '#d97706', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkmWat4oVUxbkC9qjztvDmnZ8pVr1fV8io1A&s' },
  { key: 'health', path: '/health', color: '#10b981', image: 'https://media.istockphoto.com/id/1360520451/photo/top-view-of-soil-in-hands-for-check-the-quality-of-the-soil-for-control-soil-quality-before.jpg?s=612x612&w=0&k=20&c=WPFd_l7Zz92G2glH8RHujjQnh0GLxKxJ5qlV8cKy5aM=' },
  { key: 'chat', path: '/chat', color: '#6366f1', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS9LxLSoebLfgpAH-QKPf5r9DyNEHegJ5CzYQ&s' },
  { key: 'market', path: '/market', color: '#f59e0b', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR82Skah6uSOFG_XYD_eU-UasAwVJjJQoSC6A&s' },
  { key: 'expenses', path: '/expenses', color: '#ec4899', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSedch_2ecliNl5opcklePx8Ts1C7gM-OTexg&s' },
  { key: 'schemes', path: '/schemes', color: '#14b8a6', image: 'https://akm-img-a-in.tosshub.com/indiatoday/images/story/201908/Add_a_subheading_1_.png?VersionId=MoNEvek00g1J_WpgxJkZkiQbvUs3SVU7' },
  { key: 'drought', path: '/drought', color: '#0284c7', image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80' },
  { key: 'languages', path: '/languages', color: '#84cc16', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtkNG_gNWb7pJviv4iS3QP5FGiL6GR9HQFUg&s' }
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activeFarm, healthScore, setFarms, updateHealth } = useFarmStore()
  const [stats, setStats] = useState({ activeCrops: 0, expenses: 0, scans: 0, daysSinceSoil: 'N/A' })
  const [recentAlerts, setRecentAlerts] = useState([])

  const apiFetch = useCallback(async (path, options = {}) => {
    options.credentials = 'include'
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    const res = await fetch(`${BACKEND_URL}${path}`, options)
    if (!res.ok) return null
    return res.json()
  }, [])

  // Load stats and health score
  useEffect(() => {
    if (!activeFarm) return

    const loadDashboardData = async () => {
      // 1. Fetch crops count
      const crops = await apiFetch(`/api/v1/crops?farm_id=${activeFarm.id}`)
      const activeCropsCount = crops ? crops.filter(c => c.status === 'growing').length : 0

      // 2. Fetch expenses
      const expSummary = await apiFetch(`/api/v1/expenses/${activeFarm.id}/summary`)
      const totalExp = expSummary ? expSummary.total_expense : 0

      // 3. Fetch scans count (disease + pest scans)
      const dScans = await apiFetch(`/api/v1/disease/history/${activeFarm.id}`)
      const pScans = await apiFetch(`/api/v1/pest/history/${activeFarm.id}`)
      const totalScans = (dScans ? dScans.length : 0) + (pScans ? pScans.length : 0)

      // 4. Fetch soil report days
      const soilReports = await apiFetch(`/api/v1/soil/history/${activeFarm.id}`)
      let days = 'N/A'
      if (soilReports && soilReports.length > 0) {
        const lastTest = new Date(soilReports[0].tested_at)
        const diffTime = Math.abs(new Date() - lastTest)
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      setStats({
        activeCrops: activeCropsCount,
        expenses: totalExp,
        scans: totalScans,
        daysSinceSoil: days === 'N/A' ? 'N/A' : `${days} days`
      })

      // 5. Fetch overall health score
      const healthData = await apiFetch(`/api/v1/farms/${activeFarm.id}/health`)
      if (healthData && healthData.health_score !== undefined) {
        updateHealth(healthData.health_score)
      }

      // 6. Fetch recent unread alerts
      const alerts = await apiFetch(`/api/v1/alerts/${activeFarm.id}`)
      if (alerts) {
        setRecentAlerts(alerts.slice(0, 5))
      }
    }

    loadDashboardData()
  }, [activeFarm, updateHealth, apiFetch])

  const markRead = async (id) => {
    try {
      await fetch(`${BACKEND_URL}/api/v1/alerts/${id}/read`, {
        method: 'PUT',
        credentials: 'include'
      })
      setRecentAlerts(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  // Animated arc metrics
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (healthScore / 100) * circumference

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Hero Section */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          
          {/* Health Gauge Glass Card */}
          <div className="glass-card" style={{ flex: '1 1 350px', padding: '2rem', display: 'flex', alignItems: 'center', gap: '2rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                {/* Track circle */}
                <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                {/* Indicator circle */}
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
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800 }}>{healthScore}%</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{t('dashboard.healthLabel')}</span>
              </div>
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{activeFarm ? activeFarm.farm_name : t('dashboard.noFarmRegistered')}</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 1rem' }}>
                {activeFarm ? `${activeFarm.location || t('dashboard.unknownLocation')}, ${activeFarm.state || 'India'}` : t('dashboard.boundaryNotConfigured')}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {activeFarm?.soil_type || 'Standard'} {t('common.soil')}
                </span>
                <span style={{ background: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {activeFarm?.area_acres || 0} {t('common.acres')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ flex: '2 1 500px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            <StatCard emoji="🌾" value={stats.activeCrops} label={t('dashboard.statGrowingCrops')} />
            <StatCard emoji="🎛️" value={recentAlerts.length} label={t('dashboard.statNewAlerts')} />
            <StatCard emoji="📒" value={`₹${stats.expenses}`} label={t('dashboard.statExpensesLogged')} />
            <StatCard emoji="🔬" value={stats.daysSinceSoil} label={t('dashboard.statSinceSoilTest')} />
          </div>

        </div>

        {/* Mid section: Alerts & Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* 14 Features Grid */}
          <div style={{ width: '100%' }}>
            <style>{`
              .feature-card {
                position: relative;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
              }
              .feature-card:hover .feature-card-img {
                transform: scale(1.08);
              }
              .feature-card:hover {
                box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(74, 222, 128, 0.15);
              }
            `}</style>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>{t('dashboard.overviewTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {FEATURES.map((feat, idx) => (
                <motion.div
                  key={idx}
                  className="glass-card feature-card"
                  onClick={() => navigate(feat.path)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    minHeight: '260px'
                  }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                >
                  {/* Card Image Area with Zoom effect */}
                  <div style={{ width: '100%', height: '110px', overflow: 'hidden', position: 'relative', background: 'rgba(255,255,255,0.01)' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(10, 26, 10, 0.95) 100%)`,
                        zIndex: 1
                      }}
                    />
                    <img 
                      src={feat.image} 
                      alt={t(`dashboard.features.${feat.key}.name`)}
                      className="feature-card-img"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.style.background = `linear-gradient(135deg, ${feat.color}15 0%, ${feat.color}40 100%)`;
                      }}
                    />
                  </div>

                  {/* Card Details Area */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, zIndex: 2, background: 'rgba(10, 26, 10, 0.45)' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{t(`dashboard.features.${feat.key}.name`)}</h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.4, minHeight: '38px' }}>{t(`dashboard.features.${feat.key}.desc`)}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: feat.color, marginTop: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {t('dashboard.accessPortal')} <span>→</span>
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Warnings Logs panel */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>{t('dashboard.recentWarnings')}</h3>
            
            {recentAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <p style={{ fontSize: '0.8rem', margin: '8px 0 0' }}>{t('dashboard.allClear')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentAlerts.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => markRead(a.id)}
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      transition: 'border 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171' }}>{a.alert_type}</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{new Date(a.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '4px' }}>{a.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>{a.message}</div>
                    <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '6px', textAlign: 'right', fontWeight: 700 }}>✓ {t('alerts.markRead')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </FarmLayout>
  )
}

function StatCard({ emoji, value, label }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <span style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>{emoji}</span>
      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399' }}>{value}</span>
      <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>{label}</span>
    </div>
  )
}
