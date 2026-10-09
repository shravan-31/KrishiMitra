import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useFarmStore } from '../store/farmStore'
import FarmLayout from '../components/FarmLayout'
import toast from 'react-hot-toast'
import { useTranslation } from '../i18n'

import { BACKEND_URL } from '../config'

const CATEGORIES = ['Seed', 'Fertilizer', 'Pesticide', 'Machinery', 'Labor', 'Irrigation', 'Other']

export default function Expenses() {
  const { activeFarm } = useFarmStore()
  const { t } = useTranslation()
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  
  // Form State
  const [category, setCategory] = useState('Seed')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
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

  const loadFinancials = useCallback(async () => {
    if (!activeFarm) return
    setLoading(true)
    try {
      // 1. Fetch expenses list
      const list = await apiFetch(`/api/v1/expenses/${activeFarm.id}`)
      setExpenses(list)

      // 2. Fetch summary
      const summ = await apiFetch(`/api/v1/expenses/${activeFarm.id}/summary`)
      setSummary(summ)
    } catch (err) {
      console.error(err)
      toast.error(t('expenses.loadError'))
    } finally {
      setLoading(false)
    }
  }, [activeFarm, apiFetch, t])

  useEffect(() => {
    loadFinancials()
  }, [loadFinancials])

  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!activeFarm) return
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t('expenses.validAmountError'))
      return
    }

    setSubmitting(true)
    try {
      await apiFetch('/api/v1/expenses', {
        method: 'POST',
        body: JSON.stringify({
          farm_id: activeFarm.id,
          category,
          amount: parseFloat(amount),
          description,
          date
        })
      })
      toast.success(t('expenses.logSuccess'))
      setAmount('')
      setDescription('')
      // Reload lists
      await loadFinancials()
    } catch (err) {
      toast.error(err.message || t('messages.somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  const getCategoryColor = (cat) => {
    switch (cat.toLowerCase()) {
      case 'seed': return '#10b981'
      case 'fertilizer': return '#22c55e'
      case 'pesticide': return '#f59e0b'
      case 'machinery': return '#8b5cf6'
      case 'labor': return '#ec4899'
      case 'irrigation': return '#0ea5e9'
      default: return '#94a3b8'
    }
  }

  // Check if KCC alert eligibility condition is met (total expense > 50000)
  const isKccEligible = summary && summary.total_expense > 50000

  // Chart data
  const chartData = summary?.monthly_breakdown?.map(item => ({
    name: item.month,
    expenses: item.amount
  })) || []

  return (
    <FarmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header */}
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{t('expenses.title')}</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
            {t('expenses.subtitle')}
          </p>
        </div>

        {/* KCC Notification Card */}
        <AnimatePresence>
          {isKccEligible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '14px',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                color: '#34d399'
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>🏛️</span>
              <div>
                <strong style={{ fontSize: '0.95rem' }}>{t('expenses.kccTitle')}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                  {t('expenses.kccDesc', { amount: summary.total_expense.toLocaleString() })}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Dials Row */}
        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('expenses.totalExpense')}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#f87171' }}>
                ₹{summary.total_expense.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>{t('expenses.totalExpenseSub')}</div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('expenses.totalIncome')}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#4ade80' }}>
                ₹{summary.total_revenue.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>{t('expenses.totalIncomeSub')}</div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{t('expenses.netProfit')}</div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                marginTop: '0.5rem',
                color: summary.profit_loss >= 0 ? '#10b981' : '#f87171'
              }}>
                ₹{summary.profit_loss.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                {summary.profit_loss >= 0 ? t('expenses.surplusBalance') : t('expenses.deficitBalance')}
              </div>
            </div>

          </div>
        )}

        {/* Form and ledger list */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Form */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 800 }}>{t('expenses.logExpense')}</h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>{t('expenses.category')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} style={{ background: '#0a1a0a' }}>
                      {t(`expenses.cat${c}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>{t('expenses.amount')}</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>{t('expenses.notes')}</label>
                <input
                  type="text"
                  placeholder="e.g. Urea fertilizer 2 bags"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>{t('expenses.date')}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button type="submit" disabled={submitting || !activeFarm} className="glow-btn" style={{ padding: '0.75rem 1rem', color: '#fff', fontWeight: 700, borderRadius: '10px', marginTop: '0.5rem' }}>
                {submitting ? t('expenses.savingBtn') : t('expenses.addExpenseBtn')}
              </button>

            </form>
          </div>

          {/* List and Charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Chart */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>{t('expenses.breakdownTitle')}</h3>
              <div style={{ width: '100%', height: '220px', position: 'relative' }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="99%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(10,26,10,0.95)',
                          border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '10px',
                          color: '#fff',
                          fontSize: '0.85rem'
                        }}
                      />
                      <Bar dataKey="expenses" fill="#10b981" radius={[4, 4, 0, 0]} name={t('expenses.amount')} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    {t('expenses.noChartData')}
                  </div>
                )}
              </div>
            </div>

            {/* List */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>{t('expenses.historyTitle')}</h3>
              {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  {t('expenses.noExpenses')}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{t('expenses.colDate')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{t('expenses.colCategory')}</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>{t('expenses.colDescription')}</th>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{t('expenses.colAmount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr key={exp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '0.85rem 0.5rem' }}>{new Date(exp.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td style={{ padding: '0.85rem 0.5rem' }}>
                            <span style={{
                              background: `rgba(255,255,255,0.01)`,
                              border: `1px solid ${getCategoryColor(exp.category)}50`,
                              color: getCategoryColor(exp.category),
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              {t(`expenses.cat${exp.category}`) || exp.category}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', color: '#94a3b8' }}>{exp.description || '—'}</td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#f87171' }}>
                            ₹{exp.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </FarmLayout>
  )
}
