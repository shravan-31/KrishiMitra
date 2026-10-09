import React, { useState, useEffect, useCallback } from 'react'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

export default function Report() {
  const { activeFarm } = useFarmStore()
  const { t } = useTranslation()
  const [report, setReport] = useState(null)
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

  const loadReport = useCallback(async () => {
    if (!activeFarm) return
    setLoading(true)
    try {
      const data = await apiFetch(`/api/v1/farms/${activeFarm.id}/report`)
      setReport(data)
    } catch (err) {
      console.error(err)
      toast.error(err.message || t('report.loadError'))
    } finally {
      setLoading(false)
    }
  }, [activeFarm, apiFetch, t])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handlePrint = () => {
    window.print()
  }

  // Helper for scan image URLs
  const getFullImageUrl = (path) => {
    if (!path) return 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=400&q=80'
    if (path.startsWith('http')) return path
    return `${BACKEND_URL}${path}`
  }

  return (
    <FarmLayout>
      <div className="report-container" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Style block for Print CSS Overrides */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* Hide non-printable items */
            header, aside, .glow-btn, .print-btn-float, .toaster, .particle, select, button {
              display: none !important;
            }
            /* Reset body backgrounds and colors for paper */
            body, html, main, .report-container, .glass-card {
              background: #fff !important;
              color: #000 !important;
              box-shadow: none !important;
              border: none !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            main {
              max-height: none !important;
              overflow: visible !important;
            }
            .glass-card {
              border-bottom: 1px solid #ddd !important;
              border-radius: 0 !important;
              margin-bottom: 2rem !important;
              padding: 1rem 0 !important;
              page-break-inside: avoid;
            }
            h1, h2, h3, h4 {
              color: #0a2f0a !important;
            }
            .section-title {
              border-bottom: 2px solid #0a2f0a !important;
              padding-bottom: 4px !important;
              margin-top: 2rem !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            th, td {
              border-bottom: 1px solid #ccc !important;
              color: #000 !important;
              padding: 6px !important;
            }
            tr {
              page-break-inside: avoid;
            }
            .thumbnail-img {
              border: 1px solid #ccc !important;
              border-radius: 4px !important;
              width: 110px !important;
              height: 110px !important;
            }
            .health-badge {
              border: 1px solid #000 !important;
              background: none !important;
              color: #000 !important;
            }
          }
        ` }} />

        {/* Top Header Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{t('report.title')}</h1>
            <p style={{ color: '#64748b', marginTop: '4px' }}>
              {t('report.subtitle')}
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="glow-btn print-btn-float"
            disabled={loading || !report}
            style={{
              padding: '0.85rem 1.75rem',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            {t('report.printBtn')}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(16,185,129,0.1)', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ color: '#10b981' }}>{t('common.loading')}</h3>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 100% { transform: rotate(360deg); } }` }} />
          </div>
        ) : report ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Section 1: Farm Boundary Profile */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🚜 {t('report.farmDetailsTitle')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('nav.farmNameLabel') || 'Farm Name'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>{report.farm_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('nav.locationLabel') || 'Location'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>{report.location || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('nav.stateLabel') || 'State'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>{report.district ? `${report.district}, ${report.state}` : report.state || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('nav.areaLabel') || 'Area'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>{report.area_acres} {t('common.acres')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('nav.soilTypeLabel') || 'Soil Type'}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>{report.soil_type} {t('common.soil')}</div>
                </div>
              </div>
            </div>

            {/* Section 2: Soil Health Indicators */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🌱 {t('report.soilSummaryTitle')}
              </h2>
              {report.soil ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '1rem 2rem', borderRadius: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{t('soil.soilScore')}</div>
                      <div className="health-badge" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#22c55e' }}>{report.soil.soil_health_score}%</div>
                    </div>
                    
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('soil.ph')}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{report.soil.ph_level}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('soil.nitrogen')}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{report.soil.nitrogen} kg/ha</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('soil.phosphorus')}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{report.soil.phosphorus} kg/ha</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('soil.potassium')}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{report.soil.potassium} kg/ha</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('soil.moisture')}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{report.soil.moisture}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px' }}>
                      <h4 style={{ margin: '0 0 0.5rem', color: '#22c55e', fontSize: '0.85rem', textTransform: 'uppercase' }}>{t('soil.recommendations')}</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {report.soil.recommended_crops?.map((crop) => (
                          <span key={crop} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#4ade80', padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                            {crop}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px' }}>
                      <h4 style={{ margin: '0 0 0.5rem', color: '#22c55e', fontSize: '0.85rem', textTransform: 'uppercase' }}>{t('soil.fertilizerAdvice')}</h4>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>{report.soil.fertilizer_advice}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('soil.noAnalysis')}</p>
              )}
            </div>

            {/* Section 3: Crop Diagnostics (Photos!) */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔬 {t('report.diagnosticHistoryTitle')}
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Disease scans */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>{t('disease.title')}</h3>
                  {!report.diseases || report.diseases.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('disease.noHistory') || 'No disease scans recorded.'}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {report.diseases.map((d) => (
                        <div key={d.id || Math.random()} style={{ display: 'flex', gap: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', flexWrap: 'wrap' }}>
                          <img
                            src={getFullImageUrl(d.image_url)}
                            alt={d.disease_name}
                            className="thumbnail-img"
                            style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}
                          />
                          <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f87171' }}>{d.disease_name}</h4>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(d.scanned_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                              <span>{t('report.thSeverity')}: <strong style={{ color: d.severity === 'CRITICAL' || d.severity === 'HIGH' ? '#ef4444' : '#f59e0b' }}>{d.severity}</strong></span>
                              <span>{t('report.thConfidence')}: <strong>{d.confidence}%</strong></span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
                              <strong>{t('disease.treatmentProtocols') || 'Remediation Steps'}:</strong> {Array.isArray(d.treatment) ? d.treatment.join(', ') : d.treatment}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pest scans */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>{t('pest.title')}</h3>
                  {!report.pests || report.pests.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('pest.noHistory') || 'No insect pest scans recorded.'}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {report.pests.map((p) => (
                        <div key={p.id || Math.random()} style={{ display: 'flex', gap: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', flexWrap: 'wrap' }}>
                          <img
                            src={getFullImageUrl(p.image_url)}
                            alt={p.pest_name}
                            className="thumbnail-img"
                            style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}
                          />
                          <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>{p.pest_name}</h4>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(p.scanned_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                              <span>{t('pest.infestationSeverity')}: <strong style={{ color: '#fbbf24' }}>{p.infestation}</strong></span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
                              <strong>{t('pest.bioCtrl')}:</strong> {p.organic_ctrl}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
                              <strong>{t('pest.chemCtrl')}:</strong> {p.chemical_ctrl}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Harvest Predictions */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 {t('yield.title')}
              </h2>
              {report.season_summary ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('yield.forecastTitle') || 'Estimated Seasonal Tonnage'}</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '2.5rem', color: '#a78bfa', fontWeight: 800 }}>
                      {report.season_summary.yield_kg.toLocaleString()} kg
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>
                      {report.season_summary.season} {report.season_summary.year}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('report.projectedValue')}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#eab308', marginTop: '4px' }}>
                      ₹{(report.season_summary.yield_kg * 22).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('yield.noPrediction') || 'No crop predictions compiled yet.'}</p>
              )}
            </div>

            {/* Section 5: Financial Ledger */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📒 {t('expenses.title')}
              </h2>
              
              {report.season_summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('expenses.totalExpense')}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>₹{report.season_summary.total_expense.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('expenses.totalIncome')}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>₹{report.season_summary.total_revenue.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{t('expenses.netProfit')}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: report.season_summary.profit_loss >= 0 ? '#34d399' : '#f87171', marginTop: '2px' }}>
                      ₹{report.season_summary.profit_loss.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>{t('expenses.historyTitle')}</h3>
              {!report.expenses || report.expenses.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('expenses.noExpenses')}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('expenses.colDate')}</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('expenses.colCategory')}</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('expenses.colDescription')}</th>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{t('expenses.colAmount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.expenses.map((e) => (
                        <tr key={e.id || Math.random()} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.6rem 0.5rem', color: '#64748b' }}>{new Date(e.date).toLocaleDateString()}</td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>{e.category}</td>
                          <td style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>{e.description || '—'}</td>
                          <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#f87171' }}>₹{e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 6: Crop Calendar */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 className="section-title" style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📅 {t('calendar.title')}
              </h2>
              {!report.tasks || report.tasks.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('calendar.noTasks') || 'No pending calendar tasks.'}</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b' }}>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('report.thDate')}</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('calendar.colTask') || 'Task'}</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('calendar.colType') || 'Type'}</th>
                        <th style={{ padding: '0.6rem 0.5rem' }}>{t('calendar.colUrgency') || 'Urgency'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.tasks.map((tItem) => (
                        <tr key={tItem.id || Math.random()} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.6rem 0.5rem', color: '#64748b' }}>{new Date(tItem.scheduled_at).toLocaleDateString()}</td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>{tItem.task_name}</td>
                          <td style={{ padding: '0.6rem 0.5rem' }}>{tItem.task_type}</td>
                          <td style={{ padding: '0.6rem 0.5rem', color: tItem.urgency === 'HIGH' ? '#ef4444' : '#e2e8f0', fontWeight: tItem.urgency === 'HIGH' ? 800 : 500 }}>
                            {tItem.urgency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📋</span>
            <p>{t('report.noActiveFarm') || 'Select an active farm to generate your comprehensive report.'}</p>
          </div>
        )}
      </div>
    </FarmLayout>
  )
}
