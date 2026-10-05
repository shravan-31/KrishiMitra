import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'

import { BACKEND_URL } from '../config'

export default function Weather() {
  const { activeFarm } = useFarmStore()
  const [lat, setLat] = useState('18.5204')
  const [lon, setLon] = useState('73.8567')
  const [loading, setLoading] = useState(false)
  const [weather, setWeather] = useState(null)
  const [alerts, setAlerts] = useState([])

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

  const fetchWeather = useCallback(async (customLat, customLon) => {
    if (!activeFarm) return
    setLoading(true)
    try {
      const latitude = parseFloat(customLat || lat)
      const longitude = parseFloat(customLon || lon)
      const data = await apiFetch(`/api/v1/weather/${latitude}/${longitude}?farm_id=${activeFarm.id}`)
      setWeather(data)
      
      // Load active alerts too
      const alertData = await apiFetch(`/api/v1/weather/alert/${activeFarm.id}`)
      setAlerts(alertData || [])
      toast.success("Weather advisories updated!")
    } catch (err) {
      toast.error(err.message || "Failed to load weather data")
    } finally {
      setLoading(false)
    }
  }, [activeFarm, lat, lon, apiFetch])

  // Get user geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude.toFixed(4)
          const userLon = position.coords.longitude.toFixed(4)
          setLat(userLat)
          setLon(userLon)
          fetchWeather(userLat, userLon)
        },
        () => {
          // Fallback to default
          fetchWeather()
        }
      )
    } else {
      fetchWeather()
    }
  }, [activeFarm])

  const getWeatherIcon = (cond) => {
    switch (String(cond).toLowerCase()) {
      case 'sunny': return '☀️'
      case 'cloudy': return '☁️'
      case 'rainy': return '🌧️'
      case 'thunderstorm': return '⛈️'
      default: return '🌤️'
    }
  }

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Weather Advisories & Alerts</h1>
            <p style={{ color: '#64748b', marginTop: '4px' }}>Real-time microclimate monitoring linked directly to crop risk forecasts and smart scheduling logic.</p>
          </div>

          {/* Coordinate picker */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              style={{ width: '80px', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.85rem' }}
            />
            <input
              type="text"
              placeholder="Lon"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              style={{ width: '80px', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '0.85rem' }}
            />
            <button
              onClick={() => fetchWeather()}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
            >
              Update
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Left panel: Current Weather Glass Card */}
          <div className="glass-card" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Skeleton width="40%" height="24px" />
                <Skeleton width="100%" height="150px" />
                <Skeleton width="70%" height="20px" />
              </div>
            ) : weather ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800 }}>{weather.temp}°C</h2>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Current Local Temperature</span>
                  </div>
                  <span style={{ fontSize: '3.5rem', animation: 'pulse-slow 3s infinite ease-in-out' }}>🌤️</span>
                </div>

                {/* Weather details dials */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <DetailDial label="Humidity" value={`${weather.humidity}%`} emoji="💧" color="#0ea5e9" />
                  <DetailDial label="Wind Speed" value={`${weather.wind_speed} km/h`} emoji="💨" color="#94a3b8" />
                  <DetailDial label="UV Index" value={`${weather.uv_index}`} emoji="☀️" color="#f59e0b" />
                  <DetailDial label="Rainfall (1h)" value={`${weather.rainfall} mm`} emoji="🌧️" color="#3b82f6" />
                </div>

                {/* Drought warning indicator */}
                {weather.drought_days > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                    ⚠️ Alert: {weather.drought_days} consecutive dry days recorded.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                <p>Allow location permissions or input coordinates above to fetch weather advisories.</p>
              </div>
            )}
          </div>

          {/* Right panel: Active Advisories & Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Advisory card */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800 }}>Farming Advisory</h3>
              {loading ? (
                <Skeleton width="100%" height="80px" />
              ) : weather?.advisory ? (
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem', color: '#34d399', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 600 }}>
                  💬 {weather.advisory}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No advisor data available.</p>
              )}
            </div>

            {/* Warnings list */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800 }}>Active Meteorological Risks</h3>
              {alerts.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                  ✅ No active weather warnings registered for your crops.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {alerts.map((al) => (
                    <div key={al.id} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f87171' }}>{al.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{al.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 7-day Forecast Row */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>7-Day Microclimate Outlook</h3>
          {loading ? (
            <div style={{ display: 'flex', gap: '1rem', overflow: 'hidden' }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} width="14%" height="120px" />
              ))}
            </div>
          ) : weather?.forecast ? (
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {weather.forecast.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: '1 0 110px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '1rem 0.5rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>{f.day}</span>
                  <span style={{ fontSize: '2rem' }}>{getWeatherIcon(f.condition)}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{f.condition}</span>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{Math.round(f.max_temp)}°</span>{' '}
                    <span>{Math.round(f.min_temp)}°</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

      </div>
    </FarmLayout>
  )
}

function DetailDial({ label, value, emoji, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
      <span style={{ fontSize: '1.8rem', color }}>{emoji}</span>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{value}</div>
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
