import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

const STATES = [
  'Maharashtra', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Gujarat', 
  'Madhya Pradesh', 'Andhra Pradesh', 'Tamil Nadu', 'Karnataka', 'West Bengal'
]

const CROPS = [
  'Rice', 'Wheat', 'Maize', 'Sugarcane', 'Cotton', 'Soybean', 'Groundnut', 'Potato', 'Onion'
]

export default function Yield() {
  const { t } = useTranslation()
  const { activeFarm } = useFarmStore()
  const [cropName, setCropName] = useState('Rice')
  const [stateName, setStateName] = useState('Maharashtra')
  const [districtName, setDistrictName] = useState(activeFarm?.district || 'Pune')
  const [seasonName, setSeasonName] = useState('Kharif')
  const [areaAcres, setAreaAcres] = useState(2.0)
  const [cropYear, setCropYear] = useState(new Date().getFullYear())

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (activeFarm?.district) {
      setDistrictName(activeFarm.district)
    }
    if (activeFarm?.state) {
      setStateName(activeFarm.state)
    }
  }, [activeFarm])

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

  const loadHistory = useCallback(async () => {
    if (!activeFarm) return
    try {
      const data = await apiFetch(`/api/v1/yield/history/${activeFarm.id}`)
      setHistory(data || [])
    } catch (err) {
      console.error(err)
    }
  }, [activeFarm, apiFetch])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activeFarm) return
    if (!districtName.trim()) {
      toast.error(t('yield.validDistrictToast'))
      return
    }
    setSubmitting(true)

    const payload = {
      farm_id: activeFarm.id,
      crop_name: cropName,
      state: stateName,
      district: districtName.trim(),
      season: seasonName,
      area_acres: parseFloat(areaAcres),
      year: parseInt(cropYear)
    }

    try {
      const data = await apiFetch('/api/v1/yield/predict', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      setResult(data)
      toast.success(t('yield.predictSuccessToast'))
      loadHistory()
    } catch (err) {
      toast.error(err.message || t('yield.predictFailedToast'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{t('yield.title')}</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>{t('yield.subtitle')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Form parameters */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>{t('yield.estimationParams')}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('yield.cropLabel')}</label>
                <select
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                >
                  {CROPS.map(c => <option key={c} value={c} style={{ background: '#0a1a0a' }}>{c}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('yield.stateLabel')}</label>
                  <select
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    {STATES.map(s => <option key={s} value={s} style={{ background: '#0a1a0a' }}>{s}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('yield.districtLabel')}</label>
                  <input
                    type="text"
                    placeholder={t('yield.districtPlaceholder')}
                    value={districtName}
                    onChange={(e) => setDistrictName(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('yield.seasonLabel')}</label>
                  <select
                    value={seasonName}
                    onChange={(e) => setSeasonName(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    <option value="Kharif" style={{ background: '#0a1a0a' }}>{t('yield.seasonKharif')}</option>
                    <option value="Rabi" style={{ background: '#0a1a0a' }}>{t('yield.seasonRabi')}</option>
                    <option value="Summer" style={{ background: '#0a1a0a' }}>{t('yield.seasonSummer')}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('yield.yearLabel')}</label>
                  <input
                    type="number"
                    value={cropYear}
                    onChange={(e) => setCropYear(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>{t('yield.areaLabel')}</span>
                  <span style={{ color: '#8b5cf6', fontWeight: 800 }}>{areaAcres} {t('yield.acresUnit')}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={areaAcres}
                  onChange={(e) => setAreaAcres(parseFloat(e.target.value))}
                  style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', outline: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                />
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
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  opacity: submitting ? 0.5 : 1
                }}
              >
                {submitting ? t('yield.runningModel') : t('yield.predictBtn')}
              </button>
            </form>
          </div>

          {/* Projection display */}
          <div className="glass-card" style={{ padding: '2rem', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <AnimatePresence mode="wait">
              {submitting ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  <Skeleton width="45%" height="24px" />
                  <Skeleton width="100%" height="120px" />
                  <Skeleton width="100%" height="80px" />
                </motion.div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                >
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{t('yield.expectedYield')}</span>
                    <h2 style={{ margin: 0, fontSize: '3rem', fontWeight: 800, color: '#a78bfa' }}>
                      {result.predicted_kg.toLocaleString()} kg
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                      ⚡ {t('yield.yieldDensityIndex')}: <strong>{result.predicted_per_acre} kg/{t('yield.acresUnit')}</strong> ({result.district || districtName}, {result.state || stateName})
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('yield.predictionInterval')}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                        {result.prediction_interval ? (
                          `${Math.round(result.prediction_interval.lower_kg).toLocaleString()} - ${Math.round(result.prediction_interval.upper_kg).toLocaleString()} kg`
                        ) : (
                          t('yield.residualRangeNA')
                        )}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>{t('yield.empiricalResiduals')}</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('yield.marketValueEst')}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#eab308', marginTop: '2px' }}>
                        ₹{(result.predicted_kg * 22).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Improvement Tips */}
                  {result.improvement_tips && result.improvement_tips.length > 0 && (
                    <div style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem', color: '#a78bfa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('yield.advisoriesTitle')}</h4>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                        {result.improvement_tips.map((tip, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </motion.div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>📊</span>
                  <h3 style={{ margin: 0, color: '#e2e8f0' }}>{t('yield.noEstimateTitle')}</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '320px', margin: '4px auto 0' }}>{t('yield.noEstimateDesc')}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History Area Chart */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>{t('yield.forecastLogsTitle')}</h3>
          {history.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('yield.noPastPredictions')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'center' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                      <th style={{ padding: '0.75rem' }}>{t('yield.colPredictedDate')}</th>
                      <th style={{ padding: '0.75rem' }}>{t('yield.colCrop')}</th>
                      <th style={{ padding: '0.75rem' }}>{t('yield.colSeason')}</th>
                      <th style={{ padding: '0.75rem' }}>{t('yield.colArea')}</th>
                      <th style={{ padding: '0.75rem' }}>{t('yield.colForecastTonnage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,205,0.03)' }}>
                        <td style={{ padding: '0.75rem', color: '#64748b' }}>{new Date(row.predicted_at).toLocaleDateString()}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>{row.crop_name}</td>
                        <td style={{ padding: '0.75rem' }}>{row.season}</td>
                        <td style={{ padding: '0.75rem' }}>{row.area_acres} {t('yield.acresUnit')}</td>
                        <td style={{ padding: '0.75rem', color: '#a78bfa', fontWeight: 800 }}>{row.predicted_kg.toLocaleString()} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Area Chart visualization */}
              <div style={{ height: '200px', width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="99%" height="100%">
                  <AreaChart data={[...history].reverse()} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="yieldColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="crop_name" tick={{fill:'#64748b', fontSize:10}} />
                    <YAxis tick={{fill:'#64748b', fontSize:10}} />
                    <Tooltip contentStyle={{ background: '#0a1a0a', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '10px' }} />
                    <Area type="monotone" dataKey="predicted_kg" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#yieldColor)" name={t('yield.yieldKg')} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
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
