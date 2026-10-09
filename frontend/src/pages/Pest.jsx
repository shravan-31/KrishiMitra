import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

export default function Pest() {
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
        toast.error(t('pest.cameraUnsupported'))
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
      console.error("Camera error:", err)
      toast.error(t('pest.cameraDenied'))
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
        toast.error(t('pest.captureFailed'))
        return
      }
      const file = new File([blob], `pest_capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(blob))
      setResult(null)
      stopCamera()
      toast.success(t('pest.pestCaptured'))
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
      const data = await apiFetch(`/api/v1/pest/history/${activeFarm.id}`)
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
        toast.error(t('pest.fileSizeLimit'))
        return
      }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (!file.type.startsWith('image/')) {
        toast.error(t('pest.onlyImages'))
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('pest.fileSizeLimit'))
        return
      }
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
    }
  }

  const handleScan = async () => {
    if (!selectedFile || !activeFarm) return
    setScanning(true)
    const formData = new FormData()
    formData.append('farm_id', activeFarm.id)
    formData.append('file', selectedFile)

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/pest/detect`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Scanning failed")
      }

      const data = await res.json()
      setResult(data)
      toast.success(t('pest.scanComplete'))
      loadHistory()
    } catch (err) {
      toast.error(err.message || t('errors.networkError'))
    } finally {
      setScanning(false)
    }
  }

  const getSeverityColor = (sev) => {
    switch (String(sev).toUpperCase()) {
      case 'CRITICAL': return '#ef4444'
      case 'HIGH': return '#f97316'
      case 'MEDIUM': return '#eab308'
      case 'LOW': return '#22c55e'
      default: return '#10b981'
    }
  }

  return (
    <FarmLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{t('pest.title')}</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>{t('pest.subtitle')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Upload Zone */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            {/* Hidden canvas for capturing frame */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Hidden input for regular file upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Hidden input for direct mobile camera capture */}
            <input
              ref={mobileCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

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
                    {t('pest.alignGuide')}
                  </div>
                </div>

                {/* Live Camera Bottom Bar */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '0.75rem', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '0.5rem'
                }}>
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    title={t('pest.flipCamera')}
                    style={{
                      background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                      color: '#fff', borderRadius: '50%', width: '42px', height: '42px',
                      cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    🔄
                  </button>

                  <button
                    type="button"
                    onClick={capturePhoto}
                    style={{
                      background: '#10b981', border: '3px solid #fff',
                      color: '#fff', borderRadius: '30px', padding: '0.55rem 1.4rem',
                      fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(16,185,129,0.6)', display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}
                  >
                    {t('pest.snapPhoto')}
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    title={t('pest.closeCamera')}
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
                    borderRadius: '16px', padding: previewUrl ? '1rem' : '2.5rem', textAlign: 'center',
                    background: isDragOver ? 'rgba(16,185,129,0.06)' : 'rgba(0,0,0,0.2)',
                    transition: 'all 0.2s', position: 'relative', cursor: previewUrl ? 'default' : 'pointer', marginBottom: '1rem'
                  }}
                >
                  {previewUrl ? (
                    <div>
                      <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '10px', objectFit: 'contain' }} />
                      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(null); }}
                          style={{
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5', borderRadius: '8px', padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {t('pest.removePhoto')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startCamera(); }}
                          style={{
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                            color: '#6ee7b7', borderRadius: '8px', padding: '0.35rem 0.75rem',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {t('pest.retakeWithCamera')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🐛</span>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#e2e8f0' }}>{t('pest.uploadOrSnap')}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{t('pest.formatHint')}</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons: Live Camera, Mobile Snap */}
                {!previewUrl && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      style={{
                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
                        color: '#6ee7b7', borderRadius: '12px', padding: '0.75rem 0.5rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>📸</span> {t('pest.cameraTab')}
                    </button>

                    <button
                      type="button"
                      onClick={() => mobileCameraInputRef.current?.click()}
                      style={{
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                        color: '#93c5fd', borderRadius: '12px', padding: '0.75rem 0.5rem',
                        fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>📱</span> {t('pest.phoneCamera')}
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
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                opacity: (!selectedFile || scanning || isCameraActive) ? 0.5 : 1
              }}
            >
              {scanning ? t('pest.analyzing') : t('pest.analyzeBtn')}
            </button>
          </div>

          {/* Results Zone */}
          <div className="glass-card" style={{ padding: '2rem', minHeight: '370px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <AnimatePresence mode="wait">
              {scanning ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                >
                  <Skeleton width="60%" height="24px" />
                  <Skeleton width="30%" height="16px" />
                  <Skeleton width="100%" height="80px" />
                  <Skeleton width="100%" height="80px" />
                </motion.div>
              ) : result ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      {result.is_uncertain ? (
                        <div>
                          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#facc15' }}>
                            {t('pest.unidentifiedInsect')}
                          </h2>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                            {t('pest.closestMatch', { pest: result.pest_name, confidence: result.confidence })}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{result.pest_name}</h2>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('pest.detectedTitle')}</span>
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '20px',
                        background: result.is_uncertain ? 'rgba(234,179,8,0.15)' : `${getSeverityColor(result.infestation_level)}20`,
                        color: result.is_uncertain ? '#facc15' : getSeverityColor(result.infestation_level),
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: result.is_uncertain ? '1px solid rgba(234,179,8,0.3)' : `1px solid ${getSeverityColor(result.infestation_level)}30`,
                        textTransform: 'uppercase'
                      }}
                    >
                      {result.is_uncertain ? t('pest.unconfirmed') : `${result.infestation_level} ${t('pest.infestationSuffix')}`}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{t('pest.confidence')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '6px' }}>
                      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.confidence}%`, height: '100%', background: result.is_uncertain ? '#ef4444' : '#10b981' }} />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: result.is_uncertain ? '#f87171' : '#34d399' }}>{result.confidence}%</span>
                    </div>
                  </div>

                  {/* Organic & Chemical Treatments */}
                  {result.is_uncertain && (
                    <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.35)', borderRadius: '12px', padding: '1.25rem', color: '#fde047' }}>
                      <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#facc15', fontSize: '1rem' }}>
                        {t('pest.confidenceTooLow', { confidence: result.confidence })}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#fef08a', lineHeight: 1.5 }}>
                        {t('pest.lowConfidenceDesc')}
                      </p>

                      <div style={{ marginTop: '0.85rem', padding: '0.85rem', background: 'rgba(0,0,0,0.35)', borderRadius: '10px', border: '1px dashed rgba(250,204,21,0.3)' }}>
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700, marginBottom: '4px' }}>
                          {t('pest.leafMismatchTitle')}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45, marginBottom: '8px' }}>
                          {t('pest.leafMismatchDesc')}
                        </div>
                        <Link
                          to="/crop-health"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            background: '#10b981', color: '#fff', padding: '0.45rem 0.95rem',
                            borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 700
                          }}
                        >
                          {t('pest.switchToDiseaseBtn')}
                        </Link>
                      </div>

                      <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
                        {t('pest.accuracyScanTip')}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.25rem', color: '#4ade80', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>{t('pest.organicProtocol')}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{result.organic_control || 'Apply neem oil (5ml/L) or organic insecticidal soap spray.'}</p>
                    </div>

                    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.25rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>{t('pest.chemicalProtocol')}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{result.chemical_control || 'Apply standard recommended pesticide if infestation is severe.'}</p>
                    </div>
                  </div>

                  {result.top5 && result.top5.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{t('pest.confidenceDistribution')}</h4>
                      <div style={{ height: '120px', width: '100%', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart data={result.top5} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="label" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '0.75rem', fill: '#94a3b8' }} />
                            <Bar dataKey="confidence" radius={4}>
                              {result.top5.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : 'rgba(255,255,255,0.08)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>🐛</span>
                  <h3 style={{ margin: 0, color: '#e2e8f0' }}>{t('pest.noDiagnosticsTitle')}</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '300px', margin: '4px auto 0' }}>{t('pest.noDiagnosticsDesc')}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History Table */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>{t('pest.historyTitle')}</h3>
          {history.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('pest.noHistoryRecorded')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('pest.tableImage')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('pest.tableDetectedPest')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('pest.tableInfestation')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('pest.tableOrganic')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('pest.tableScannedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {row.image_url ? (
                          <img src={`${BACKEND_URL}${row.image_url}`} alt="Scan" style={{ width: 45, height: 45, borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.05)' }} />
                        ) : (
                          <span>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{row.pest_name}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ color: getSeverityColor(row.infestation), fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          {row.infestation}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.organic_ctrl}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(row.scanned_at).toLocaleDateString()}</td>
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
        width,
        height,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '6px',
        animation: 'pulse 1.5s infinite ease-in-out'
      }}
    />
  )
}
