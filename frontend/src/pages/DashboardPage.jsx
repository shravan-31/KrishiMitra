/**
 * KrishiMitra — Premium Intelligent Agriculture Dashboard
 *
 * Full-scale integration of ML models, database ledger operations,
 * crop calendar, disease/pest diagnostics, and real-time WebSocket alerts.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

import { BACKEND_URL } from '../config';

// Custom CSS styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #040804 0%, #081408 50%, #0c200c 100%)',
    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    background: 'rgba(255,255,255,0.02)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1.4rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #4ade80, #34d399, #22d3ee)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    cursor: 'pointer',
  },
  profile: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '2px solid #10b981',
    objectFit: 'cover',
  },
  farmSelector: {
    padding: '0.5rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  },
  main: {
    flex: 1,
    display: 'flex',
    padding: '1.5rem',
    gap: '1.5rem',
    maxWidth: '1600px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  sidebar: {
    width: '260px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  content: {
    flex: 1,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '24px',
    padding: '2rem',
    backdropFilter: 'blur(20px)',
    boxSizing: 'border-box',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 120px)',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1.25rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '12px',
    color: '#94a3b8',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.3s ease',
    outline: 'none',
  },
  activeTabBtn: {
    background: 'rgba(16,185,129,0.08)',
    borderLeft: '4px solid #10b981',
    color: '#10b981',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '1.5rem',
    backdropFilter: 'blur(8px)',
  },
  glassInput: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#fff',
    outline: 'none',
    fontFamily: "'Inter', sans-serif",
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
  },
  notificationBanner: {
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    color: '#34d399',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.25rem',
  },
  badge: {
    padding: '0.25rem 0.6rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
  }
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  
  // State
  const [farms, setFarms] = useState([]);
  const [activeFarmId, setActiveFarmId] = useState(null);
  const [crops, setCrops] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Farm Modal
  const [showFarmModal, setShowFarmModal] = useState(false);
  const [newFarm, setNewFarm] = useState({
    farm_name: '', location: '', state: 'Maharashtra', district: 'Pune', area_acres: 5.0, soil_type: 'Clayey'
  });
  
  // Crop Modal
  const [showCropModal, setShowCropModal] = useState(false);
  const [newCrop, setNewCrop] = useState({
    crop_name: 'Rice', variety: '', sown_date: '', harvest_date: '', area_acres: 2.0, status: 'growing'
  });
  
  // Scanner state
  const [scanType, setScanType] = useState('disease'); // disease or pest
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [scanning, setScanning] = useState(false);
  
  // Soil state
  const [soilMetrics, setSoilMetrics] = useState({
    nitrogen: 65, phosphorus: 45, potassium: 50, ph_level: 6.5, moisture: 35.0, organic_matter: 2.8, ec: 1.1
  });
  const [soilResult, setSoilResult] = useState(null);
  const [soilHistory, setSoilHistory] = useState([]);
  const [submittingSoil, setSubmittingSoil] = useState(false);
  
  // Yield state
  const [yieldReq, setYieldReq] = useState({
    crop_name: 'Rice', area_acres: 2.0, season: 'Kharif', state: 'Maharashtra', district: 'Pune'
  });
  const [yieldResult, setYieldResult] = useState(null);
  const [yieldHistory, setYieldHistory] = useState([]);
  const [submittingYield, setSubmittingYield] = useState(false);
  
  // Market state
  const [marketCrop, setMarketCrop] = useState('Rice');
  const [marketForecast, setMarketForecast] = useState(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  
  // Ledger state
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [newExpense, setNewExpense] = useState({ category: 'Seed', amount: '', description: '' });
  
  // Calendar state
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ task_name: '', task_type: 'irrigation', urgency: 'NORMAL', scheduled_at: '' });
  
  // WS Notification Toasts
  const [notifications, setNotifications] = useState([]);
  
  // Fetch Helper
  const apiFetch = useCallback(async (path, options = {}) => {
    options.credentials = 'include';
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const res = await fetch(`${BACKEND_URL}${path}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error occurred' }));
      throw new Error(err.detail || 'API failure');
    }
    return res.json();
  }, []);

  // Real-time WebSocket connection
  useEffect(() => {
    if (!activeFarmId) return;
    
    // Connect WebSocket
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = BACKEND_URL ? BACKEND_URL.replace(/^https?:\/\//, '') : window.location.host;
    const wsUrl = `${wsProto}//${wsHost}/ws/${activeFarmId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && data.type !== 'echo') {
          // Add to notifications
          setNotifications(prev => [data, ...prev].slice(0, 5));
          
          // Refresh appropriate views depending on websocket alert trigger
          if (data.type === 'financial_update') {
            fetchFinancials(activeFarmId);
          } else if (data.type === 'calendar_update') {
            fetchTasks(activeFarmId);
          }
        }
      } catch (err) {
        console.error('WS JSON parse error:', err);
      }
    };
    
    ws.onerror = (e) => console.log('WS Connection error:', e);
    
    return () => {
      ws.close();
    };
  }, [activeFarmId]);

  // Load Farms
  const loadFarms = useCallback(async () => {
    try {
      const data = await apiFetch('/farms');
      setFarms(data);
      if (data.length > 0 && !activeFarmId) {
        setActiveFarmId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load farms:', err);
    }
  }, [activeFarmId, apiFetch]);

  useEffect(() => {
    loadFarms();
  }, []);

  // Fetch all farm details when active farm changes
  const fetchFarmDetails = useCallback(async (farmId) => {
    if (!farmId) return;
    try {
      // 1. Crops
      const cropsData = await apiFetch(`/crops?farm_id=${farmId}`);
      setCrops(cropsData);
      
      // 2. Financial Ledger
      fetchFinancials(farmId);
      
      // 3. Calendar Tasks
      fetchTasks(farmId);
      
      // 4. Diagnostic histories
      const dHistory = await apiFetch(`/disease/scans?farm_id=${farmId}`);
      setScanHistory(dHistory);
      
      const sHistory = await apiFetch(`/soil/reports?farm_id=${farmId}`);
      setSoilHistory(sHistory);
      
      const yHistory = await apiFetch(`/yield/predictions?farm_id=${farmId}`);
      setYieldHistory(yHistory);
      
    } catch (err) {
      console.error('Error fetching farm details:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (activeFarmId) {
      fetchFarmDetails(activeFarmId);
    }
  }, [activeFarmId, fetchFarmDetails]);

  // Fetch Financial Data
  const fetchFinancials = async (farmId) => {
    try {
      const exData = await apiFetch(`/expenses?farm_id=${farmId}`);
      setExpenses(exData);
      const summData = await apiFetch(`/season-summary?farm_id=${farmId}`);
      setSummary(summData);
    } catch (err) {
      console.log('Error loading financials:', err);
    }
  };

  // Fetch Calendar Tasks
  const fetchTasks = async (farmId) => {
    try {
      const tasksData = await apiFetch(`/calendar?farm_id=${farmId}`);
      setTasks(tasksData);
    } catch (err) {
      console.log('Error loading tasks:', err);
    }
  };

  // Create Farm handler
  const handleCreateFarm = async (e) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/farms', {
        method: 'POST',
        body: JSON.stringify(newFarm)
      });
      setFarms(prev => [...prev, data]);
      setActiveFarmId(data.id);
      setShowFarmModal(false);
      setNewFarm({ farm_name: '', location: '', state: 'Maharashtra', district: 'Pune', area_acres: 5.0, soil_type: 'Clayey' });
    } catch (err) {
      alert('Failed to create farm: ' + err.message);
    }
  };

  // Add Crop handler
  const handleAddCrop = async (e) => {
    e.preventDefault();
    try {
      const cropPayload = { ...newCrop, farm_id: activeFarmId };
      const data = await apiFetch('/crops', {
        method: 'POST',
        body: JSON.stringify(cropPayload)
      });
      setCrops(prev => [...prev, data]);
      setShowCropModal(false);
      setNewCrop({ crop_name: 'Rice', variety: '', sown_date: '', harvest_date: '', area_acres: 2.0, status: 'growing' });
    } catch (err) {
      alert('Failed to add crop: ' + err.message);
    }
  };

  // Image scanner handler
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setScanResult(null);
    }
  };

  const handleScanSubmit = async () => {
    if (!selectedFile) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('farm_id', activeFarmId);
      formData.append('file', selectedFile);
      
      const endpoint = scanType === 'disease' ? '/api/v1/disease/scan' : '/api/v1/pest/detect';
      
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!res.ok) throw new Error('Inference scan failed');
      const data = await res.json();
      
      setScanResult(data);
      
      // Refresh scan histories
      if (scanType === 'disease') {
        setScanHistory(prev => [data, ...prev]);
      } else {
        // Refresh latest pest scan
        fetchFarmDetails(activeFarmId);
      }
    } catch (err) {
      alert('Scanning failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  // Soil Report handler
  const handleSoilSubmit = async (e) => {
    e.preventDefault();
    setSubmittingSoil(true);
    try {
      const payload = { ...soilMetrics, farm_id: activeFarmId };
      const data = await apiFetch('/soil/report', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setSoilResult(data);
      setSoilHistory(prev => [data, ...prev]);
      // Update predictions/summaries
      fetchFarmDetails(activeFarmId);
    } catch (err) {
      alert('Soil submission failed: ' + err.message);
    } finally {
      setSubmittingSoil(false);
    }
  };

  // Yield Pred handler
  const handleYieldSubmit = async (e) => {
    e.preventDefault();
    setSubmittingYield(true);
    try {
      const payload = { ...yieldReq, farm_id: activeFarmId };
      const data = await apiFetch('/yield/predict', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setYieldResult(data);
      setYieldHistory(prev => [data, ...prev]);
      fetchFinancials(activeFarmId);
    } catch (err) {
      alert('Yield estimation failed: ' + err.message);
    } finally {
      setSubmittingYield(false);
    }
  };

  // Mandi Price Forecast fetcher
  const loadMarketData = useCallback(async (crop) => {
    setLoadingMarket(true);
    try {
      const data = await apiFetch(`/market/forecast?crop=${crop}`);
      setMarketForecast(data);
    } catch (err) {
      console.error('Market forecast failed:', err);
    } finally {
      setLoadingMarket(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (activeTab === 'market') {
      loadMarketData(marketCrop);
    }
  }, [activeTab, marketCrop, loadMarketData]);

  // Expense Logger
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newExpense,
        farm_id: activeFarmId,
        amount: parseFloat(newExpense.amount)
      };
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setNewExpense({ category: 'Seed', amount: '', description: '' });
      fetchFinancials(activeFarmId);
    } catch (err) {
      alert('Expense logging failed: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
      fetchFinancials(activeFarmId);
    } catch (err) {
      alert('Expense deletion failed');
    }
  };

  // Calendar task Logger
  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newTask,
        farm_id: activeFarmId,
        scheduled_at: new Date(newTask.scheduled_at).toISOString()
      };
      await apiFetch('/calendar', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setNewTask({ task_name: '', task_type: 'irrigation', urgency: 'NORMAL', scheduled_at: '' });
      fetchTasks(activeFarmId);
    } catch (err) {
      alert('Task scheduling failed');
    }
  };

  const handleToggleTask = async (id, isCompleted) => {
    try {
      await apiFetch(`/calendar/${id}/complete?completed=${!isCompleted}`, {
        method: 'PUT'
      });
      fetchTasks(activeFarmId);
    } catch (err) {
      alert('Failed to update task');
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await apiFetch(`/calendar/${id}`, { method: 'DELETE' });
      fetchTasks(activeFarmId);
    } catch (err) {
      alert('Failed to delete task');
    }
  };

  // Custom SVG Chart rendering historical + forecasted prices
  const renderMarketChart = () => {
    if (!marketForecast) return null;
    const { historical_prices, forecast_prices } = marketForecast;
    const allPrices = [...historical_prices, ...forecast_prices];
    const min = Math.min(...allPrices) * 0.98;
    const max = Math.max(...allPrices) * 1.02;
    const range = max - min;
    
    const width = 800;
    const height = 300;
    const padding = 40;
    
    const getX = (index) => padding + (index / (allPrices.length - 1)) * (width - padding * 2);
    const getY = (price) => height - padding - ((price - min) / range) * (height - padding * 2);
    
    // Draw grid lines
    const gridY = [getY(min), getY(min + range/2), getY(max)];
    
    // Historic path
    let histPoints = historical_prices.map((p, idx) => `${getX(idx)},${getY(p)}`).join(' ');
    
    // Forecast path (starts at last historic price)
    let forePoints = [
      `${getX(historical_prices.length - 1)},${getY(historical_prices[historical_prices.length - 1])}`,
      ...forecast_prices.map((p, idx) => `${getX(historical_prices.length + idx)},${getY(p)}`)
    ].join(' ');
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
        {/* Grid lines */}
        <line x1={padding} y1={getY(min)} x2={width - padding} y2={getY(min)} stroke="rgba(255,255,255,0.05)" />
        <line x1={padding} y1={getY(min + range/2)} x2={width - padding} y2={getY(min + range/2)} stroke="rgba(255,255,255,0.05)" />
        <line x1={padding} y1={getY(max)} x2={width - padding} y2={getY(max)} stroke="rgba(255,255,255,0.05)" />
        
        {/* Labels */}
        <text x={10} y={getY(max) + 5} fill="#64748b" fontSize="10">{Math.round(max)}</text>
        <text x={10} y={getY(min + range/2) + 5} fill="#64748b" fontSize="10">{Math.round(min + range/2)}</text>
        <text x={10} y={getY(min) + 5} fill="#64748b" fontSize="10">{Math.round(min)}</text>
        
        {/* Historical Price line */}
        <polyline fill="none" stroke="#10b981" strokeWidth="3" points={histPoints} />
        
        {/* Forecast Price line (Dotted) */}
        <polyline fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" points={forePoints} />
        
        {/* Data points */}
        {historical_prices.map((p, idx) => (
          <circle key={`hist-${idx}`} cx={getX(idx)} cy={getY(p)} r="4" fill="#10b981" />
        ))}
        {forecast_prices.map((p, idx) => (
          <circle key={`fore-${idx}`} cx={getX(historical_prices.length + idx)} cy={getY(p)} r="4" fill="#3b82f6" />
        ))}
      </svg>
    );
  };

  const getSeverityColor = (sev) => {
    switch(String(sev).toUpperCase()) {
      case 'CRITICAL': return { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' };
      case 'HIGH': return { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b' };
      case 'MEDIUM': return { bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.4)', text: '#3b82f6' };
      default: return { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)', text: '#10b981' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Real-time Notification Banner */}
      <AnimatePresence>
        {notifications.map((notif, index) => (
          <motion.div
            key={index}
            style={{
              ...styles.notificationBanner,
              position: 'fixed',
              top: `${20 + index * 70}px`,
              right: '20px',
              zIndex: 100,
              width: '380px',
              background: getSeverityColor(notif.severity).bg,
              border: `1px solid ${getSeverityColor(notif.severity).border}`,
              color: getSeverityColor(notif.severity).text,
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>📢 {notif.title}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>{notif.message}</div>
            </div>
            <button
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 900 }}
              onClick={() => setNotifications(prev => prev.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.logo} onClick={() => setActiveTab('overview')}>
          <span>🌾</span>
          <span>KrishiMitra</span>
        </div>
        
        {farms.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Active Farm:</span>
            <select
              style={styles.farmSelector}
              value={activeFarmId || ''}
              onChange={(e) => setActiveFarmId(parseInt(e.target.value))}
            >
              {farms.map(f => (
                <option key={f.id} value={f.id}>{f.farm_name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={styles.profile}>
          {user.avatar_url && (
            <img src={user.avatar_url} alt={user.full_name} style={styles.avatar} referrerPolicy="no-referrer" />
          )}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{user.full_name}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.email}</div>
          </div>
          <button
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.8rem',
            }}
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main body */}
      <div style={styles.main}>
        {/* Navigation Sidebar */}
        <div style={styles.sidebar}>
          <button style={{ ...styles.tabBtn, ...(activeTab === 'overview' ? styles.activeTabBtn : {}) }} onClick={() => setActiveTab('overview')}>
            <span>🏠</span> Overview
          </button>
          <button style={{ ...styles.tabBtn, ...(activeTab === 'scanner' ? styles.activeTabBtn : {}) }} onClick={() => setActiveTab('scanner')}>
            <span>🔍</span> Crop Scanner
          </button>
          <button style={{ ...styles.tabBtn, ...(activeTab === 'soil' ? styles.activeTabBtn : {}) }} onClick={() => setActiveTab('soil')}>
            <span>🌱</span> Soil Intelligence
          </button>
          <button style={{ ...styles.tabBtn, ...(activeTab === 'market' ? styles.activeTabBtn : {}) }} onClick={() => setActiveTab('market')}>
            <span>📈</span> Market Prices
          </button>
          <button style={{ ...styles.tabBtn, ...(activeTab === 'calendar' ? styles.activeTabBtn : {}) }} onClick={() => setActiveTab('calendar')}>
            <span>📅</span> Task Calendar
          </button>
          <button style={{ ...styles.tabBtn, ...(activeTab === 'financial' ? styles.activeTabBtn : {}) }} onClick={() => setActiveTab('financial')}>
            <span>💰</span> Financial Ledger
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '1rem 0' }} />

          <button
            style={styles.primaryBtn}
            onClick={() => setShowFarmModal(true)}
          >
            + Create New Farm
          </button>
        </div>

        {/* Content View area */}
        <div style={styles.content}>
          {farms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <span style={{ fontSize: '4rem' }}>🚜</span>
              <h2>Welcome to KrishiMitra!</h2>
              <p style={{ color: '#64748b', maxWidth: '400px', margin: '1rem auto 2rem' }}>
                To unlock AI crop diagnostics, soil health metrics, yield predictions, and mandi price forecasting, create your first farm boundary.
              </p>
              <button style={styles.primaryBtn} onClick={() => setShowFarmModal(true)}>
                Initialize Farm Now
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Farm Overview</h1>
                      <p style={{ color: '#64748b', margin: '4px 0 0' }}>Manage fields, crops, and live statuses.</p>
                    </div>
                    <button style={styles.primaryBtn} onClick={() => setShowCropModal(true)}>
                      + Add New Crop
                    </button>
                  </div>

                  {/* Crops Cards List */}
                  <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Cultivated Crops</h3>
                  {crops.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.01)', borderRadius: '16px' }}>
                      <p style={{ color: '#64748b' }}>No active crops recorded. Add one above to begin tracking.</p>
                    </div>
                  ) : (
                    <div style={styles.grid}>
                      {crops.map(crop => (
                        <div key={crop.id} style={styles.card}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{crop.crop_name}</h4>
                              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '2px 0 0' }}>Variety: {crop.variety || 'Standard'}</p>
                            </div>
                            <span style={{
                              ...styles.badge,
                              background: crop.status === 'growing' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                              color: crop.status === 'growing' ? '#10b981' : '#3b82f6'
                            }}>{crop.status}</span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                            <div>
                              <span style={{ color: '#64748b' }}>Sown Date:</span>
                              <div style={{ fontWeight: 600 }}>{crop.sown_date ? new Date(crop.sown_date).toLocaleDateString() : 'N/A'}</div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Area:</span>
                              <div style={{ fontWeight: 600 }}>{crop.area_acres} Acres</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div style={{ ...styles.grid, marginTop: '2.5rem' }}>
                    <div style={{ ...styles.card, background: 'rgba(16,185,129,0.02)', borderColor: 'rgba(16,185,129,0.1)' }}>
                      <span style={{ fontSize: '1.5rem' }}>📊</span>
                      <h4 style={{ margin: '0.5rem 0 0.25rem', color: '#64748b' }}>Season Summary</h4>
                      <h2 style={{ margin: 0, fontSize: '1.8rem' }}>
                        {summary.length > 0 ? `₹${summary[0].profit_loss.toLocaleString('en-IN')}` : '₹0.0'}
                      </h2>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0' }}>Net Profit/Loss projection</p>
                    </div>

                    <div style={{ ...styles.card, background: 'rgba(59,130,246,0.02)', borderColor: 'rgba(59,130,246,0.1)' }}>
                      <span style={{ fontSize: '1.5rem' }}>🌾</span>
                      <h4 style={{ margin: '0.5rem 0 0.25rem', color: '#64748b' }}>Estimated Yield</h4>
                      <h2 style={{ margin: 0, fontSize: '1.8rem' }}>
                        {summary.length > 0 ? `${summary[0].yield_kg.toLocaleString()} kg` : '0 kg'}
                      </h2>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0' }}>Projected production total</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'scanner' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>AI Crop Scanner</h1>
                  <p style={{ color: '#64748b', margin: '0 0 2rem' }}>Fine-tuned MobileNetV2 and EfficientNet-B0 vision models detect leaf diseases & pests.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Left: Input Selection */}
                    <div style={styles.card}>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <button
                          style={{
                            flex: 1, padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 700,
                            background: scanType === 'disease' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                            color: scanType === 'disease' ? '#10b981' : '#64748b'
                          }}
                          onClick={() => { setScanType('disease'); setScanResult(null); }}
                        >
                          🍂 Leaf Disease
                        </button>
                        <button
                          style={{
                            flex: 1, padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 700,
                            background: scanType === 'pest' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                            color: scanType === 'pest' ? '#10b981' : '#64748b'
                          }}
                          onClick={() => { setScanType('pest'); setScanResult(null); }}
                        >
                          🐛 Insect Pest
                        </button>
                      </div>

                      <div style={{
                        border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '12px', padding: '2rem', textAlign: 'center',
                        background: 'rgba(0,0,0,0.1)', position: 'relative', cursor: 'pointer', marginBottom: '1.5rem'
                      }}>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                          onChange={handleImageChange}
                        />
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '8px' }} />
                        ) : (
                          <div>
                            <span style={{ fontSize: '2.5rem' }}>📸</span>
                            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>Click to select leaf or pest image</p>
                          </div>
                        )}
                      </div>

                      <button
                        style={{ ...styles.primaryBtn, width: '100%' }}
                        onClick={handleScanSubmit}
                        disabled={!selectedFile || scanning}
                      >
                        {scanning ? 'Running Neural Net Inference...' : 'Run Diagnostics Scan'}
                      </button>
                    </div>

                    {/* Right: Diagnosis Result */}
                    <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {scanResult ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>
                              {scanType === 'disease' 
                                ? (scanResult.disease_name || scanResult.prediction?.disease || (typeof scanResult.prediction === 'string' ? scanResult.prediction : null) || 'Crop Leaf Analysis') 
                                : (scanResult.pest_name || (typeof scanResult.prediction === 'string' ? scanResult.prediction : null) || 'Pest Identification')}
                            </h3>
                            <span style={{
                              ...styles.badge,
                              background: getSeverityColor(scanResult.severity || 'MEDIUM').bg,
                              color: getSeverityColor(scanResult.severity || 'MEDIUM').text
                            }}>{scanResult.severity || 'MODERATE'}</span>
                          </div>
                          
                          <div style={{ marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Inference Confidence:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '4px' }}>
                              <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, Math.round(scanResult.confidence > 1 ? scanResult.confidence : (scanResult.confidence || 0.85) * 100))}%`, height: '100%', background: '#10b981' }} />
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{Math.round(scanResult.confidence > 1 ? scanResult.confidence : (scanResult.confidence || 0.85) * 100)}%</span>
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                            <h5 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase' }}>Recommended Actions</h5>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
                              {((scanResult.treatment || '').split(' | ').filter(Boolean).length > 0
                                ? (scanResult.treatment || '').split(' | ').filter(Boolean)
                                : ['Inspect foliage symptoms closely and apply balanced crop nutrition.']
                              ).map((tr, idx) => (
                                <li key={idx} style={{ marginBottom: '4px' }}>{tr}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                          <span style={{ fontSize: '3rem' }}>🔬</span>
                          <p>Perform scan to inspect AI diagnostics and agricultural recommendations.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'soil' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>Soil & Yield Intelligence</h1>
                  <p style={{ color: '#64748b', margin: '0 0 2rem' }}>Input NPK soil testing metrics to forecast crop recommendations (XGBoost) and predict yield tonnage (Gradient Boosting).</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                    {/* Left: Input parameters */}
                    <div style={styles.card}>
                      <h3 style={{ margin: '0 0 1.5rem' }}>Enter Soil Metrics</h3>
                      <form onSubmit={handleSoilSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nitrogen (N)</label>
                          <input type="number" style={styles.glassInput} value={soilMetrics.nitrogen} onChange={(e) => setSoilMetrics({ ...soilMetrics, nitrogen: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Phosphorus (P)</label>
                          <input type="number" style={styles.glassInput} value={soilMetrics.phosphorus} onChange={(e) => setSoilMetrics({ ...soilMetrics, phosphorus: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Potassium (K)</label>
                          <input type="number" style={styles.glassInput} value={soilMetrics.potassium} onChange={(e) => setSoilMetrics({ ...soilMetrics, potassium: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>pH Level</label>
                          <input type="number" step="0.1" style={styles.glassInput} value={soilMetrics.ph_level} onChange={(e) => setSoilMetrics({ ...soilMetrics, ph_level: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Moisture (%)</label>
                          <input type="number" style={styles.glassInput} value={soilMetrics.moisture} onChange={(e) => setSoilMetrics({ ...soilMetrics, moisture: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Organic Matter (%)</label>
                          <input type="number" step="0.1" style={styles.glassInput} value={soilMetrics.organic_matter} onChange={(e) => setSoilMetrics({ ...soilMetrics, organic_matter: parseFloat(e.target.value) })} />
                        </div>

                        <button type="submit" style={{ ...styles.primaryBtn, gridColumn: 'span 2', marginTop: '1rem' }} disabled={submittingSoil}>
                          {submittingSoil ? 'Analyzing Soil...' : 'Submit Soil Report'}
                        </button>
                      </form>
                    </div>

                    {/* Right: Results / Recommendations */}
                    <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {soilResult ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Soil Recommendations</h3>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Health Score</span>
                              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{soilResult.soil_health_score}/100</div>
                            </div>
                          </div>

                          <div style={{ marginBottom: '1.5rem' }}>
                            <h5 style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Top Recommended Crops</h5>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {soilResult.recommended_crops.map((c, i) => (
                                <span key={i} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.5rem 0.85rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#10b981' }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            <h5 style={{ margin: '0 0 6px', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Fertilizer & Conditioning Advice</h5>
                            <p style={{ margin: 0 }}>{soilResult.fertilizer_advice}</p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                          <span style={{ fontSize: '3rem' }}>🧪</span>
                          <p>Submit soil sample parameters to discover crop suggestions and soil improvement tips.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual Yield Pred section */}
                  <h3 style={{ marginTop: '3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Harvest Yield Forecaster</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
                    <div style={styles.card}>
                      <form onSubmit={handleYieldSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Crop Name</label>
                          <input type="text" style={styles.glassInput} value={yieldReq.crop_name} onChange={(e) => setYieldReq({ ...yieldReq, crop_name: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Area (Acres)</label>
                          <input type="number" step="0.1" style={styles.glassInput} value={yieldReq.area_acres} onChange={(e) => setYieldReq({ ...yieldReq, area_acres: parseFloat(e.target.value) })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Season</label>
                          <select style={styles.glassInput} value={yieldReq.season} onChange={(e) => setYieldReq({ ...yieldReq, season: e.target.value })}>
                            <option value="Kharif">Kharif</option>
                            <option value="Rabi">Rabi</option>
                            <option value="Summer">Summer</option>
                            <option value="Whole Year">Whole Year</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>State</label>
                          <input type="text" style={styles.glassInput} value={yieldReq.state} onChange={(e) => setYieldReq({ ...yieldReq, state: e.target.value })} />
                        </div>

                        <button type="submit" style={{ ...styles.primaryBtn, gridColumn: 'span 2', marginTop: '1rem' }} disabled={submittingYield}>
                          {submittingYield ? 'Calculating GB model...' : 'Calculate Expected Yield'}
                        </button>
                      </form>
                    </div>

                    <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {yieldResult ? (
                        <div>
                          <h4 style={{ margin: 0, color: '#64748b' }}>Predicted Production</h4>
                          <h2 style={{ margin: '0.5rem 0', fontSize: '2rem', color: '#10b981' }}>{yieldResult.predicted_kg.toLocaleString()} kg</h2>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1rem 0' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Confidence:</span>
                              <div style={{ fontWeight: 700 }}>{Math.round(yieldResult.confidence * 100)}%</div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Estimated Revenue:</span>
                              <div style={{ fontWeight: 700 }}>₹{Math.round(yieldResult.predicted_kg * 22).toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                          
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem' }}>
                            <h5 style={{ margin: '0 0 6px', color: '#10b981' }}>Improvement Advice:</h5>
                            <p style={{ margin: 0 }}>{yieldResult.improvement_tips.split(' | ')[0]}</p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                          <span style={{ fontSize: '3rem' }}>🌾</span>
                          <p>Run the yield forecaster to calculate projected crop production weight.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'market' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>Mandi Market Price Hub</h1>
                  <p style={{ color: '#64748b', margin: '0 0 2rem' }}>Autoregressive LSTM forecasting analyzes past 30 days of mandi pricing to project a 7-day price trajectory.</p>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <button
                      style={{
                        padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 700,
                        background: marketCrop === 'Rice' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                        color: marketCrop === 'Rice' ? '#10b981' : '#64748b'
                      }}
                      onClick={() => setMarketCrop('Rice')}
                    >
                      🌾 Rice Prices
                    </button>
                    <button
                      style={{
                        padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 700,
                        background: marketCrop === 'Wheat' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)',
                        color: marketCrop === 'Wheat' ? '#10b981' : '#64748b'
                      }}
                      onClick={() => setMarketCrop('Wheat')}
                    >
                      🍞 Wheat Prices
                    </button>
                  </div>

                  {loadingMarket ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                      <p>Running LSTM sequence model forecasts...</p>
                    </div>
                  ) : (
                    <div>
                      {marketForecast && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
                          <div style={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                              <h4 style={{ margin: 0 }}>Price Trend Chart (₹ per Quintal)</h4>
                              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                                <span style={{ color: '#10b981' }}>● Historic</span>
                                <span style={{ color: '#3b82f6' }}>-- Forecasted</span>
                              </div>
                            </div>
                            {renderMarketChart()}
                          </div>

                          <div style={styles.card}>
                            <h3 style={{ margin: '0 0 1rem' }}>Mandi Projections</h3>
                            
                            <div style={{ marginBottom: '1.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Forecast Trend:</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
                                <span style={{
                                  ...styles.badge,
                                  background: marketForecast.trend === 'BULLISH' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: marketForecast.trend === 'BULLISH' ? '#10b981' : '#ef4444'
                                }}>{marketForecast.trend}</span>
                                <span style={{ fontWeight: 700 }}>{marketForecast.percent_change >= 0 ? '+' : ''}{marketForecast.percent_change}%</span>
                              </div>
                            </div>

                            <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Expected Daily Rates</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                              {marketForecast.forecast_prices.map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                  <span style={{ color: '#64748b' }}>Day {idx+1} ({new Date(marketForecast.forecast_dates[idx]).toLocaleDateString()}):</span>
                                  <span style={{ fontWeight: 600 }}>₹{p} / qtl</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>Agronomy Tasks Calendar</h1>
                  <p style={{ color: '#64748b', margin: '0 0 2rem' }}>Schedule, manage, and complete crucial field tasks. Cascades from scans auto-generate treatments.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                    {/* Tasks List */}
                    <div style={styles.card}>
                      <h3 style={{ margin: '0 0 1.5rem' }}>Pending Agronomy Schedule</h3>
                      {tasks.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No tasks scheduled. Create one to begin.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {tasks.map(t => (
                            <div key={t.id} style={{
                              display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '12px',
                              background: t.completed ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              opacity: t.completed ? 0.6 : 1
                            }}>
                              <input
                                type="checkbox"
                                checked={t.completed}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                onChange={() => handleToggleTask(t.id, t.completed)}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, textDecoration: t.completed ? 'line-through' : 'none' }}>{t.task_name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                  Type: {t.task_type} | Scheduled: {new Date(t.scheduled_at).toLocaleString()}
                                </div>
                              </div>
                              <span style={{
                                ...styles.badge,
                                background: t.urgency === 'HIGH' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                                color: t.urgency === 'HIGH' ? '#ef4444' : '#94a3b8'
                              }}>{t.urgency}</span>
                              <button
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                onClick={() => handleDeleteTask(t.id)}
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Task scheduler Form */}
                    <div style={styles.card}>
                      <h3 style={{ margin: '0 0 1.5rem' }}>Schedule Task</h3>
                      <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Task Description</label>
                          <input type="text" required style={styles.glassInput} placeholder="e.g. Apply fungicide" value={newTask.task_name} onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Task Type</label>
                          <select style={styles.glassInput} value={newTask.task_type} onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}>
                            <option value="irrigation">Irrigation</option>
                            <option value="fertilizer">Fertilizer Application</option>
                            <option value="treatment">Disease Treatment</option>
                            <option value="pest_control">Pest Control</option>
                            <option value="weeding">Weeding</option>
                            <option value="harvesting">Harvesting</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Schedule Time</label>
                          <input type="datetime-local" required style={styles.glassInput} value={newTask.scheduled_at} onChange={(e) => setNewTask({ ...newTask, scheduled_at: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Urgency</label>
                          <select style={styles.glassInput} value={newTask.urgency} onChange={(e) => setNewTask({ ...newTask, urgency: e.target.value })}>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">High</option>
                          </select>
                        </div>

                        <button type="submit" style={{ ...styles.primaryBtn, marginTop: '1rem' }}>Schedule Task</button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'financial' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 style={{ margin: '0 0 0.5rem', fontSize: '2rem', fontWeight: 800 }}>Financial Ledger</h1>
                  <p style={{ color: '#64748b', margin: '0 0 2rem' }}>Track farm expenditures, crop revenues, and seasonal net balance returns.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                    {/* Left: Expenses log list */}
                    <div style={styles.card}>
                      <h3 style={{ margin: '0 0 1.5rem' }}>Expense History</h3>
                      {expenses.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No expenses recorded for this season.</p>
                      ) : (
                        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {expenses.map(ex => (
                            <div key={ex.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem',
                              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px'
                            }}>
                              <div>
                                <span style={{
                                  ...styles.badge,
                                  background: 'rgba(255,255,255,0.08)',
                                  color: '#fff',
                                  marginRight: '8px'
                                }}>{ex.category}</span>
                                <span style={{ fontWeight: 600 }}>{ex.description || 'N/A'}</span>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(ex.date).toLocaleDateString()}</div>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontWeight: 700, color: '#ef4444' }}>- ₹{ex.amount.toLocaleString()}</span>
                                <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => handleDeleteExpense(ex.id)}>🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Log Expense Form */}
                    <div style={styles.card}>
                      <h3 style={{ margin: '0 0 1.5rem' }}>Log Expense</h3>
                      <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Category</label>
                          <select style={styles.glassInput} value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}>
                            <option value="Seed">Seeds</option>
                            <option value="Fertilizer">Fertilizers</option>
                            <option value="Pest Control">Pest Control</option>
                            <option value="Labor">Labor</option>
                            <option value="Fuel">Fuel / Machinery</option>
                            <option value="Irrigation">Irrigation</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Amount (₹)</label>
                          <input type="number" required style={styles.glassInput} value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Notes</label>
                          <input type="text" style={styles.glassInput} placeholder="e.g. Bought 50kg rice seed" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} />
                        </div>

                        <button type="submit" style={{ ...styles.primaryBtn, marginTop: '1rem' }}>Log Expense</button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Farm Creation Modal */}
      {showFarmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ ...styles.card, width: '450px', background: '#0a100a', borderColor: '#10b981' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: '#10b981' }}>Initialize Farm Boundary</h3>
            
            <form onSubmit={handleCreateFarm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Farm Name</label>
                <input type="text" required style={styles.glassInput} placeholder="e.g. Golden Harvest Fields" value={newFarm.farm_name} onChange={(e) => setNewFarm({ ...newFarm, farm_name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Location / Village</label>
                <input type="text" style={styles.glassInput} placeholder="e.g. Baramati" value={newFarm.location} onChange={(e) => setNewFarm({ ...newFarm, location: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>State</label>
                  <input type="text" style={styles.glassInput} value={newFarm.state} onChange={(e) => setNewFarm({ ...newFarm, state: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>District</label>
                  <input type="text" style={styles.glassInput} value={newFarm.district} onChange={(e) => setNewFarm({ ...newFarm, district: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Area (Acres)</label>
                  <input type="number" step="0.1" style={styles.glassInput} value={newFarm.area_acres} onChange={(e) => setNewFarm({ ...newFarm, area_acres: parseFloat(e.target.value) })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Soil Type</label>
                  <select style={styles.glassInput} value={newFarm.soil_type} onChange={(e) => setNewFarm({ ...newFarm, soil_type: e.target.value })}>
                    <option value="Alluvial">Alluvial</option>
                    <option value="Black Cotton">Black Cotton</option>
                    <option value="Red Soil">Red Soil</option>
                    <option value="Clayey">Clayey</option>
                    <option value="Sandy">Sandy Loam</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" style={{ ...styles.primaryBtn, flex: 1 }}>Register Farm</button>
                <button type="button" style={{ ...styles.primaryBtn, background: 'rgba(255,255,255,0.05)', flex: 1 }} onClick={() => setShowFarmModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crop Addition Modal */}
      {showCropModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ ...styles.card, width: '450px', background: '#0a100a', borderColor: '#10b981' }}>
            <h3 style={{ margin: '0 0 1.5rem', color: '#10b981' }}>Record Cultivated Crop</h3>
            
            <form onSubmit={handleAddCrop} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Crop Name</label>
                <select style={styles.glassInput} value={newCrop.crop_name} onChange={(e) => setNewCrop({ ...newCrop, crop_name: e.target.value })}>
                  <option value="Rice">Rice</option>
                  <option value="Wheat">Wheat</option>
                  <option value="Maize">Maize</option>
                  <option value="Sugarcane">Sugarcane</option>
                  <option value="Cotton">Cotton</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Variety</label>
                <input type="text" style={styles.glassInput} placeholder="e.g. IR-64 Basmati" value={newCrop.variety} onChange={(e) => setNewCrop({ ...newCrop, variety: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Sown Date</label>
                  <input type="date" required style={styles.glassInput} value={newCrop.sown_date} onChange={(e) => setNewCrop({ ...newCrop, sown_date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Area (Acres)</label>
                  <input type="number" step="0.1" style={styles.glassInput} value={newCrop.area_acres} onChange={(e) => setNewCrop({ ...newCrop, area_acres: parseFloat(e.target.value) })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" style={{ ...styles.primaryBtn, flex: 1 }}>Add Crop</button>
                <button type="button" style={{ ...styles.primaryBtn, background: 'rgba(255,255,255,0.05)', flex: 1 }} onClick={() => setShowCropModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
