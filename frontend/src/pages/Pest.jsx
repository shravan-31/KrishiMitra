import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'

import { BACKEND_URL } from '../config'

export default function Pest() {
  const { activeFarm } = useFarmStore()
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)

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
        toast.error("File size must be under 10MB")
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
        toast.error("Only image files are accepted")
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be under 10MB")
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
      toast.success("Pest classification complete!")
      loadHistory()
    } catch (err) {
      toast.error(err.message || "Diagnostics failed")
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
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Insect Pest Scanner</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>Analyze field camera scans to detect insect infestations, density mappings, and receive organic control advice.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Upload Zone */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragOver ? '2px dashed #10b981' : '2px dashed rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '2.5rem',
                textAlign: 'center',
                background: isDragOver ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
                position: 'relative',
                cursor: 'pointer',
                marginBottom: '1.5rem'
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                onChange={handleFileChange}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '10px', objectFit: 'contain' }} />
              ) : (
                <div>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🐛</span>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#e2e8f0' }}>Drag & Drop insect image here</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Supports PNG, JPG (Max 10MB) or browse folders</div>
                </div>
              )}
            </div>

            <button
              className="glow-btn"
              onClick={handleScan}
              disabled={!selectedFile || scanning}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                opacity: (!selectedFile || scanning) ? 0.5 : 1
              }}
            >
              {scanning ? 'Running Neural Net Classifier...' : 'Run Pest Scan'}
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
                      <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{result.pest_name}</h2>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Detected Insect Class</span>
                    </div>
                    <span
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '20px',
                        background: `${getSeverityColor(result.infestation_level)}20`,
                        color: getSeverityColor(result.infestation_level),
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: `1px solid ${getSeverityColor(result.infestation_level)}30`,
                        textTransform: 'uppercase'
                      }}
                    >
                      {result.infestation_level} Infestation
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Classification Confidence:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '6px' }}>
                      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${result.confidence}%`, height: '100%', background: '#f59e0b' }} />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{result.confidence}%</span>
                    </div>
                  </div>

                  {/* Organic & Chemical Treatments */}
                  {result.is_uncertain ? (
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '12px', padding: '1.25rem', color: '#fde047' }}>
                      <h4 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#facc15', fontSize: '1rem' }}>
                        ⚠️ Classification Uncertain — Safety Threshold Triggered
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#fef08a', lineHeight: 1.5 }}>
                        {result.message || "The insect or pest could not be identified with sufficient confidence. Chemical recommendations are withheld. Please capture a closer, well-lit photo of the pest or affected leaf."}
                      </p>
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#cbd5e1' }}>
                        Please consult your local Krishi Vigyan Kendra (KVK) extension officer.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.25rem', color: '#4ade80', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Organic Control Protocol</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{result.organic_control}</p>
                      </div>

                      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.25rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Chemical Control Protocol</h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>{result.chemical_control}</p>
                      </div>
                    </div>
                  )}

                  {result.top5 && result.top5.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Confidence Distribution</h4>
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
                  <h3 style={{ margin: 0, color: '#e2e8f0' }}>No Diagnostics Performed</h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '300px', margin: '4px auto 0' }}>Upload field insect pictures to classify pest severity levels and recommended control methods.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History Table */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800 }}>Pest Scan History</h3>
          {history.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No past diagnostic scans recorded for this farm boundary.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Image</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Detected Pest</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Infestation Level</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Organic Control</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Scanned At</th>
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
