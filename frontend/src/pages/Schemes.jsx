import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

const STATES = ['Maharashtra', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Karnataka', 'Tamil Nadu', 'Bihar', 'Gujarat', 'Rajasthan', 'Madhya Pradesh']
const CATEGORIES = ['All', 'Subsidy', 'Soil', 'Insurance', 'Credit', 'Income Support', 'Infrastructure']

export default function Schemes() {
  const { activeFarm } = useFarmStore()
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Filter States
  const [selectedState, setSelectedState] = useState('Maharashtra')
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  // Apply drawer state
  const [applyModalScheme, setApplyModalScheme] = useState(null)
  const [applyDetails, setApplyDetails] = useState(null)
  const [loadingApply, setLoadingApply] = useState(false)

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

  // Sync state filter with active farm state
  useEffect(() => {
    if (activeFarm?.state) {
      setSelectedState(activeFarm.state)
    }
  }, [activeFarm])

  const loadSchemesList = useCallback(async () => {
    setLoading(true)
    try {
      const categoryQuery = selectedCategory !== 'All' ? `&category=${selectedCategory}` : ''
      const stateQuery = selectedState ? `?state=${selectedState.toLowerCase()}` : ''
      const res = await apiFetch(`/api/v1/schemes${stateQuery}${categoryQuery}`)
      setSchemes(res)
    } catch (err) {
      toast.error('Failed to load government schemes')
    } finally {
      setLoading(false)
    }
  }, [selectedState, selectedCategory, apiFetch])

  useEffect(() => {
    loadSchemesList()
  }, [loadSchemesList])

  const handleOpenApply = async (scheme) => {
    setApplyModalScheme(scheme)
    setLoadingApply(true)
    try {
      const res = await apiFetch(`/api/v1/schemes/apply/${scheme.id}`)
      setApplyDetails(res)
    } catch (err) {
      toast.error('Failed to retrieve application details')
      setApplyModalScheme(null)
    } finally {
      setLoadingApply(false)
    }
  }

  // Recommendation logic: e.g. recommend solar scheme if state is Maharashtra; crop insurance if there is weather threat, etc.
  const isRecommended = (schemeId) => {
    if (schemeId === 'soil_health_card') return true // free for all
    if (schemeId === 'mah_solar' && activeFarm?.state?.toLowerCase() === 'maharashtra') return true
    if (schemeId === 'KCC') return true // credit is always useful
    return false
  }

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Government Schemes & Subsidies</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
            Explore benefits, central programs, state-wise crop insurances, solar pump subsidies, and custom eligibility profiles
          </p>
        </div>

        {/* Filter controls */}
        <div className="glass-card" style={{ padding: '1rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Select State:</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
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
              {STATES.map((st) => (
                <option key={st} value={st} style={{ background: '#0a1a0a' }}>{st}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
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
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} style={{ background: '#0a1a0a' }}>{cat}</option>
              ))}
            </select>
          </div>

          {activeFarm && (
            <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🎯 Custom recommendations active for </span>
              <strong>{activeFarm.farm_name} ({activeFarm.state})</strong>
            </div>
          )}
        </div>

        {/* Schemes Cards Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card" style={{ height: '200px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="glass-card" style={{ height: '200px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="glass-card" style={{ height: '200px', animation: 'pulse 1.5s infinite' }}></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {schemes.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Recommendation badge */}
                {isRecommended(s.id) && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.65rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '20px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    ⭐ Eligible Recommendation
                  </div>
                )}

                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {s.category} • Crop: {s.crop}
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 800 }}>{s.name}</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '8px', lineHeight: 1.4 }}>
                    {s.description}
                  </p>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>BENEFIT</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{s.benefit}</div>
                </div>

                <button
                  onClick={() => handleOpenApply(s)}
                  className="glow-btn"
                  style={{
                    marginTop: 'auto',
                    padding: '0.6rem 1rem',
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                >
                  View Details & Apply
                </button>
              </motion.div>
            ))}
            {schemes.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
                No schemes available for the selected filters.
              </div>
            )}
          </div>
        )}

        {/* Apply Details Modal Overlay */}
        <AnimatePresence>
          {applyModalScheme && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                padding: '1rem'
              }}
              onClick={() => setApplyModalScheme(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                style={{
                  background: 'rgba(10, 26, 10, 0.95)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '24px',
                  width: '100%',
                  maxWidth: '500px',
                  padding: '2rem',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                  position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setApplyModalScheme(null)}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    fontWeight: 900
                  }}
                >
                  ✕
                </button>

                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{applyModalScheme.name}</h2>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px', display: 'inline-block' }}>
                  {applyModalScheme.category} Portal Application
                </span>

                {loadingApply ? (
                  <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ height: '30px', animation: 'pulse 1.5s infinite', background: 'rgba(255,255,255,0.03)' }}></div>
                    <div style={{ height: '80px', animation: 'pulse 1.5s infinite', background: 'rgba(255,255,255,0.03)' }}></div>
                  </div>
                ) : applyDetails && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
                    
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Benefits Description</h4>
                      <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                        {applyModalScheme.description}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Documents Required</h4>
                      <ul style={{ margin: '6px 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                        {applyDetails.documents_needed.map((doc, idx) => (
                          <li key={idx}>{doc}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>DEADLINE</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171' }}>{applyDetails.deadline}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>STATUS</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#06b6d4' }}>Registration Open</div>
                      </div>
                    </div>

                    <a
                      href={applyDetails.application_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-btn"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem',
                        color: '#fff',
                        fontWeight: 700,
                        borderRadius: '10px',
                        marginTop: '0.5rem'
                      }}
                    >
                      Visit Official Portal ↗
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </FarmLayout>
  )
}
