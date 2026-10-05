import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

import { BACKEND_URL } from '../config'

export default function Soil() {
  const { activeFarm } = useFarmStore()
  const [ph, setPh] = useState(6.5)
  const [nitrogen, setNitrogen] = useState(60)
  const [phosphorus, setPhosphorus] = useState(40)
  const [potassium, setPotassium] = useState(50)
  const [moisture, setMoisture] = useState(30)
  const [ec, setEc] = useState(1.2)
  const [temperature, setTemperature] = useState(25)
  
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

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
      const data = await apiFetch(`/api/v1/soil/history/${activeFarm.id}`)
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
    setSubmitting(true)

    const formData = new FormData()
    formData.append('farm_id', activeFarm.id)
    formData.append('ph', ph)
    formData.append('nitrogen', nitrogen)
    formData.append('phosphorus', phosphorus)
    formData.append('potassium', potassium)
    formData.append('moisture', moisture)
    formData.append('ec', ec)
    formData.append('temperature', temperature)

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/soil/analyze`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Analysis failed")
      }

      const data = await res.json()
      setResult(data)
      toast.success("Soil analysis complete! Database and alerts updated.")
      loadHistory()
    } catch (err) {
      toast.error(err.message || "Soil analysis failed")
    } finally {
      setSubmitting(false)
    }
  }

  // Radial Gauge Calculations
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = result ? circumference - (result.soil_health_score / 100) * circumference : circumference

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Soil Health Intelligence</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>Input electrochemical readings to assess nutrient status, NPK deficiencies, crop recommendations, and fertilizer dosage forecasts.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Sliders Form Card */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', fontWeight: 800 }}>Nutrients & Sensors</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <SliderInput label="Soil pH (Potential Hydrogen)" min={0} max={14} step={0.1} value={ph} onChange={setPh} suffix="" />
              <SliderInput label="Nitrogen (N) Content (mg/kg)" min={0} max={150} step={1} value={nitrogen} onChange={setNitrogen} suffix=" mg/kg" />
              <SliderInput label="Phosphorus (P) Content (mg/kg)" min={0} max={120} step={1} value={phosphorus} onChange={setPhosphorus} suffix=" mg/kg" />
              <SliderInput label="Potassium (K) Content (mg/kg)" min={0} max={250} step={1} value={potassium} onChange={setPotassium} suffix=" mg/kg" />
              <SliderInput label="Soil Moisture Level" min={0} max={100} step={1} value={moisture} onChange={setMoisture} suffix="%" />
              <SliderInput label="Electrical Conductivity (EC) (dS/m)" min={0} max={5} step={0.1} value={ec} onChange={setEc} suffix=" dS/m" />
              <SliderInput label="Soil Temperature" min={0} max={50} step={1} value={temperature} onChange={setTemperature} suffix="°C" />

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
                {submitting ? 'Calculating soil health matrix...' : 'Analyze Soil Metrics'}
              </button>
            </form>
          </div>

          {/* Results Card */}
          <div className="glass-card" style={{ padding: '2rem', minHeight: '450px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <AnimatePresence mode="wait">
              {submitting ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  <Skeleton width="40%" height="24px" />
                  <Skeleton width="100%" height="150px" />
                  <Skeleton width="80%" height="20px" />
                  <Skeleton width="100%" height="100px" />
                </motion.div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                >
                  {/* Health Score Gauge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
                      <svg width="110" height="110" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                        <motion.circle
                          cx="60"
                          cy="60"
                          r={radius}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="10"
                          strokeDasharray={circumference}
                          initial={{ strokeDashoffset: circumference }}
                          animate={{ strokeDashoffset }}
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{result.soil_health_score}%</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>HEALTH</span>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Soil Health Report</h3>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0', lineHeight: 1.4 }}>
                        Your soil index is {result.soil_health_score >= 80 ? 'Excellent' : result.soil_health_score >= 60 ? 'Optimal' : 'Needs attention'}. Deficiencies have been registered to your ledger.
                      </p>
                    </div>
                  </div>

                  {/* Recommended Crops Grid */}
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommended Crops</h4>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {result.recommended_crops?.map((crop, idx) => (
                        <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}>
                          🌾 {crop}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* NPK Status bars */}
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>Nutrient Status</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <NutrientBar label="Nitrogen (N)" status={result.nutrient_status?.nitrogen} />
                      <NutrientBar label="Phosphorus (P)" status={result.nutrient_status?.phosphorus} />
                      <NutrientBar label="Potassium (K)" status={result.nutrient_status?.potassium} />
                    </div>
                  </div>

                  {/* Fertilizer Advice Card */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: '#eab308', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agronomy Advisor Output</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      {result.fertilizer_advice}
                    </p>
                  </div>

                </motion.div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>🌱</span>
                  <h3 style={{ margin: 0, color: '#e2e8f0' }}>No Metrics Submitted</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '320px', margin: '4px auto 0' }}>Adjust nutrients using the sliders and trigger analysis to diagnose soil health indices.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', alignItems: 'stretch' }}>
          {/* History list */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>Historical Soil Audits</h3>
            {history.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No historical reports on record for this farm.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                      <th style={{ padding: '0.75rem' }}>Tested Date</th>
                      <th style={{ padding: '0.75rem' }}>pH</th>
                      <th style={{ padding: '0.75rem' }}>N-P-K</th>
                      <th style={{ padding: '0.75rem' }}>Moisture</th>
                      <th style={{ padding: '0.75rem' }}>EC</th>
                      <th style={{ padding: '0.75rem' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{new Date(row.tested_at).toLocaleDateString()}</td>
                        <td style={{ padding: '0.75rem', fontWeight: 700 }}>{row.ph_level}</td>
                        <td style={{ padding: '0.75rem' }}>{Math.round(row.nitrogen)}-{Math.round(row.phosphorus)}-{Math.round(row.potassium)}</td>
                        <td style={{ padding: '0.75rem' }}>{Math.round(row.moisture)}%</td>
                        <td style={{ padding: '0.75rem' }}>{row.ec} dS/m</td>
                        <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 800 }}>{row.soil_health_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trend Chart */}
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>Health Index Trend</h3>
            <div style={{ flex: 1, minHeight: '220px', width: '100%' }}>
              {history.length < 2 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justify: 'center', color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
                  Need at least 2 reports to plot health progress trends.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={[...history].reverse()} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="tested_at" tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, {month:'short', day:'numeric'})} tick={{fill:'#64748b', fontSize:10}} />
                    <YAxis domain={[40, 100]} tick={{fill:'#64748b', fontSize:10}} />
                    <Tooltip contentStyle={{ background: '#0a1a0a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px' }} labelFormatter={(l) => new Date(l).toLocaleDateString()} />
                    <Line type="monotone" dataKey="soil_health_score" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} name="Health Index" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

      </div>
    </FarmLayout>
  )
}

function SliderInput({ label, min, max, step, value, onChange, suffix }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#10b981', fontWeight: 800 }}>{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '3px',
          outline: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer'
        }}
      />
    </div>
  )
}

function NutrientBar({ label, status }) {
  const getStatusDetails = (s) => {
    switch (String(s).toUpperCase()) {
      case 'DEFICIENT': return { color: '#ef4444', percent: 30, text: 'Deficient (Low)' }
      case 'EXCESS': return { color: '#eab308', percent: 100, text: 'Excess (High)' }
      default: return { color: '#22c55e', percent: 70, text: 'Optimal' }
    }
  }

  const { color, percent, text } = getStatusDetails(status)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{text}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'all 0.5s' }} />
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
