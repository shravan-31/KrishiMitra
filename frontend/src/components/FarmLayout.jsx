import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFarmStore } from '../store/farmStore'
import { useFarmWebSocket } from '../hooks/useFarmWebSocket'
import toast, { Toaster } from 'react-hot-toast'

import { BACKEND_URL } from '../config'

export default function FarmLayout({ children }) {
  const { user, logout } = useAuth()
  const { farms, activeFarm, setFarms, setActiveFarm } = useFarmStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [loadingFarms, setLoadingFarms] = useState(true)
  const [showFarmModal, setShowFarmModal] = useState(false)
  const [submittingFarm, setSubmittingFarm] = useState(false)
  const [newFarm, setNewFarm] = useState({
    farm_name: '',
    location: '',
    state: 'Maharashtra',
    district: 'Pune',
    area_acres: 5.0,
    soil_type: 'Clayey'
  })

  // Connect WebSocket to active farm
  useFarmWebSocket(activeFarm?.id)

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

  // Load Farms
  useEffect(() => {
    const loadFarms = async () => {
      try {
        const data = await apiFetch('/api/v1/farms')
        setFarms(data)
        if (data.length > 0 && !activeFarm) {
          setActiveFarm(data[0])
        }
      } catch (err) {
        console.error('Failed to load farms:', err)
      } finally {
        setLoadingFarms(false)
      }
    }
    loadFarms()
  }, [setFarms, setActiveFarm, activeFarm, apiFetch])

  const handleCreateFarm = async (e) => {
    e.preventDefault()
    if (!newFarm.farm_name.trim()) {
      toast.error('Farm name is required')
      return
    }
    setSubmittingFarm(true)
    try {
      const data = await apiFetch('/api/v1/farms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newFarm)
      })
      const updatedFarms = [...farms, data]
      setFarms(updatedFarms)
      setActiveFarm(data)
      setShowFarmModal(false)
      setNewFarm({
        farm_name: '',
        location: '',
        state: 'Maharashtra',
        district: 'Pune',
        area_acres: 5.0,
        soil_type: 'Clayey'
      })
      toast.success(`Farm "${data.farm_name}" registered successfully!`)
    } catch (err) {
      toast.error(err.message || 'Failed to create farm')
    } finally {
      setSubmittingFarm(false)
    }
  }

  const handleFarmChange = (e) => {
    const farmId = parseInt(e.target.value)
    const selected = farms.find(f => f.id === farmId)
    if (selected) {
      setActiveFarm(selected)
      toast.success(`Switched to farm: ${selected.farm_name}`)
    }
  }

  // Create floating particles background
  const particles = Array.from({ length: 15 }).map((_, i) => {
    const emojis = ['🌾', '🍂', '🌱', '☀️', '💧']
    const emoji = emojis[i % emojis.length]
    const left = Math.random() * 100
    const delay = Math.random() * 20
    const duration = 15 + Math.random() * 20
    const size = 1 + Math.random() * 1.5

    return (
      <div
        key={i}
        className="particle"
        style={{
          position: 'fixed',
          left: `${left}%`,
          top: '100%',
          fontSize: `${size}rem`,
          animation: `floatup ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
          opacity: 0.05,
          zIndex: 0,
          pointerEvents: 'none'
        }}
      >
        {emoji}
      </div>
    )
  })

  // CSS Animations keyframes inject
  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes floatup {
        0% { transform: translateY(0vh) rotate(0deg); opacity: 0; }
        10% { opacity: 0.15; }
        90% { opacity: 0.1; }
        100% { transform: translateY(-105vh) rotate(360deg); opacity: 0; }
      }
      .glass-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: 20px;
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s;
      }
      .glass-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(74, 222, 128, 0.15);
      }
      .glow-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border: none;
        outline: none;
        transition: all 0.3s;
        cursor: pointer;
      }
      .glow-btn:hover {
        box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
        transform: scale(1.02);
      }
      .glass-input {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 0.6rem 0.85rem;
        color: #fff;
        font-size: 0.9rem;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        font-family: 'Outfit', sans-serif;
        transition: all 0.2s;
      }
      .glass-input:focus {
        border-color: #10b981;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
        background: rgba(255, 255, 255, 0.04);
      }
      @media print {
        header, aside, select, button, .glow-btn, .print-btn-float, .particle {
          display: none !important;
        }
        main {
          margin: 0 !important;
          padding: 0 !important;
          max-height: none !important;
          overflow: visible !important;
        }
        body, html, #root {
          background: #fff !important;
          color: #000 !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #020602 0%, #041004 50%, #061a06 100%)',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden'
      }}
    >
      {particles}
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'rgba(10, 26, 10, 0.9)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#e2e8f0',
          backdropFilter: 'blur(10px)',
          fontFamily: "'Outfit', sans-serif"
        }
      }} />

      {/* Navbar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          background: 'rgba(255, 255, 255, 0.01)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '1.5rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #4ade80, #34d399, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/dashboard')}
          >
            <span>🌾</span> KrishiMitra
          </div>

          {farms.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Active Farm:</span>
              <select
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
                value={activeFarm?.id || ''}
                onChange={handleFarmChange}
              >
                {farms.map(f => (
                  <option key={f.id} value={f.id} style={{ background: '#0a1a0a' }}>{f.farm_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #10b981', objectFit: 'cover' }}
                referrerPolicy="no-referrer"
              />
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{user?.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user?.email}</div>
            </div>
          </div>

          <button
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: '260px',
            background: 'rgba(255, 255, 255, 0.005)',
            borderRight: '1px solid rgba(255, 255, 255, 0.04)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', paddingLeft: '0.75rem' }}>
            Main Menu
          </div>

          <SidebarLink to="/dashboard" emoji="🏠" active={location.pathname === '/dashboard'}>Dashboard</SidebarLink>
          <SidebarLink to="/alerts" emoji="🎛️" active={location.pathname === '/alerts'}>Real-time Alerts</SidebarLink>
          <SidebarLink to="/chat" emoji="🤖" active={location.pathname === '/chat'}>AI Chat Assistant</SidebarLink>

          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1.5rem', marginBottom: '0.5rem', paddingLeft: '0.75rem' }}>
            AI Diagnostics
          </div>

          <SidebarLink to="/disease" emoji="🔬" active={location.pathname === '/disease'}>Disease Detection</SidebarLink>
          <SidebarLink to="/pest" emoji="🐛" active={location.pathname === '/pest'}>Pest Detection</SidebarLink>
          <SidebarLink to="/soil" emoji="🌱" active={location.pathname === '/soil'}>Soil Analysis</SidebarLink>
          <SidebarLink to="/crops" emoji="📍" active={location.pathname === '/crops'}>Crop Recommender</SidebarLink>
          <SidebarLink to="/yield" emoji="📊" active={location.pathname === '/yield'}>Yield Prediction</SidebarLink>

          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1.5rem', marginBottom: '0.5rem', paddingLeft: '0.75rem' }}>
            Operations & Finance
          </div>

          <SidebarLink to="/calendar" emoji="📅" active={location.pathname === '/calendar'}>Crop Calendar</SidebarLink>
          <SidebarLink to="/health" emoji="💚" active={location.pathname === '/health'}>Farm Health</SidebarLink>
          <SidebarLink to="/report" emoji="📋" active={location.pathname === '/report'}>Farm Report</SidebarLink>
          <SidebarLink to="/market" emoji="💰" active={location.pathname === '/market'}>Market Prices</SidebarLink>
          <SidebarLink to="/expenses" emoji="📒" active={location.pathname === '/expenses'}>Expense Tracker</SidebarLink>
          <SidebarLink to="/schemes" emoji="🏛️" active={location.pathname === '/schemes'}>Govt Schemes</SidebarLink>
          <SidebarLink to="/languages" emoji="🗣️" active={location.pathname === '/languages'}>Multilingual</SidebarLink>

          <div style={{ flex: 1 }} />
          <button
            className="glow-btn"
            onClick={() => setShowFarmModal(true)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: '1.5rem'
            }}
          >
            + New Farm
          </button>
        </aside>

        {/* Content area */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', maxHeight: 'calc(100vh - 75px)', boxSizing: 'border-box' }}>
          {loadingFarms ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
              <div style={{ fontSize: '3rem', animation: 'floatup 2s ease-in-out infinite' }}>🌾</div>
              <h3 style={{ marginTop: '1rem', color: '#10b981', fontWeight: 700 }}>Loading Farm Workspace...</h3>
            </div>
          ) : farms.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
              <div className="glass-card" style={{ padding: '3rem', maxWidth: '500px', textAlign: 'center', background: 'rgba(10, 26, 10, 0.45)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px' }}>
                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1.5rem' }}>🚜</span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #4ade80, #34d399, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Welcome to KrishiMitra!</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, margin: '1rem 0 2rem' }}>
                  To unlock AI crop diagnostics, soil health metrics, yield predictions, and mandi price forecasting, please create your first farm boundary.
                </p>
                <button
                  className="glow-btn"
                  onClick={() => setShowFarmModal(true)}
                  style={{
                    padding: '0.9rem 2rem',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: 700,
                  }}
                >
                  Initialize Farm Now
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Farm Creation Modal */}
      {showFarmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="glass-card" style={{ width: '450px', background: '#0a100a', border: '1px solid #10b981', padding: '2rem', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: '#10b981', fontSize: '1.4rem', fontWeight: 800 }}>Initialize Farm Boundary</h3>
            
            <form onSubmit={handleCreateFarm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Farm Name</label>
                <input type="text" required className="glass-input" placeholder="e.g. Golden Harvest Fields" value={newFarm.farm_name} onChange={(e) => setNewFarm({ ...newFarm, farm_name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Location / Village</label>
                <input type="text" className="glass-input" placeholder="e.g. Baramati" value={newFarm.location} onChange={(e) => setNewFarm({ ...newFarm, location: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>State</label>
                  <input type="text" className="glass-input" value={newFarm.state} onChange={(e) => setNewFarm({ ...newFarm, state: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>District</label>
                  <input type="text" className="glass-input" value={newFarm.district} onChange={(e) => setNewFarm({ ...newFarm, district: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Area (Acres)</label>
                  <input type="number" step="0.1" className="glass-input" value={newFarm.area_acres} onChange={(e) => setNewFarm({ ...newFarm, area_acres: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Soil Type</label>
                  <select className="glass-input" value={newFarm.soil_type} onChange={(e) => setNewFarm({ ...newFarm, soil_type: e.target.value })}>
                    <option value="Alluvial" style={{ background: '#0a100a' }}>Alluvial</option>
                    <option value="Black Cotton" style={{ background: '#0a100a' }}>Black Cotton</option>
                    <option value="Red Soil" style={{ background: '#0a100a' }}>Red Soil</option>
                    <option value="Clayey" style={{ background: '#0a100a' }}>Clayey</option>
                    <option value="Sandy Loam" style={{ background: '#0a100a' }}>Sandy Loam</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="glow-btn" style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', color: '#fff', fontWeight: 700 }} disabled={submittingFarm}>
                  {submittingFarm ? 'Registering...' : 'Register Farm'}
                </button>
                <button type="button" className="glow-btn" style={{ background: 'rgba(255,255,255,0.05)', flex: 1, padding: '0.8rem', borderRadius: '10px', color: '#fff', fontWeight: 700 }} onClick={() => setShowFarmModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarLink({ to, emoji, active, children }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.8rem 1.25rem',
        textDecoration: 'none',
        borderRadius: '12px',
        fontSize: '0.95rem',
        fontWeight: 600,
        color: active ? '#10b981' : '#94a3b8',
        background: active ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
        borderLeft: active ? '4px solid #10b981' : '4px solid transparent',
        transition: 'all 0.2s',
        marginBottom: '2px'
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
      <span>{children}</span>
    </Link>
  )
}
