import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

const STATES = [
  'Maharashtra', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Gujarat', 
  'Madhya Pradesh', 'Andhra Pradesh', 'Tamil Nadu', 'Karnataka', 'West Bengal'
]

export default function Crops() {
  const { t } = useTranslation()
  const { activeFarm } = useFarmStore()
  
  // Recommend form state
  const [ph, setPh] = useState(6.5)
  const [nitrogen, setNitrogen] = useState(60)
  const [phosphorus, setPhosphorus] = useState(40)
  const [potassium, setPotassium] = useState(50)
  const [locationName, setLocationName] = useState('Maharashtra')
  const [season, setSeason] = useState('Kharif')
  const [water, setWater] = useState('HIGH')
  
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [selectedCrop, setSelectedCrop] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [loadingCalendar, setLoadingCalendar] = useState(false)

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

  // Auto-fill form from latest soil report if available
  useEffect(() => {
    const loadLatestSoil = async () => {
      if (!activeFarm) return
      try {
        const soilHistory = await apiFetch(`/api/v1/soil/history/${activeFarm.id}`)
        if (soilHistory && soilHistory.length > 0) {
          const latest = soilHistory[0]
          setPh(latest.ph_level)
          setNitrogen(Math.round(latest.nitrogen))
          setPhosphorus(Math.round(latest.phosphorus))
          setPotassium(Math.round(latest.potassium))
          toast.success(t('crops.soilPrefilledToast'))
        }
      } catch (err) {
        console.error("Could not load latest soil metrics:", err)
      }
    }
    loadLatestSoil()
  }, [activeFarm, apiFetch, t])

  const handleRecommend = async (e) => {
    e.preventDefault()
    setLoading(true)
    setRecommendations([])
    setSelectedCrop(null)
    setCalendar(null)

    const payload = {
      ph: parseFloat(ph),
      nitrogen: parseFloat(nitrogen),
      phosphorus: parseFloat(phosphorus),
      potassium: parseFloat(potassium),
      location: locationName,
      season: season,
      water_availability: water
    }

    try {
      const data = await apiFetch('/api/v1/crops/recommend', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      setRecommendations(data || [])
      toast.success(t('crops.recsLoadedToast'))
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const fetchCalendar = async (crop) => {
    setSelectedCrop(crop)
    setLoadingCalendar(true)
    setCalendar(null)
    try {
      const data = await apiFetch(`/api/v1/crops/calendar/${crop.crop_name}/${locationName}`)
      setCalendar(data)
    } catch (err) {
      toast.error(t('common.error'))
    } finally {
      setLoadingCalendar(false)
    }
  }

  const handleRegisterCrop = async () => {
    if (!activeFarm || !selectedCrop) return
    try {
      const payload = {
        farm_id: activeFarm.id,
        crop_name: selectedCrop.crop_name,
        variety: "Standard",
        sown_date: new Date().toISOString().split('T')[0],
        status: "growing"
      }
      await apiFetch('/api/v1/crops', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      toast.success(t('crops.cropRegisteredToast', { crop: selectedCrop.crop_name }))
    } catch (err) {
      toast.error(t('crops.registerFailedToast'))
    }
  }

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{t('crops.title')}</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>{t('crops.subtitle')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Recommend parameters */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>{t('crops.targetParameters')}</h3>
            <form onSubmit={handleRecommend} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('crops.locationTerritory')}</label>
                  <select
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    {STATES.map(s => <option key={s} value={s} style={{ background: '#0a1a0a' }}>{s}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('crops.seasonality')}</label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  >
                    <option value="Kharif" style={{ background: '#0a1a0a' }}>Kharif</option>
                    <option value="Rabi" style={{ background: '#0a1a0a' }}>Rabi</option>
                    <option value="Zaid" style={{ background: '#0a1a0a' }}>Zaid / Summer</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{t('crops.waterAccess')}</label>
                <select
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                >
                  <option value="HIGH" style={{ background: '#0a1a0a' }}>{t('crops.highWater')}</option>
                  <option value="MEDIUM" style={{ background: '#0a1a0a' }}>{t('crops.mediumWater')}</option>
                  <option value="LOW" style={{ background: '#0a1a0a' }}>{t('crops.lowWater')}</option>
                </select>
              </div>

              <SliderInput label={t('crops.ph')} min={4.0} max={9.0} step={0.1} value={ph} onChange={setPh} />
              <SliderInput label={t('crops.nitrogen')} min={0} max={150} step={5} value={nitrogen} onChange={setNitrogen} />
              <SliderInput label={t('crops.phosphorus')} min={0} max={120} step={5} value={phosphorus} onChange={setPhosphorus} />
              <SliderInput label={t('crops.potassium')} min={0} max={250} step={5} value={potassium} onChange={setPotassium} />

              <button
                type="submit"
                className="glow-btn"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  opacity: loading ? 0.5 : 1
                }}
              >
                {loading ? t('crops.generating') : t('crops.generateBtn')}
              </button>
            </form>
          </div>

          {/* Recommendations and Calendar drawer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Recommendations Grid */}
            <div className="glass-card" style={{ padding: '2rem', minHeight: '260px' }}>
              <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('crops.matchingCrops')}</h3>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Skeleton width="60%" height="20px" />
                  <Skeleton width="100%" height="45px" />
                  <Skeleton width="100%" height="45px" />
                </div>
              ) : recommendations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recommendations.map((crop, idx) => (
                    <motion.div
                      key={idx}
                      onClick={() => fetchCalendar(crop)}
                      style={{
                        background: selectedCrop?.crop_name === crop.crop_name ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                        border: selectedCrop?.crop_name === crop.crop_name ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      whileHover={{ x: 3 }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>🌾 {crop.crop_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {t('crops.waterNeed')} {crop.water_need} | {t('crops.marketDemand')} {crop.market_demand}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>{crop.profitability_score}%</span>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{t('crops.marginBadge')}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
                  {t('crops.selectParamsPrompt')}
                </div>
              )}
            </div>

            {/* Calendar details */}
            <AnimatePresence>
              {selectedCrop && (
                <motion.div
                  className="glass-card"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ padding: '2rem', overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{t('crops.cropCalendarTitle', { crop: selectedCrop.crop_name })}</h3>
                    <button
                      onClick={handleRegisterCrop}
                      style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
                    >
                      {t('crops.registerGrowingBtn')}
                    </button>
                  </div>

                  {loadingCalendar ? (
                    <Skeleton width="100%" height="150px" />
                  ) : calendar ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{t('crops.sowingWindow')}</span>
                          <div style={{ fontWeight: 800, marginTop: '2px', color: '#60a5fa' }}>{calendar.sowing_window}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{t('crops.harvestWindow')}</span>
                          <div style={{ fontWeight: 800, marginTop: '2px', color: '#eab308' }}>{calendar.harvest_window}</div>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('crops.recommendedFertilizers')}</span>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem', color: '#94a3b8', lineHeight: 1.5 }}>
                          {calendar.fertilizer_schedule?.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('crops.irrigationSchedule')}</span>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '1.2rem', color: '#94a3b8', lineHeight: 1.5 }}>
                          {calendar.irrigation_schedule?.map((irr, i) => <li key={i}>{irr}</li>)}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>
    </FarmLayout>
  )
}

function SliderInput({ label, min, max, step, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#10b981', fontWeight: 800 }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', outline: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
      />
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
