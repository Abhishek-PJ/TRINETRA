import React, { useEffect, useMemo, useState } from 'react'
import { FlowsTable } from './components/FlowsTable.jsx'
import { Alerts } from './components/Alerts.jsx'
import { Shield, RefreshCw, FileText, Activity, AlertTriangle, Bookmark, X, Clock, Trash2, Settings } from 'lucide-react'

export default function App() {
  const [data, setData] = useState({ file: null, rows: [] })
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState('')
  const [mode, setMode] = useState('file') // 'file' | 'latest'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [limit, setLimit] = useState(200)
  const [intervalMs, setIntervalMs] = useState(5000)
  const [alerts, setAlerts] = useState([])
  const [alertStats, setAlertStats] = useState({ total: 0, recent_24h: 0, by_severity: {} })
  const [hasUserSelected, setHasUserSelected] = useState(false)
  const [advancedMode, setAdvancedMode] = useState(false)

  const loadFiles = async () => {
    try {
      const res = await fetch('/api/files')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list = json.files || []
      setFiles(list)
      // Only auto-select on initial load (when user hasn't selected anything yet)
      if (!selected && !hasUserSelected && list.length > 0) {
        const latest = list[0] // Files are already sorted newest first from backend
        setSelected(latest.name || latest)
      }
    } catch (e) {
      // Ignore silently here; main error surface is via fetch below
    }
  }

  const saveFile = async (filename) => {
    try {
      const res = await fetch(`/api/save/${encodeURIComponent(filename)}`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadFiles() // Reload file list
    } catch (e) {
      setError(e?.message || 'Failed to save file')
    }
  }

  const unsaveFile = async (filename) => {
    try {
      const res = await fetch(`/api/save/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadFiles() // Reload file list
    } catch (e) {
      setError(e?.message || 'Failed to unsave file')
    }
  }

  const fetchLatest = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/latest?limit=${limit}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e?.message || 'Failed to fetch latest')
    } finally {
      setLoading(false)
    }
  }

  const fetchFile = async (name) => {
    if (!name) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/file/${encodeURIComponent(name)}?limit=${limit}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e?.message || 'Failed to fetch file')
    } finally {
      setLoading(false)
    }
  }

  // Load files list once and when a new file might appear (poll lightly)
  useEffect(() => {
    loadFiles()
    const id = setInterval(loadFiles, 10000)
    return () => clearInterval(id)
  }, [])

  // Fetch depending on mode
  useEffect(() => {
    if (mode === 'latest') {
      fetchLatest()
      const id = setInterval(fetchLatest, intervalMs)
      return () => clearInterval(id)
    } else if (mode === 'file' && selected) {
      fetchFile(selected)
    }
  }, [mode, selected, limit, intervalMs])

  // Alerts polling
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const res = await fetch('/api/alerts?limit=200')
        if (!res.ok) return
        const json = await res.json()
        setAlerts(json.alerts || [])
      } catch (e) {
        // ignore
      }
    }
    
    const loadAlertStats = async () => {
      try {
        const res = await fetch('/api/alerts/stats')
        if (!res.ok) return
        const json = await res.json()
        setAlertStats(json)
      } catch (e) {
        // ignore
      }
    }
    
    loadAlerts()
    loadAlertStats()
    const id1 = setInterval(loadAlerts, 5000)
    const id2 = setInterval(loadAlertStats, 10000)
    return () => {
      clearInterval(id1)
      clearInterval(id2)
    }
  }, [])

  const title = useMemo(() => {
    if (!data.file) return 'No CSV selected'
    if (mode === 'latest') {
      return `🔴 LIVE - ${data.file} (${data.rows.length} rows)`
    }
    return `Selected: ${data.file} (${data.rows.length} rows)`
  }, [data, mode])

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #f8fafc, #e2e8f0)',
      padding: '24px',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"' 
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Shield size={36} />
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>Suricata IDS Dashboard</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.95, fontSize: '14px' }}>
            <Activity size={16} style={{ animation: mode === 'latest' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
            <span>{title}</span>
            {mode === 'latest' && (
              <span style={{ 
                fontSize: '12px', 
                opacity: 0.8,
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                Syncing every {intervalMs / 1000}s
              </span>
            )}
          </div>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            marginTop: '12px',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            opacity: 0.9
          }}>
            <Clock size={14} />
            <span>CSVs auto-delete after 10 minutes • Use Save to preserve</span>
          </div>
        </div>

        {/* Controls Panel */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Mode Selection */}
            <div style={{ display: 'flex', gap: '12px', padding: '6px', background: '#f8fafc', borderRadius: '8px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: mode === 'file' ? '#667eea' : 'transparent',
                color: mode === 'file' ? 'white' : '#64748b',
                fontWeight: mode === 'file' ? '600' : '400',
                transition: 'all 0.2s'
              }}>
                <input 
                  type="radio" 
                  name="mode" 
                  value="file" 
                  checked={mode === 'file'} 
                  onChange={() => setMode('file')}
                  style={{ display: 'none' }}
                /> 
                <FileText size={16} />
                Select file
              </label>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: mode === 'latest' ? '#667eea' : 'transparent',
                color: mode === 'latest' ? 'white' : '#64748b',
                fontWeight: mode === 'latest' ? '600' : '400',
                transition: 'all 0.2s'
              }}>
                <input 
                  type="radio" 
                  name="mode" 
                  value="latest" 
                  checked={mode === 'latest'} 
                  onChange={() => setMode('latest')}
                  style={{ display: 'none' }}
                /> 
                <Activity size={16} />
                Latest completed
              </label>
            </div>

            {mode === 'file' && (
              <>
                <select 
                  value={selected} 
                  onChange={(e) => {
                    setSelected(e.target.value)
                    setHasUserSelected(true)
                  }} 
                  style={{ 
                    minWidth: '320px',
                    padding: '10px 14px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                >
                  <option value="" disabled>Select a CSV file</option>
                  {files.map((f) => {
                    const fileName = typeof f === 'string' ? f : f.name
                    const isSaved = typeof f === 'object' && f.saved
                    const age = typeof f === 'object' && f.age_minutes ? `${f.age_minutes}m` : ''
                    return (
                      <option key={fileName} value={fileName}>
                        {isSaved ? '📌 ' : ''}{fileName} {age ? `(${age})` : ''}
                      </option>
                    )
                  })}
                </select>
                <button 
                  onClick={() => fetchFile(selected)} 
                  style={{ 
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#667eea',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#5a67d8'
                    e.target.style.transform = 'translateY(-1px)'
                    e.target.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)'
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = '#667eea'
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  <FileText size={16} />
                  Load file
                </button>
                
                {selected && (() => {
                  const selectedFile = files.find(f => (typeof f === 'string' ? f : f.name) === selected)
                  const isSaved = typeof selectedFile === 'object' && selectedFile?.saved
                  
                  if (isSaved) {
                    return (
                      <button 
                        onClick={() => unsaveFile(selected)} 
                        style={{ 
                          padding: '10px 20px',
                          border: 'none',
                          borderRadius: '8px',
                          background: '#f59e0b',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#d97706'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.4)'
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#f59e0b'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        <X size={16} />
                        Unsave
                      </button>
                    )
                  } else {
                    return (
                      <button 
                        onClick={() => saveFile(selected)} 
                        style={{ 
                          padding: '10px 20px',
                          border: 'none',
                          borderRadius: '8px',
                          background: '#10b981',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#059669'
                          e.target.style.transform = 'translateY(-1px)'
                          e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)'
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = '#10b981'
                          e.target.style.transform = 'translateY(0)'
                          e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <Bookmark size={16} />
                        Save CSV
                      </button>
                    )
                  }
                })()}
              </>
            )}

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              background: '#f8fafc',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>Rows limit:</label>
              <input 
                type="number" 
                min={50} 
                max={5000} 
                step={50} 
                value={limit} 
                onChange={(e) => setLimit(parseInt(e.target.value || '0', 10))} 
                style={{ 
                  width: '80px',
                  padding: '6px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {mode === 'latest' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: '#f8fafc',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>Refresh (ms):</label>
                <input 
                  type="number" 
                  min={1000} 
                  max={60000} 
                  step={1000} 
                  value={intervalMs} 
                  onChange={(e) => setIntervalMs(parseInt(e.target.value || '0', 10))} 
                  style={{ 
                    width: '80px',
                    padding: '6px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {mode === 'latest' && (
              <button 
                onClick={fetchLatest} 
                style={{ 
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#059669'
                  e.target.style.transform = 'translateY(-1px)'
                  e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.4)'
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#10b981'
                  e.target.style.transform = 'translateY(0)'
                  e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'
                }}
              >
                <RefreshCw size={16} />
                Refresh now
              </button>
            )}

            {loading && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                color: '#667eea',
                fontWeight: '500',
                fontSize: '14px'
              }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Loading...</span>
              </div>
            )}
            {error && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                color: '#ef4444',
                background: '#fee2e2',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: '500',
                fontSize: '14px'
              }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Flows Table Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Activity size={24} style={{ color: '#667eea' }} />
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Network Flows</h2>
            <div style={{ 
              background: '#667eea',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {data.rows.length} records
            </div>
            
            {!advancedMode && (
              <div style={{ 
                background: '#fef3c7',
                color: '#78350f',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                Showing key properties
              </div>
            )}
            
            {/* Advanced Mode Toggle */}
            <button
              onClick={() => setAdvancedMode(!advancedMode)}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: advancedMode ? '#667eea' : 'white',
                color: advancedMode ? 'white' : '#667eea',
                border: `2px solid ${advancedMode ? '#667eea' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (!advancedMode) {
                  e.target.style.borderColor = '#667eea'
                  e.target.style.background = '#f8fafc'
                }
              }}
              onMouseOut={(e) => {
                if (!advancedMode) {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.background = 'white'
                }
              }}
            >
              <Settings size={16} />
              {advancedMode ? 'Advanced Mode' : 'Basic Mode'}
            </button>
          </div>
          <FlowsTable rows={data.rows} advancedMode={advancedMode} />
        </div>

        {/* Alerts Section */}
        <div>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Suricata Alerts</h2>
            <div style={{ 
              background: alerts.length > 0 ? '#ef4444' : '#10b981',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {alerts.length} showing
            </div>
            
            <div style={{ 
              background: '#fef3c7',
              color: '#78350f',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              border: '1px solid #fbbf24'
            }}>
              💡 Click highlighted rows for details
            </div>
            
            {/* Alert History Stats */}
            <div style={{ 
              display: 'flex',
              gap: '8px',
              marginLeft: 'auto'
            }}>
              <div style={{ 
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#64748b',
                fontWeight: '600'
              }}>
                📊 Total History: <span style={{ color: '#1e293b' }}>{alertStats.total}</span>
              </div>
              <div style={{ 
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#78350f',
                fontWeight: '600'
              }}>
                🕐 Last 24h: <span style={{ color: '#92400e' }}>{alertStats.recent_24h}</span>
              </div>
            </div>
          </div>
          <Alerts alerts={alerts} />
        </div>
      </div>

      {/* Add animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
