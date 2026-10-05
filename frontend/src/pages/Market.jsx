import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

const POPULAR_CROPS = [
  'Wheat', 'Rice', 'Maize', 'Cotton', 'Soybean', 'Sugarcane', 'Tomato', 'Onion', 'Potato'
]

const MSP_MAP = {
  "wheat": 2275,
  "rice": 2183,
  "maize": 1962,
  "cotton": 6620,
  "soybean": 4600,
  "sugarcane": 315
}

export default function Market() {
  const { activeFarm } = useFarmStore()
  const [selectedCrop, setSelectedCrop] = useState('Wheat')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const [priceData, setPriceData] = useState(null)
  const [forecastData, setForecastData] = useState(null)
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

  const loadMarketInfo = useCallback(async (crop) => {
    setLoading(true)
    try {
      // 1. Fetch current price/mandis from Data.gov.in AGMARKNET
      const priceRes = await apiFetch(`/api/v1/market/prices/${crop.toLowerCase()}`)
      setPriceData(priceRes)

      // 2. Fetch 30-day LSTM forecast (Supported: Rice, Wheat)
      try {
        const forecastRes = await apiFetch(`/api/v1/market/forecast/${crop.toLowerCase()}?days=30`)
        setForecastData(forecastRes)
      } catch (forecastErr) {
        // Fix 7 & 19: Gracefully handle crops unsupported by the LSTM model
        setForecastData({
          supported_crop: false,
          error: "forecast_not_supported",
          message: `The 30-Day LSTM AI Forecast model is currently trained and verified specifically for Rice and Wheat. Price forecasting for '${crop}' is not yet supported.`,
          supported_crops: ["Rice", "Wheat"]
        })
      }
      
    } catch (err) {
      toast.error(`Failed to load market data: ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    loadMarketInfo(selectedCrop)
  }, [selectedCrop, loadMarketInfo])

  const handleSuggestionClick = (crop) => {
    setSelectedCrop(crop)
    setSearchQuery('')
    setShowSuggestions(false)
  }

  // Filter suggestion list
  const suggestions = POPULAR_CROPS.filter(
    c => c.toLowerCase().includes(searchQuery.toLowerCase()) && c.toLowerCase() !== selectedCrop.toLowerCase()
  )

  const msp = MSP_MAP[selectedCrop.toLowerCase()] || 0
  const isBelowMsp = priceData && msp > 0 && priceData.today_price < msp

  // Prepare chart data format
  const chartData = forecastData?.daily_prices.map(item => ({
    date: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    price: Math.round(item.price)
  })) || []

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Market Mandi Rates & Forecast</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
              Real-time AGMARKNET rates and ML-powered 30-day price forecasting
            </p>
          </div>

          {/* Autocomplete Input Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder={`Search crop (Current: ${selectedCrop})...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                color: '#fff',
                outline: 'none',
                fontFamily: "'Inter', sans-serif",
                boxSizing: 'border-box'
              }}
            />
            {showSuggestions && (searchQuery.length > 0 || suggestions.length > 0) && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  background: 'rgba(10, 26, 10, 0.95)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  marginTop: '0.5rem',
                  zIndex: 20,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {suggestions.map((c) => (
                  <div
                    key={c}
                    onClick={() => handleSuggestionClick(c)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.9rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    🌾 {c}
                  </div>
                ))}
                {suggestions.length === 0 && searchQuery.length > 0 && (
                  <div
                    onClick={() => handleSuggestionClick(searchQuery.trim().charAt(0).toUpperCase() + searchQuery.slice(1))}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#10b981',
                      fontWeight: 700
                    }}
                  >
                    🔍 Search for custom crop: "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Below-MSP Warning Banner */}
        <AnimatePresence>
          {isBelowMsp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '14px',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                color: '#f87171'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <div>
                <strong style={{ fontSize: '0.95rem' }}>Market Price below Minimum Support Price (MSP)!</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Current price is ₹{priceData.today_price}/qtl. Government MSP for {selectedCrop} is ₹{msp}/qtl. It is recommended to hold stock if possible, or consult government mandi portals.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div className="glass-card" style={{ height: '120px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="glass-card" style={{ height: '120px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="glass-card" style={{ height: '120px', animation: 'pulse 1.5s infinite' }}></div>
          </div>
        ) : priceData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Price Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              
              {/* Today Card */}
              <div className="glass-card" style={{ padding: '1.5rem', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: priceData.is_live ? '#4ade80' : '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>
                    {priceData.status_label || (priceData.is_live ? "Live APMC Price" : "Latest APMC Record")}
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                    {priceData.source || 'data.gov.in'}
                  </span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  ₹{priceData.today_price} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>/ qtl</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {priceData.trend === 'UP' ? (
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>▲ UP</span>
                    ) : priceData.trend === 'DOWN' ? (
                      <span style={{ color: '#f87171', fontWeight: 700 }}>▼ DOWN</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>➖ STABLE</span>
                    )}
                  </div>
                  <span>Record Date: {priceData.record_date || 'N/A'}</span>
                </div>
              </div>

              {/* Government MSP Card */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Minimum Support Price (MSP)</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  {msp > 0 ? `₹${msp}` : 'N/A'} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>{msp > 0 ? '/ qtl' : ''}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.75rem' }}>
                  {msp > 0 ? 'Assured Floor Price under Central Schemes' : 'No fixed MSP for this crop'}
                </div>
              </div>

              {/* Best market suggestion */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>APMC Market Highlight</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#06b6d4', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {priceData.best_market.split(' ')[0]}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.75rem' }}>
                  Recorded price: {priceData.best_market.split(' ').slice(1).join(' ') || 'N/A'}
                </div>
              </div>

            </div>

            {/* Mid Section: AI Forecast & Mandi list */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              
              {/* Forecast chart */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>7-Day & 30-Day AI Forecast ({selectedCrop})</h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Neural LSTM projection calibrated on historical mandi trends</span>
                  </div>
                  {forecastData && forecastData.supported_crop !== false && (
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Min: <strong style={{ color: '#fff' }}>₹{Math.round(forecastData.min)}</strong></span>
                      <span>Avg: <strong style={{ color: '#fff' }}>₹{Math.round(forecastData.avg)}</strong></span>
                      <span>Max: <strong style={{ color: '#fff' }}>₹{Math.round(forecastData.max)}</strong></span>
                    </div>
                  )}
                </div>

                <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                  {forecastData?.supported_crop === false ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🌾</span>
                      <h4 style={{ margin: '0 0 0.5rem', color: '#facc15' }}>AI Price Forecast Not Supported for {selectedCrop}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.5 }}>
                        The neural LSTM price model is calibrated for <strong>Rice</strong> and <strong>Wheat</strong>. To maintain scientific integrity, forecasts for {selectedCrop} are not synthesized.
                      </p>
                      <button
                        onClick={() => setSelectedCrop('Wheat')}
                        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                      >
                        Switch to Wheat Forecast
                      </button>
                    </div>
                  ) : forecastData?.daily_prices ? (
                    <ResponsiveContainer width="99%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} />
                        <YAxis stroke="#475569" fontSize={10} domain={['auto', 'auto']} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(10,26,10,0.95)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '0.85rem'
                          }}
                        />
                        <Area type="monotone" dataKey="price" name="Rate (₹)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      No forecast coordinates generated.
                    </div>
                  )}
                </div>
              </div>

              {/* Mandi table */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>Mandi Arrivals & Records</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {priceData.all_mandis.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.mandi}</span>
                        <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.95rem' }}>₹{m.price}<span style={{ fontSize: '0.75rem', color: '#64748b' }}>/q</span></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>Variety: {m.variety || 'Common'}</span>
                        <span>Date: {m.arrival_date || priceData.record_date || 'Recent'}</span>
                      </div>
                      {(m.min_price > 0 || m.max_price > 0) && (
                        <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#94a3b8' }}>
                          Range: ₹{m.min_price} - ₹{m.max_price}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </FarmLayout>
  )
}
