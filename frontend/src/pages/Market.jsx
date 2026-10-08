import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

const POPULAR_CROPS = [
  { id: 'Soybean', label: 'Soybean', icon: '🌱' },
  { id: 'Cotton', label: 'Cotton', icon: '⚪' },
  { id: 'Onion', label: 'Onion', icon: '🧅' },
  { id: 'Tomato', label: 'Tomato', icon: '🍅' },
  { id: 'Wheat', label: 'Wheat', icon: '🌾' },
  { id: 'Rice', label: 'Rice', icon: '🍚' },
  { id: 'Maize', label: 'Maize', icon: '🌽' },
  { id: 'Potato', label: 'Potato', icon: '🥔' },
  { id: 'Sugarcane', label: 'Sugarcane', icon: '🎋' },
]

const MSP_MAP = {
  "soybean": 4892,
  "cotton": 7121,
  "wheat": 2275,
  "rice": 2300,
  "maize": 2090,
  "sugarcane": 315
}

export default function Market() {
  const { activeFarm } = useFarmStore()
  const [selectedCrop, setSelectedCrop] = useState('Soybean')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [forecastDays, setForecastDays] = useState(14) // 7 | 14 | 30
  
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

  const loadMarketInfo = useCallback(async (crop, days = 14) => {
    setLoading(true)
    try {
      // 1. Fetch current price/mandis for today
      const priceRes = await apiFetch(`/api/v1/market/prices/${crop.toLowerCase()}`)
      setPriceData(priceRes)

      // 2. Fetch today & upcoming dates forecast
      try {
        const forecastRes = await apiFetch(`/api/v1/market/forecast/${crop.toLowerCase()}?days=${days}`)
        setForecastData(forecastRes)
      } catch (forecastErr) {
        setForecastData(null)
      }
      
    } catch (err) {
      toast.error(`Failed to load market prices: ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    loadMarketInfo(selectedCrop, forecastDays)
  }, [selectedCrop, forecastDays, loadMarketInfo])

  const handleCropSelect = (cropId) => {
    setSelectedCrop(cropId)
    setSearchQuery('')
    setShowSuggestions(false)
  }

  const msp = MSP_MAP[selectedCrop.toLowerCase()] || 0
  const isBelowMsp = priceData && msp > 0 && priceData.today_price < msp

  // Prepare chart data format with formatted dates
  const chartData = forecastData?.daily_prices?.map((item, idx) => {
    const d = new Date(item.date)
    const isToday = idx === 0
    const label = isToday ? 'Today' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    return {
      date: label,
      fullDate: item.date,
      price: Math.round(item.price),
      rawPrice: item.price
    }
  }) || []

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
              🌾 Live APMC Mandi Rates & Price Forecast
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
              Real-time modal prices from APMC market yards across Maharashtra with AI-driven price projections
            </p>
          </div>

          {/* Autocomplete Input Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder={`Search crop (Selected: ${selectedCrop})...`}
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
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                color: '#fff',
                outline: 'none',
                fontFamily: "'Inter', sans-serif",
                boxSizing: 'border-box'
              }}
            />
            {showSuggestions && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  background: 'rgba(10, 26, 10, 0.98)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '12px',
                  marginTop: '0.5rem',
                  zIndex: 20,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}
              >
                {POPULAR_CROPS.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleCropSelect(c.id)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.9rem',
                      color: selectedCrop === c.id ? '#10b981' : '#e2e8f0',
                      fontWeight: selectedCrop === c.id ? 700 : 500
                    }}
                  >
                    {c.icon} {c.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Crop Selection Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
          {POPULAR_CROPS.map((c) => {
            const isSelected = selectedCrop.toLowerCase() === c.id.toLowerCase()
            return (
              <button
                key={c.id}
                onClick={() => handleCropSelect(c.id)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '24px',
                  border: isSelected ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                  background: isSelected ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)',
                  color: isSelected ? '#6ee7b7' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            )
          })}
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
                <strong style={{ fontSize: '0.95rem' }}>Market Price is Below Minimum Support Price (MSP)!</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  Current market price is ₹{priceData?.today_price}/quintal, whereas the Government MSP is ₹{msp}/quintal. If feasible, consider holding produce or registering at government procurement centers.
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              
              {/* Today Card */}
              <div className="glass-card" style={{ padding: '1.5rem', position: 'relative', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🟢 Live Average Rate (Today)
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', fontWeight: 700 }}>
                    {priceData.record_date}
                  </span>
                </div>

                <div style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '0.6rem', color: '#fff', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                  ₹{priceData.today_price} <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 600 }}>/ Quintal</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {priceData.trend === 'UP' ? (
                      <span style={{ color: '#4ade80', fontWeight: 800, background: 'rgba(34,197,94,0.12)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>▲ Up vs Yesterday (+₹{(priceData.today_price - priceData.yesterday_price).toFixed(0)})</span>
                    ) : priceData.trend === 'DOWN' ? (
                      <span style={{ color: '#f87171', fontWeight: 800, background: 'rgba(239,68,68,0.12)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>▼ Down vs Yesterday (-₹{(priceData.yesterday_price - priceData.today_price).toFixed(0)})</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>➖ Stable</span>
                    )}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Yesterday: ₹{priceData.yesterday_price}/q</span>
                </div>
              </div>

              {/* Best market suggestion */}
              <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #06b6d4' }}>
                <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⭐ Top Performing APMC Mandi
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.6rem' }}>
                  {priceData.best_market.split(' Mandi')[0] || priceData.best_market}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.6rem' }}>
                  Highest Auction Rate: <strong>{priceData.best_market.split('(')[1]?.replace(')', '') || `₹${priceData.today_price}/q`}</strong>
                </div>
              </div>

              {/* Government MSP Card */}
              <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏛️ Government MSP Benchmark
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.6rem', color: '#fff', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  {msp > 0 ? `₹${msp}` : 'N/A'} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>{msp > 0 ? '/ Quintal' : ''}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.6rem' }}>
                  {msp > 0 
                    ? (priceData.today_price >= msp ? `✅ Current price is ₹${(priceData.today_price - msp).toFixed(0)} above MSP` : `⚠️ Current price is below MSP`)
                    : 'No direct MSP established for this perishable commodity'}
                </div>
              </div>

            </div>

            {/* Advisory Note */}
            {forecastData?.advisory && (
              <div style={{
                background: forecastData.trend === 'BULLISH' ? 'rgba(16,185,129,0.08)' : (forecastData.trend === 'BEARISH' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)'),
                border: `1px solid ${forecastData.trend === 'BULLISH' ? 'rgba(16,185,129,0.3)' : (forecastData.trend === 'BEARISH' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)')}`,
                borderRadius: '14px',
                padding: '1.1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '1.6rem' }}>
                  {forecastData.trend === 'BULLISH' ? '📈' : (forecastData.trend === 'BEARISH' ? '📉' : '⚖️')}
                </span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: forecastData.trend === 'BULLISH' ? '#6ee7b7' : (forecastData.trend === 'BEARISH' ? '#fca5a5' : '#93c5fd') }}>
                    Market Intelligence & Strategic Advisory ({forecastData.trend === 'BULLISH' ? 'Bullish Trend' : (forecastData.trend === 'BEARISH' ? 'Bearish Trend' : 'Stable Trend')}):
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '2px', lineHeight: 1.4 }}>
                    {forecastData.advisory}
                  </div>
                </div>
              </div>
            )}

            {/* Mid Section: AI Forecast & Mandi list */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
              
              {/* Forecast chart & upcoming dates */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                      📊 AI Price Forecast by Upcoming Dates ({selectedCrop})
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Daily price projections for the next {forecastDays} days from today
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[7, 14, 30].map((d) => (
                      <button
                        key={d}
                        onClick={() => setForecastDays(d)}
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: '8px',
                          border: forecastDays === d ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                          background: forecastDays === d ? 'rgba(16,185,129,0.2)' : 'transparent',
                          color: forecastDays === d ? '#6ee7b7' : '#94a3b8',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min / Avg / Max stats */}
                {forecastData && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Minimum (Min)</span>
                      <div style={{ fontWeight: 800, color: '#f87171', fontSize: '1rem' }}>₹{Math.round(forecastData.min)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Average (Avg)</span>
                      <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1rem' }}>₹{Math.round(forecastData.avg)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Maximum (Max)</span>
                      <div style={{ fontWeight: 800, color: '#34d399', fontSize: '1rem' }}>₹{Math.round(forecastData.max)}</div>
                    </div>
                  </div>
                )}

                {/* Chart */}
                <div style={{ width: '100%', height: '260px', position: 'relative' }}>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="99%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.45}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(10,26,10,0.95)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '0.85rem'
                          }}
                        />
                        <Area type="monotone" dataKey="price" name="Forecast Price (₹)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      Loading forecast...
                    </div>
                  )}
                </div>

                {/* Day-by-Day Forecast Breakdown Table */}
                {forecastData?.daily_prices && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 700 }}>
                      📅 Day-by-Day Price Forecast Breakdown:
                    </h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Date</th>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Forecast Price (₹/q)</th>
                            <th style={{ padding: '0.55rem 0.75rem' }}>Expected Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastData.daily_prices.slice(0, 10).map((row, idx) => {
                            const d = new Date(row.date)
                            const isToday = idx === 0
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: isToday ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
                                <td style={{ padding: '0.5rem 0.75rem', color: isToday ? '#6ee7b7' : '#e2e8f0', fontWeight: isToday ? 800 : 500 }}>
                                  {isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                                  ₹{Math.round(row.price)}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  {row.price >= priceData.today_price ? (
                                    <span style={{ color: '#34d399', fontWeight: 700 }}>↗️ Stable / Upward</span>
                                  ) : (
                                    <span style={{ color: '#f87171', fontWeight: 700 }}>↘️ Downward</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* Mandi table */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    🏛️ Today's Rates Across APMC Mandis
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                    {priceData.all_mandis?.length || 0} Mandis Reported
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '560px', overflowY: 'auto' }}>
                  {priceData.all_mandis?.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: idx === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                        border: idx === 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: idx === 0 ? '#6ee7b7' : '#fff' }}>
                          {idx === 0 && '⭐ '} {m.mandi}
                        </span>
                        <span style={{ color: '#10b981', fontWeight: 800, fontSize: '1.05rem' }}>
                          ₹{m.price}<span style={{ fontSize: '0.75rem', color: '#64748b' }}>/q</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>Variety: <strong style={{ color: '#cbd5e1' }}>{m.variety || 'Common'}</strong></span>
                        <span>Date: <strong style={{ color: '#cbd5e1' }}>{m.arrival_date || priceData.record_date}</strong></span>
                      </div>
                      {(m.min_price > 0 || m.max_price > 0) && (
                        <div style={{ marginTop: '5px', fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Min: ₹{m.min_price}</span>
                          <span>Max: ₹{m.max_price}</span>
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
