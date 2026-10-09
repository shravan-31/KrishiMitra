import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { useTranslation } from '../i18n'
import { BACKEND_URL } from '../config'

export default function Drought() {
  const { t } = useTranslation()
  const { activeFarm } = useFarmStore()
  
  // Assessment inputs
  const [formData, setFormData] = useState({
    crop_name: 'Cotton',
    acres: activeFarm?.area_acres || 3.0,
    water_source: 'Borewell',
    daily_water_hours: 1.5,
    pump_hp: 3.0,
    irrigation_type: 'Drip Irrigation',
    soil_type: activeFarm?.soil_type ? `${activeFarm.soil_type} Soil` : 'Medium Black Clay',
    growth_stage: 'Flowering & Pod Formation',
    district: activeFarm?.district || 'Latur'
  })

  // Analysis result state
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  // Catalogs
  const [resilientCrops, setResilientCrops] = useState([])
  const [schemes, setSchemes] = useState([])
  const [activeTab, setActiveTab] = useState('advisor') // 'advisor' | 'crops' | 'schemes'

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

  // Initial load of catalog data
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [cropsRes, schemesRes] = await Promise.all([
          apiFetch('/api/v1/drought/crops').catch(() => null),
          apiFetch('/api/v1/drought/schemes').catch(() => null)
        ])
        const cropsList = Array.isArray(cropsRes)
          ? cropsRes
          : (cropsRes?.drought_resilient_crops || [])
        const schemesList = Array.isArray(schemesRes)
          ? schemesRes
          : (schemesRes?.schemes || [])
        setResilientCrops(cropsList)
        setSchemes(schemesList)
      } catch (err) {
        console.error('Failed to load drought catalogs:', err)
      }
    }
    loadCatalogs()
  }, [apiFetch])

  // Trigger analysis
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const data = await apiFetch('/api/v1/drought/analyze', {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      setAnalysis(data)
      toast.success(t('drought.assessmentCompleteToast'))
    } catch (err) {
      toast.error(err.message || t('drought.assessmentFailedToast'))
    } finally {
      setLoading(false)
    }
  }

  // Run initial calculation on page load
  useEffect(() => {
    handleAnalyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getSeverityColor = (level) => {
    switch (level) {
      case 'CRITICAL':
        return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' }
      case 'HIGH':
        return { text: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)' }
      case 'MODERATE':
        return { text: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)' }
      default:
        return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' }
    }
  }

  const severityColor = getSeverityColor(analysis?.stress_level || 'OPTIMAL')

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '2rem' }}>🛡️</span>
              <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b, #ef4444, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('drought.title')}
              </h1>
            </div>
            <p style={{ color: '#94a3b8', margin: '0 0 0 3rem', fontSize: '0.95rem' }}>
              {t('drought.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '0.35rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setActiveTab('advisor')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'advisor' ? '#10b981' : 'transparent',
                color: activeTab === 'advisor' ? '#022c22' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
            >
              {t('drought.advisorTab')}
            </button>
            <button
              onClick={() => setActiveTab('crops')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'crops' ? '#10b981' : 'transparent',
                color: activeTab === 'crops' ? '#022c22' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
            >
              {t('drought.cropsTab')}
            </button>
            <button
              onClick={() => setActiveTab('schemes')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'schemes' ? '#10b981' : 'transparent',
                color: activeTab === 'schemes' ? '#022c22' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
            >
              {t('drought.schemesTab')}
            </button>
          </div>
        </div>

        {/* TAB 1: WATER STRESS ADVISOR */}
        {activeTab === 'advisor' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '2rem', alignItems: 'start' }}>
            
            {/* Input Form Card */}
            <div className="glass-card" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.4rem' }}>⚙️</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  {t('drought.formTitle')}
                </h3>
              </div>

              <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                    {t('drought.cropLabel')}
                  </label>
                  <select
                    className="glass-input"
                    value={formData.crop_name}
                    onChange={(e) => setFormData({ ...formData, crop_name: e.target.value })}
                  >
                    <option value="Cotton">Cotton (Kapas)</option>
                    <option value="Soybean">Soybean</option>
                    <option value="Sugarcane">Sugarcane (Us)</option>
                    <option value="Onion">Onion (Kanda)</option>
                    <option value="Tomato">Tomato</option>
                    <option value="Wheat">Wheat (Gahu)</option>
                    <option value="Maize">Maize (Makkai)</option>
                    <option value="Chickpea">Chickpea (Gram / Harbara)</option>
                    <option value="Sorghum">Sorghum (Jowar)</option>
                    <option value="Pearl Millet">Pearl Millet (Bajra)</option>
                    <option value="Pomegranate">Pomegranate (Dalimb)</option>
                    <option value="Potato">Potato (Batata)</option>
                    <option value="Rice">Rice (Paddy)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {t('drought.acresLabel')}: {formData.acres}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      max="100"
                      className="glass-input"
                      value={formData.acres}
                      onChange={(e) => setFormData({ ...formData, acres: parseFloat(e.target.value) || 1.0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {t('drought.waterSourceLabel')}
                    </label>
                    <select
                      className="glass-input"
                      value={formData.water_source}
                      onChange={(e) => setFormData({ ...formData, water_source: e.target.value })}
                    >
                      <option value="Borewell">Borewell (Deep)</option>
                      <option value="Open Well">Open Well (Vihir)</option>
                      <option value="Farm Pond">Farm Pond (Shettale)</option>
                      <option value="Canal / Lift">Canal / Lift Irrigation</option>
                      <option value="Water Tanker">Purchased Water Tanker</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {t('drought.pumpHpLabel')}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="25"
                      className="glass-input"
                      value={formData.pump_hp}
                      onChange={(e) => setFormData({ ...formData, pump_hp: parseFloat(e.target.value) || 1.0 })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {t('drought.dailyHoursLabel')}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.2"
                      max="24"
                      className="glass-input"
                      value={formData.daily_water_hours}
                      onChange={(e) => setFormData({ ...formData, daily_water_hours: parseFloat(e.target.value) || 0.5 })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                    {t('drought.irrigationMethodLabel')}
                  </label>
                  <select
                    className="glass-input"
                    value={formData.irrigation_type}
                    onChange={(e) => setFormData({ ...formData, irrigation_type: e.target.value })}
                  >
                    <option value="Drip Irrigation">Drip Irrigation (90% Water Efficiency)</option>
                    <option value="Sprinkler Irrigation">Sprinkler Irrigation (75% Water Efficiency)</option>
                    <option value="Flood Irrigation">Flood / Furrow Irrigation (50% Water Efficiency - Heavy Loss)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {t('drought.soilTextureLabel')}
                    </label>
                    <select
                      className="glass-input"
                      value={formData.soil_type}
                      onChange={(e) => setFormData({ ...formData, soil_type: e.target.value })}
                    >
                      <option value="Medium Black Clay">Medium Black Clay (Good Retention)</option>
                      <option value="Deep Black Cotton">Deep Black Cotton Soil (High Retention)</option>
                      <option value="Shallow Murrum / Gravelly">Shallow Murrum / Gravelly (Dries Fast)</option>
                      <option value="Sandy Loam">Sandy Loam (Low Retention)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                      {t('drought.growthStageLabel')}
                    </label>
                    <select
                      className="glass-input"
                      value={formData.growth_stage}
                      onChange={(e) => setFormData({ ...formData, growth_stage: e.target.value })}
                    >
                      <option value="Early Vegetative / Seedling">Early Vegetative / Seedling</option>
                      <option value="Flowering & Pod Formation">Flowering & Pod Formation (Critical)</option>
                      <option value="Fruit Setting & Boll Development">Fruit Setting & Boll Development (Critical)</option>
                      <option value="Maturity & Grain Hardening">Maturity & Grain Hardening</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                    {t('drought.districtLabel')}
                  </label>
                  <select
                    className="glass-input"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  >
                    <option value="Latur">Latur (Marathwada - Severe Scarcity)</option>
                    <option value="Beed">Beed (Marathwada - Drought Hotspot)</option>
                    <option value="Dharashiv">Dharashiv / Osmanabad</option>
                    <option value="Solapur">Solapur (Rain-shadow Belt)</option>
                    <option value="Jalna">Jalna</option>
                    <option value="Chhatrapati Sambhajinagar">Chhatrapati Sambhajinagar (Aurangabad)</option>
                    <option value="Ahmednagar">Ahmednagar</option>
                    <option value="Pune">Pune (Eastern Talukas - Baramati/Indapur)</option>
                    <option value="Nashik">Nashik (Yeola/Malegaon)</option>
                    <option value="Sangli">Sangli (Atpadi/Jath)</option>
                    <option value="Satara">Satara (Maan/Khatav)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="glow-btn"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? t('drought.calculating') : t('drought.calculateBtn')}
                </button>
              </form>
            </div>

            {/* Analysis Results View */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {loading ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderRadius: '16px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>💧</div>
                  <h3 style={{ margin: 0, color: '#38bdf8' }}>{t('drought.analyzingTitle')}</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>{t('drought.analyzingDesc')}</p>
                </div>
              ) : analysis ? (
                <>
                  {/* Status & Survival Forecast Banner */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card"
                    style={{
                      padding: '1.75rem',
                      borderRadius: '16px',
                      background: severityColor.bg,
                      border: `1px solid ${severityColor.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '2rem' }}>
                          {analysis?.stress_level === 'CRITICAL' ? '🚨' : analysis?.stress_level === 'HIGH' ? '⚠️' : analysis?.stress_level === 'MODERATE' ? '⚡' : '✅'}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('drought.stressIndexTitle')}</div>
                          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: severityColor.text }}>
                            {analysis?.stress_level || 'EVALUATING'} ({analysis?.water_stress_index ?? 0}%)
                          </h2>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', background: 'rgba(0,0,0,0.3)', padding: '0.6rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('drought.survivalHorizon')}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                          ~{analysis?.estimated_survival_days ?? 15} Days
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                      {analysis?.summary || 'Irrigation water assessment complete.'}
                    </p>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(0, analysis?.water_stress_index ?? 50))}%`,
                          background: severityColor.text,
                          transition: 'width 0.5s ease-in-out'
                        }}
                      />
                    </div>
                  </motion.div>

                  {/* Water Volume Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{t('drought.dailyDemand')}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#60a5fa' }}>
                        {(analysis?.water_balance?.crop_daily_demand_liters ?? analysis?.water_stress?.daily_demand_liters ?? 0).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>L/day</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        {t('drought.forAcresOfCrop', { acres: formData.acres, crop: formData.crop_name })}
                      </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{t('drought.deliveredWater')}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>
                        {(analysis?.water_balance?.effective_supply_liters ?? analysis?.water_stress?.daily_available_liters ?? 0).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>L/day</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        {t('drought.atEfficiency', { eff: analysis?.water_balance?.irrigation_efficiency_pct ?? 90 })}
                      </div>
                    </div>

                    <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                        {(analysis?.water_balance?.water_deficit_liters ?? analysis?.water_stress?.daily_deficit_liters ?? 0) > 0 ? t('drought.waterShortage') : t('drought.waterSurplus')}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: (analysis?.water_balance?.water_deficit_liters ?? 0) > 0 ? '#f87171' : '#4ade80' }}>
                        {(analysis?.water_balance?.water_deficit_liters ?? 0) > 0
                          ? `-${(analysis?.water_balance?.water_deficit_liters ?? 0).toLocaleString()}`
                          : `+${(analysis?.water_balance?.water_surplus_liters ?? 0).toLocaleString()}`} <span style={{ fontSize: '0.8rem' }}>L/day</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        {(analysis?.water_balance?.water_deficit_liters ?? 0) > 0 ? t('drought.deficitNeedsDefense') : t('drought.adequateMoisture')}
                      </div>
                    </div>
                  </div>

                  {/* Precision Drip Irrigation Plan */}
                  <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '1.3rem' }}>🕒</span>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {t('drought.dripScheduleTitle')}
                      </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{t('drought.optimalWindow')}</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
                          {analysis?.drip_schedule?.optimal_watering_window || '5:30 AM – 7:30 AM'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                          {t('drought.windowTip')}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{t('drought.runCycle')}</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#4ade80' }}>
                          {analysis?.drip_schedule?.recommended_run_time_per_session || '1.5 Hours'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                          {t('drought.frequency')} {analysis?.drip_schedule?.watering_frequency || 'Every 2 Days'} | {t('drought.saved')} {analysis?.drip_schedule?.water_saved_percent || '35%'}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.85rem', borderRadius: '10px', fontSize: '0.85rem', color: '#86efac' }}>
                      💡 <strong>{t('drought.actionTip')}</strong> {analysis?.drip_schedule?.tip || analysis?.drip_schedule?.guideline || 'Avoid midday watering to conserve up to 35% moisture.'}
                    </div>
                  </div>

                  {/* Emergency Protocols & Field Advice */}
                  <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '1.3rem' }}>🛠️</span>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {t('drought.protocolsTitle')}
                      </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.35rem' }}>
                          {t('drought.mulchingTitle')}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {analysis?.emergency_protocols?.mulching || 'Apply 3-inch straw mulch around root base to block surface evaporation.'}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.35rem' }}>
                          {t('drought.antiTranspirantTitle')}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {analysis?.emergency_protocols?.anti_transpirant_spray || 'Spray 5% Kaolin clay or Potassium Nitrate (1%) at sunrise to reflect excessive heat.'}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', marginBottom: '0.35rem' }}>
                          {t('drought.alternateFurrowTitle')}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {analysis?.emergency_protocols?.alternate_furrow_irrigation || 'Irrigate odd rows only this cycle to stretch available water over double the acreage.'}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f43f5e', marginBottom: '0.35rem' }}>
                          {t('drought.stagePrioritizationTitle')}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {analysis?.emergency_protocols?.stage_prioritization || 'Concentrate scarce irrigation strictly during flowering and pod/boll formation.'}
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                        {t('drought.recommendationsTitle')}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {(analysis?.actionable_recommendations || [
                          'Irrigate between 5:30 AM – 7:30 AM to stop 35% evaporative loss.',
                          'Apply straw mulching at crop root zones.',
                          'Apply for PMKSY 80% drip subsidy on Mahadbt portal.'
                        ]).map((rec, i) => (
                          <li key={i} style={{ fontSize: '0.86rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderRadius: '16px' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🛡️</span>
                  <h3 style={{ margin: '0 0 0.5rem', color: '#f8fafc' }}>{t('drought.readyTitle')}</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                    {t('drought.readyDesc')}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: DROUGHT-RESILIENT CROPS CATALOG */}
        {activeTab === 'crops' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>
                {t('drought.certifiedCropsTitle')}
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                {t('drought.certifiedCropsSubtitle')}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {resilientCrops.map((c, idx) => (
                <div
                  key={idx}
                  className="glass-card"
                  style={{
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                        {c.crop}
                      </h3>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        {c.water_savings}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {t('drought.variety')} {c.variety}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
                      <div>⏱️ <strong>{t('drought.duration')}</strong> {c.duration_days}</div>
                      <div>💧 <strong>{t('drought.irrigations')}</strong> {c.water_turns}</div>
                      <div>🌾 <strong>{t('drought.yield')}</strong> {c.yield_potential}</div>
                      <div>🏛️ <strong>{t('drought.center')}</strong> {c.institution}</div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {c.benefits}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('drought.certifiedDryland')}</span>
                    <a
                      href="https://mahadbt.maharashtra.gov.in"
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.8rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {t('drought.checkSubsidy')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: GOVERNMENT RELIEF SUBSIDIES */}
        {activeTab === 'schemes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
                {t('drought.reliefTitle')}
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                {t('drought.reliefSubtitle')}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
              {schemes.map((s, idx) => (
                <div
                  key={idx}
                  className="glass-card"
                  style={{
                    padding: '1.5rem',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                        {s.name}
                      </h3>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                        {s.benefit}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#a7f3d0', fontWeight: 600, marginBottom: '0.75rem' }}>
                      {t('drought.eligibility')} {s.eligibility}
                    </div>

                    <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                      {s.details}
                    </p>

                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>
                        {t('drought.requiredDocs')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {s.documents_needed.map((doc, dIdx) => (
                          <span
                            key={dIdx}
                            style={{
                              fontSize: '0.75rem',
                              background: 'rgba(255,255,255,0.06)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              color: '#e2e8f0'
                            }}
                          >
                            📄 {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('drought.officialPortal')}</span>
                    <a
                      href={s.portal_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '0.4rem 0.9rem',
                        background: '#10b981',
                        color: '#022c22',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                      }}
                    >
                      {t('drought.applyPortal')}
                    </a>
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
