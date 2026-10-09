import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LineChart, Line, Tooltip, CartesianGrid } from 'recharts'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

/* ───────────── Color helpers ───────────── */
const getSeverityColor = (sev) => {
  switch (String(sev).toUpperCase()) {
    case 'CRITICAL': return '#ef4444'
    case 'HIGH': return '#f97316'
    case 'MEDIUM': return '#eab308'
    case 'LOW': return '#22c55e'
    default: return '#10b981'
  }
}

const alertColors = {
  RED:    { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#f87171', glow: '#ef4444' },
  YELLOW: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#fde047', glow: '#eab308' },
  GREEN:  { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#4ade80', glow: '#22c55e' },
}

const riskColors = { HIGH: '#ef4444', MEDIUM: '#eab308', LOW: '#22c55e' }

export default function Disease() {
  const { t } = useTranslation()
  const { activeFarm } = useFarmStore()
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)

  // Camera state & refs
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' (rear) or 'user' (front)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const mobileCameraInputRef = useRef(null)

  // New state for smart features
  const [treatmentWindows, setTreatmentWindows] = useState(null)
  const [loadingWindows, setLoadingWindows] = useState(false)
  const [followupResult, setFollowupResult] = useState(null)
  const [activeTab, setActiveTab] = useState('diagnosis') // diagnosis | treatment | schedule | followup

  // Clean stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }, [])

  // Start device camera
  const startCamera = useCallback(async (facing = facingMode) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error(t('disease.cameraUnsupported'))
        return
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      setIsCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.error("Camera access error:", err)
      toast.error(t('disease.cameraDenied'))
      setIsCameraActive(false)
    }
  }, [facingMode, t])

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [isCameraActive])

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Toggle front/rear camera
  const toggleFacingMode = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    startCamera(nextMode)
  }, [facingMode, startCamera])

  // Snap photo from video frame
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error(t('disease.captureFailed'))
        return
      }
      const file = new File([blob], `plant_leaf_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(blob))
      setResult(null)
      setFollowupResult(null)
      setTreatmentWindows(null)
      setActiveTab('diagnosis')
      stopCamera()
      toast.success(t('disease.leafCaptured'))
    }, 'image/jpeg', 0.95)
  }, [stopCamera, t])

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
      const data = await apiFetch(`/api/v1/disease/history/${activeFarm.id}`)
      setHistory(data || [])
    } catch (err) {
      console.error(err)
    }
  }, [activeFarm, apiFetch])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('disease.fileSizeLimit'))
        return
      }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
      setFollowupResult(null)
      setTreatmentWindows(null)
      setActiveTab('diagnosis')
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => { setIsDragOver(false) }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (!file.type.startsWith('image/')) { toast.error(t('disease.onlyImages')); return }
      if (file.size > 10 * 1024 * 1024) { toast.error(t('disease.fileSizeLimit')); return }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
      setFollowupResult(null)
      setTreatmentWindows(null)
      setActiveTab('diagnosis')
    }
  }

  const handleScan = async () => {
    if (!selectedFile || !activeFarm) return
    setScanning(true)
    const formData = new FormData()
    formData.append('farm_id', activeFarm.id)
    formData.append('file', selectedFile)
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/disease/scan`, {
        method: 'POST', body: formData, credentials: 'include'
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Scanning failed")
      }
      const data = await res.json()
      setResult(data)
      setActiveTab('diagnosis')
      toast.success(t('disease.scanComplete'))
      loadHistory()
    } catch (err) {
      toast.error(err.message || t('errors.networkError'))
    } finally {
      setScanning(false)
    }
  }

  // Load treatment windows
  const loadTreatmentWindows = async () => {
    if (!activeFarm) return
    setLoadingWindows(true)
    try {
      // Use farm's stored GPS, or fallback to India center
      const lat = activeFarm.latitude || 20.0
      const lon = activeFarm.longitude || 78.0
      const data = await apiFetch(`/api/v1/crop-health/treatment-windows/${activeFarm.id}?lat=${lat}&lon=${lon}`)
      setTreatmentWindows(data)
      setActiveTab('schedule')
    } catch (err) {
      toast.error(t('disease.windowsFailed'))
    } finally {
      setLoadingWindows(false)
    }
  }

  // Load follow-up comparison
  const loadFollowup = async (scanId) => {
    if (!activeFarm) return
    try {
      const data = await apiFetch(`/api/v1/crop-health/followup?farm_id=${activeFarm.id}&original_scan_id=${scanId}`, { method: 'POST' })
      setFollowupResult(data)
      setActiveTab('followup')
    } catch (err) {
      toast.error(t('disease.followupFailed'))
    }
  }

  const tabStyle = (tab) => ({
    padding: '0.6rem 1.2rem',
    borderRadius: '10px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    background: activeTab === tab ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
    color: activeTab === tab ? '#10b981' : '#94a3b8',
    borderBottom: activeTab === tab ? '2px solid #10b981' : '2px solid transparent',
  })

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>🌿 {t('disease.title')}</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>{t('disease.subtitle')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'flex-start' }}>
          {/* ── Left: Scan Zone ── */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            {/* Hidden Canvas for Frame Capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Hidden Inputs for File and Native Mobile Camera */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <input ref={mobileCameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

            {/* ── LIVE CAMERA VIEWFINDER ── */}
            {isCameraActive ? (
              <div style={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#000',
                border: '2px solid #10b981',
                boxShadow: '0 0 25px rgba(16,185,129,0.3)',
                marginBottom: '1.25rem'
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '280px',
                    objectFit: 'cover',
                    display: 'block',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                  }}
                />

                {/* Reticle / Aiming Guide Overlay */}
                <div style={{
                  position: 'absolute', top: '15px', left: '15px', right: '15px', bottom: '65px',
                  border: '2px dashed rgba(16,185,129,0.6)', borderRadius: '12px',
                  pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.6)', padding: '0.35rem 0.75rem',
                    borderRadius: '20px', color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 700
                  }}>
                    🎯 {t('disease.selectImagePrompt')}
                  </div>
                </div>

                {/* Live Camera Bottom Bar */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '0.75rem', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '0.5rem'
                }}>
                  <button
                    onClick={toggleFacingMode}
                    title="Flip Camera (Front/Rear)"
                    style={{
                      background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                      color: '#fff', borderRadius: '50%', width: '42px', height: '42px',
                      cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    🔄
                  </button>

                  <button
                    onClick={capturePhoto}
                    style={{
                      background: '#10b981', border: '3px solid #fff',
                      color: '#fff', borderRadius: '30px', padding: '0.55rem 1.4rem',
                      fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(16,185,129,0.6)', display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}
                  >
                    📸 {t('disease.takePhoto')}
                  </button>

                  <button
                    onClick={stopCamera}
                    title="Close Camera"
                    style={{
                      background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                      color: '#f87171', borderRadius: '50%', width: '42px', height: '42px',
                      cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

            /* ── DRAG & DROP / PREVIEW ZONE ── */
            ) : (
              <div>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => { if (!previewUrl) fileInputRef.current?.click(); }}
                  style={{
                    border: isDragOver ? '2px dashed #10b981' : '2px dashed rgba(255,255,255,0.12)',
                    borderRadius: '16px', padding: previewUrl ? '1rem' : '2rem', textAlign: 'center',
                    background: isDragOver ? 'rgba(16,185,129,0.06)' : 'rgba(0,0,0,0.2)',
                    transition: 'all 0.2s', position: 'relative', cursor: previewUrl ? 'default' : 'pointer', marginBottom: '1rem'
                  }}
                >
                  {previewUrl ? (
                    <div>
                      <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '10px', objectFit: 'contain' }} />
                      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(null); }}
                          style={{
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5', borderRadius: '8px', padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          🗑️ {t('common.cancel')}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); startCamera(); }}
                          style={{
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                            color: '#6ee7b7', borderRadius: '8px', padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          📸 {t('disease.retake')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '2.8rem', display: 'block', marginBottom: '0.35rem' }}>🌿</span>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#e2e8f0' }}>{t('disease.selectImagePrompt')}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>{t('disease.supportsFormat')}</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons: Live Camera, Mobile Snap, File Browser */}
                {!previewUrl && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <button
                      onClick={() => startCamera()}
                      style={{
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                        color: '#6ee7b7', borderRadius: '12px', padding: '0.75rem 0.5rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>📸</span> {t('disease.cameraTab')}
                    </button>

                    <button
                      onClick={() => mobileCameraInputRef.current?.click()}
                      style={{
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                        color: '#93c5fd', borderRadius: '12px', padding: '0.75rem 0.5rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>📱</span> {t('disease.uploadTab')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="glow-btn"
              onClick={handleScan}
              disabled={!selectedFile || scanning || isCameraActive}
              style={{
                width: '100%', padding: '1rem', borderRadius: '12px', color: '#fff',
                fontSize: '1rem', fontWeight: 700,
                opacity: (!selectedFile || scanning || isCameraActive) ? 0.5 : 1
              }}
            >
              {scanning ? t('disease.analyzing') : `🔬 ${t('disease.analyzeBtn')}`}
            </button>

            {/* ── Crop Health Alert Badge ── */}
            {result?.crop_alert && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  background: alertColors[result.crop_alert.status]?.bg || alertColors.GREEN.bg,
                  border: `1px solid ${alertColors[result.crop_alert.status]?.border || alertColors.GREEN.border}`,
                  boxShadow: `0 0 20px ${alertColors[result.crop_alert.status]?.glow || alertColors.GREEN.glow}15`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.8rem' }}>{result.crop_alert.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: alertColors[result.crop_alert.status]?.text }}>
                      {result.crop_alert.status_label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {t('disease.cropHealthStatus')}
                    </div>
                  </div>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {result.crop_alert.reason}
                </p>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: alertColors[result.crop_alert.status]?.text, fontWeight: 600 }}>
                  → {result.crop_alert.recommended_action}
                </p>
              </motion.div>
            )}
          </div>

          {/* ── Right: Tabbed Results Panel ── */}
          <div className="glass-card" style={{ padding: '2rem', minHeight: '450px' }}>
            {/* Tab Bar */}
            {result && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button style={tabStyle('diagnosis')} onClick={() => setActiveTab('diagnosis')}>{t('disease.tabDiagnosis')}</button>
                {result.treatment_plan && (
                  <button style={tabStyle('treatment')} onClick={() => setActiveTab('treatment')}>{t('disease.tabTreatment')}</button>
                )}
                <button style={tabStyle('schedule')} onClick={() => { loadTreatmentWindows(); }}>
                  {loadingWindows ? '⏳' : '📅'} {t('disease.tabSchedule')}
                </button>
                {history.length >= 2 && (
                  <button style={tabStyle('followup')} onClick={() => { if(history[1]) loadFollowup(history[1].id) }}>{t('disease.tabFollowup')}</button>
                )}
              </div>
            )}

            <AnimatePresence mode="wait">
              {scanning ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Skeleton width="60%" height="24px" />
                  <Skeleton width="30%" height="16px" />
                  <Skeleton width="100%" height="80px" />
                  <Skeleton width="100%" height="80px" />
                </motion.div>

              /* ─── TAB: Diagnosis ─── */
              ) : result && activeTab === 'diagnosis' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  key="diagnosis" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {result.is_healthy && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                      ✅ {t('disease.healthyCrop')}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{result.disease_name}</h2>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('disease.diagnosedLeaf')}</span>
                    </div>
                    <span style={{
                      padding: '0.4rem 0.85rem', borderRadius: '20px',
                      background: `${getSeverityColor(result.severity)}20`,
                      color: getSeverityColor(result.severity),
                      fontSize: '0.75rem', fontWeight: 700,
                      border: `1px solid ${getSeverityColor(result.severity)}30`,
                      textTransform: 'uppercase'
                    }}>
                      {result.severity} {t('disease.severityLabel')}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{t('disease.confidence')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '6px' }}>
                      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.confidence}%`, height: '100%', background: '#10b981', transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{result.confidence}%</span>
                    </div>
                  </div>

                  {result.is_uncertain ? (
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '12px', padding: '1.25rem', color: '#fde047' }}>
                      <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#facc15', fontSize: '1rem' }}>
                        {t('disease.uncertainTitle')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#fef08a', lineHeight: 1.5 }}>
                        {result.message || t('disease.selectImagePrompt')}
                      </p>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
                        {t('disease.uncertainNote')}
                      </p>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: '14px', padding: '1.3rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: '#10b981', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>🩺</span> {t('disease.prescribedTreatment')}
                        </h4>
                        {result.treatment_plan && (
                          <button
                            onClick={() => setActiveTab('treatment')}
                            style={{
                              background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981',
                              color: '#34d399', borderRadius: '8px', padding: '0.35rem 0.75rem',
                              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            {t('disease.viewFullPlan')}
                          </button>
                        )}
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.7 }}>
                        {result.treatment_steps.map((step, idx) => (
                          <li key={idx} style={{ marginBottom: '6px' }}>
                            <strong style={{ color: '#6ee7b7' }}>{t('disease.step', { num: idx + 1 })}:</strong> {step}
                          </li>
                        ))}
                      </ol>
                      {result.treatment_plan?.guidance && (
                        <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255,255,255,0.08)', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span style={{ color: '#eab308', fontWeight: 700 }}>{t('disease.clinicalNote')}</span>
                          {result.treatment_plan.guidance}
                        </div>
                      )}
                    </div>
                  )}

                  {result.top5 && result.top5.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{t('disease.confidenceDistribution')}</h4>
                      <div style={{ height: '120px', width: '100%', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart data={result.top5} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="label" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fill: '#94a3b8' }} />
                            <Bar dataKey="confidence" radius={4}>
                              {result.top5.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : 'rgba(255,255,255,0.08)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </motion.div>

              /* ─── TAB: Treatment Plan (Solution-in-the-Loop) ─── */
              ) : result && activeTab === 'treatment' && result.treatment_plan ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  key="treatment" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>💊</span>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{t('disease.treatmentPlanTitle')}</h2>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('disease.solutionInLoop')} • {result.disease_name}</span>
                    </div>
                  </div>

                  {/* Severity-specific guidance */}
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '14px', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                      {t('disease.severityGuidance', { severity: result.severity })}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                      {result.treatment_plan.guidance}
                    </p>
                  </div>

                  {/* Cultural Practices */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>{t('disease.culturalPractices')}</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.7 }}>
                      {result.treatment_plan.cultural_practices.map((p, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>
                          <span style={{ color: '#10b981', marginRight: '4px' }}>●</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Follow-up reminder */}
                  <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '14px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>📸</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#a5b4fc' }}>
                        {t('disease.followupScanIn', { days: result.treatment_plan.follow_up_days })}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                        {result.treatment_plan.monitoring_note}
                      </div>
                    </div>
                  </div>

                  {/* Source disclaimer */}
                  <div style={{ fontSize: '0.7rem', color: '#64748b', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <strong>{t('disease.sourceLabel')}</strong> {result.treatment_plan.source}<br />
                    <em>{t('disease.disclaimer')}</em>
                  </div>
                </motion.div>

              /* ─── TAB: Spray Schedule ─── */
              ) : activeTab === 'schedule' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  key="schedule" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>📅</span>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{t('disease.smartSchedulerTitle')}</h2>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('disease.smartSchedulerSubtitle')}</span>
                    </div>
                  </div>

                  {loadingWindows ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <Skeleton width="100%" height="30px" />
                      <Skeleton width="100%" height="120px" />
                    </div>
                  ) : treatmentWindows ? (
                    <>
                      {/* Recommendation */}
                      <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '14px', padding: '1rem' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                          {treatmentWindows.recommendation}
                        </p>
                      </div>

                      {/* Windows list */}
                      {treatmentWindows.windows && treatmentWindows.windows.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {treatmentWindows.windows.map((w, i) => (
                            <div key={i} style={{
                              background: i === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)'}`,
                              borderRadius: '12px', padding: '1rem',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0' }}>
                                    {i === 0 ? t('disease.bestWindow') : t('disease.windowN', { n: i + 1 })}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                    {new Date(w.start).toLocaleDateString()} {new Date(w.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {' → '}
                                    {new Date(w.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                <div style={{
                                  background: `hsl(${Math.floor(w.avg_score * 1.2)}, 70%, 25%)`,
                                  padding: '0.3rem 0.7rem', borderRadius: '20px',
                                  fontSize: '0.75rem', fontWeight: 700, color: '#fff'
                                }}>
                                  {t('disease.scoreLabel', { score: w.avg_score })}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                                <span>🌡️ {w.conditions.temp_range}</span>
                                <span>💨 {w.conditions.wind_range}</span>
                                <span>🌧️ {t('disease.rainProbLabel', { prob: w.conditions.max_rain_prob })}</span>
                                <span>⏱️ {w.duration_hours}h</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suitability Timeline Chart */}
                      {treatmentWindows.timeline && treatmentWindows.timeline.length > 0 && (
                        <div>
                          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{t('disease.suitabilityTimeline')}</h4>
                          <div style={{ height: '140px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={treatmentWindows.timeline.map(tData => ({
                                ...tData, time: new Date(tData.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval={5} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip
                                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.75rem' }}
                                  labelStyle={{ color: '#94a3b8' }}
                                />
                                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={false} name={t('disease.suitability')} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: '0.7rem', color: '#475569', fontStyle: 'italic' }}>
                        {t('disease.engine')} {treatmentWindows.engine || 'Weather-Based Treatment Scheduler'}
                      </div>
                    </>
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{t('disease.clickToLoadSchedule')}</p>
                  )}
                </motion.div>

              /* ─── TAB: Follow-up ─── */
              ) : activeTab === 'followup' ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  key="followup" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>📈</span>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{t('disease.followupTrendTitle')}</h2>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('disease.visualComparison')}</span>
                    </div>
                  </div>

                  {followupResult ? (
                    followupResult.trend === 'NO_FOLLOWUP' ? (
                      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', padding: '1.5rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📸</span>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>{followupResult.message}</p>
                      </div>
                    ) : (
                      <>
                        {/* Trend badge */}
                        <div style={{
                          background: followupResult.trend === 'IMPROVING' ? 'rgba(34,197,94,0.1)' :
                                     followupResult.trend === 'WORSENING' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                          border: `1px solid ${followupResult.trend === 'IMPROVING' ? 'rgba(34,197,94,0.3)' :
                                   followupResult.trend === 'WORSENING' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                          borderRadius: '14px', padding: '1.25rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>
                              {followupResult.trend === 'IMPROVING' ? '📉' : followupResult.trend === 'WORSENING' ? '📈' : '➡️'}
                            </span>
                            <span style={{
                              fontWeight: 800, fontSize: '1.1rem',
                              color: followupResult.trend === 'IMPROVING' ? '#4ade80' :
                                     followupResult.trend === 'WORSENING' ? '#f87171' : '#fde047'
                            }}>
                              {followupResult.trend}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                            {followupResult.message}
                          </p>
                        </div>

                        {/* Comparison cards */}
                        {followupResult.original && followupResult.followup && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem' }}>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>{t('disease.originalScan')}</div>
                              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }}>{followupResult.original.disease}</div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                                {t('disease.confidence')} {followupResult.original.confidence}%
                              </div>
                              <div style={{ fontSize: '0.8rem', color: getSeverityColor(followupResult.original.severity), marginTop: '2px' }}>
                                {followupResult.original.severity}
                              </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem' }}>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>{t('disease.followupScan')}</div>
                              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }}>{followupResult.followup.disease}</div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                                {t('disease.confidence')} {followupResult.followup.confidence}%
                              </div>
                              <div style={{ fontSize: '0.8rem', color: getSeverityColor(followupResult.followup.severity), marginTop: '2px' }}>
                                {followupResult.followup.severity}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                          <span>{t('disease.confidenceDelta')} <strong style={{ color: '#e2e8f0' }}>{followupResult.confidence_change > 0 ? '+' : ''}{followupResult.confidence_change}%</strong></span>
                          <span>{t('disease.severityLabel')}: <strong style={{ color: '#e2e8f0' }}>{followupResult.severity_change}</strong></span>
                        </div>

                        {/* Disclaimer */}
                        <div style={{ fontSize: '0.7rem', color: '#475569', fontStyle: 'italic', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                          ⚠️ {followupResult.disclaimer}
                        </div>
                      </>
                    )
                  ) : (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{t('disease.selectScanHistory')}</p>
                  )}
                </motion.div>

              /* ─── Default: No result ─── */
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem 0' }}>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>🔬</span>
                  <h3 style={{ margin: 0, color: '#e2e8f0' }}>{t('disease.noDiagnosticsTitle')}</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '300px', margin: '4px auto 0' }}>{t('disease.noDiagnosticsDesc')}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── History Table ── */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>📋 {t('disease.historyTitle')}</h3>
          {history.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('disease.noHistoryRecorded')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableImage')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableCrop')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableDiagnosis')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableSeverity')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableConfidence')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableDate')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('disease.historyTableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {row.image_url ? (
                          <img src={`${BACKEND_URL}${row.image_url}`} alt="Scan" style={{ width: 45, height: 45, borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.05)' }} />
                        ) : (<span>N/A</span>)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{row.crop_name || 'Generic'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 700 }}>{row.disease_name}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ color: getSeverityColor(row.severity), fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          {row.severity}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{row.confidence}%</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(row.scanned_at).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          onClick={() => loadFollowup(row.id)}
                          style={{
                            padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)',
                            background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: '0.7rem',
                            fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          📈 {t('disease.tabFollowup')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        width, height,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '6px',
        animation: 'pulse 1.5s infinite ease-in-out'
      }}
    />
  )
}
