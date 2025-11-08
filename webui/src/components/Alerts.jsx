import React, { useState } from 'react'
import { AlertCircle, AlertTriangle, Info, Shield } from 'lucide-react'

export function Alerts({ alerts }) {
  const [hoveredRow, setHoveredRow] = useState(null)
  const [hoveredColumn, setHoveredColumn] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)

  // Format timestamp to readable format: HH:MM:SS DD-MM-YY
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return timestamp // Return as-is if invalid
      
      // Format as: HH:MM:SS DD-MM-YY
      const year = String(date.getFullYear()).slice(-2) // Last 2 digits of year
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      
      return `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`
    } catch (e) {
      return timestamp
    }
  }

  // Get relative time (e.g., "2 min ago")
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return ''
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return ''
      
      const now = new Date()
      const diffMs = now - date
      const diffSec = Math.floor(diffMs / 1000)
      const diffMin = Math.floor(diffSec / 60)
      const diffHour = Math.floor(diffMin / 60)
      const diffDay = Math.floor(diffHour / 24)
      
      if (diffSec < 60) return 'just now'
      if (diffMin < 60) return `${diffMin}m ago`
      if (diffHour < 24) return `${diffHour}h ago`
      return `${diffDay}d ago`
    } catch (e) {
      return ''
    }
  }

  // Group alerts by source IP and signature
  const groupAlerts = (alertsList) => {
    const grouped = {}
    
    alertsList.forEach(ev => {
      const a = ev.alert || {}
      const src_ip = ev?.src_ip || ev?.src?.ip || ''
      const signature = a?.signature || 'Unknown'
      const severity = a?.severity
      const timestamp = ev?.timestamp || ''
      
      // Create unique key for grouping
      const key = `${src_ip}|${signature}|${severity}`
      
      if (!grouped[key]) {
        grouped[key] = {
          src_ip,
          signature,
          severity,
          dst_ip: ev?.dest_ip || ev?.dst_ip || ev?.dest?.ip || '',
          proto: ev?.proto || '',
          timestamps: [],
          rawTimestamps: [], // Keep original for sorting
          count: 0,
          latest: timestamp,
          latestFormatted: formatTimestamp(timestamp)
        }
      }
      
      grouped[key].timestamps.push(formatTimestamp(timestamp))
      grouped[key].rawTimestamps.push(timestamp)
      grouped[key].count++
      
      // Keep the latest timestamp as primary
      if (timestamp > grouped[key].latest) {
        grouped[key].latest = timestamp
        grouped[key].latestFormatted = formatTimestamp(timestamp)
        grouped[key].dst_ip = ev?.dest_ip || ev?.dst_ip || ev?.dest?.ip || ''
        grouped[key].proto = ev?.proto || ''
      }
    })
    
    // Sort by latest first and sort timestamps within each group
    return Object.values(grouped).map(group => {
      // Sort timestamps in descending order (newest first)
      const sorted = [...group.rawTimestamps]
        .map((ts, idx) => ({ ts, formatted: group.timestamps[idx] }))
        .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      
      group.timestamps = sorted.map(item => item.formatted)
      return group
    }).sort((a, b) => {
      return new Date(b.latest) - new Date(a.latest)
    })
  }

  // Tooltip descriptions for alert properties
  const getColumnDescription = (columnName) => {
    const descriptions = {
      'time': '⏰ Time: When Suricata detected this security alert. Helps track incident timeline.',
      'severity': '⚠️ Severity: How serious the threat is (1=Critical, 2=Medium, 3=Low). Prioritize high severity!',
      'signature': '🔍 Signature: What type of attack or threat was detected. Describes the security rule that triggered.',
      'src_ip': '🌐 Source IP: The device that triggered the alert. Could be an attacker or compromised system.',
      'dst_ip': '🎯 Destination IP: The target being attacked or accessed. Often your protected systems.',
      'proto': '📋 Protocol: Communication method used (TCP/UDP/ICMP). Helps understand attack vector.',
    }
    return descriptions[columnName.toLowerCase()] || `📌 ${columnName}: Security alert attribute.`
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ 
        background: 'white',
        border: '2px dashed #cbd5e1',
        borderRadius: '12px',
        padding: '48px',
        textAlign: 'center',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Shield size={24} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '16px', fontWeight: '500' }}>No alerts detected - System secure</span>
        </div>
      </div>
    )
  }

  const getSeverityStyle = (severity) => {
    const sev = String(severity).toLowerCase()
    if (sev === '1' || sev === 'critical' || sev === 'high') {
      return {
        background: '#dc2626',
        color: 'white',
        icon: AlertCircle
      }
    } else if (sev === '2' || sev === 'medium' || sev === 'warning') {
      return {
        background: '#f59e0b',
        color: 'white',
        icon: AlertTriangle
      }
    } else if (sev === '3' || sev === 'low' || sev === 'info') {
      return {
        background: '#3b82f6',
        color: 'white',
        icon: Info
      }
    }
    return {
      background: '#64748b',
      color: 'white',
      icon: Info
    }
  }

  const getSeverityLabel = (severity) => {
    const sev = String(severity).toLowerCase()
    if (sev === '1') return 'Critical'
    if (sev === '2') return 'Medium'
    if (sev === '3') return 'Low'
    return severity
  }

  const getRowBackground = (severity, isHovered) => {
    if (isHovered) return '#fef3c7'
    const sev = String(severity).toLowerCase()
    if (sev === '1' || sev === 'critical' || sev === 'high') {
      return '#fef2f2'
    } else if (sev === '2' || sev === 'medium' || sev === 'warning') {
      return '#fffbeb'
    }
    return 'white'
  }

  const groupedAlerts = groupAlerts(alerts)
  
  return (
    <div style={{ 
      overflow: 'auto', 
      border: '1px solid #e2e8f0', 
      borderRadius: '12px',
      background: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      maxHeight: '500px'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th 
              onMouseEnter={() => setHoveredColumn('time')}
              onMouseLeave={() => setHoveredColumn(null)}
              style={{ 
              textAlign: 'left', 
              padding: '14px 16px',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
              fontWeight: '700',
              fontSize: '13px',
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              zIndex: 10,
              cursor: 'help'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Time
                <span style={{ fontSize: '10px', opacity: 0.6 }}>ℹ️</span>
              </span>
              {hoveredColumn === 'time' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  marginTop: '8px',
                  background: '#1e293b',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '400',
                  lineHeight: '1.5',
                  minWidth: '300px',
                  maxWidth: '400px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 1000,
                  whiteSpace: 'normal',
                  textTransform: 'none',
                  letterSpacing: '0',
                  animation: 'fadeIn 0.2s ease-in'
                }}>
                  {getColumnDescription('time')}
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '20px',
                    width: '12px',
                    height: '12px',
                    background: '#1e293b',
                    transform: 'rotate(45deg)'
                  }} />
                </div>
              )}
            </th>
            <th 
              onMouseEnter={() => setHoveredColumn('severity')}
              onMouseLeave={() => setHoveredColumn(null)}
              style={{ 
              textAlign: 'left', 
              padding: '14px 16px',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
              fontWeight: '700',
              fontSize: '13px',
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              zIndex: 10,
              cursor: 'help'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Severity
                <span style={{ fontSize: '10px', opacity: 0.6 }}>ℹ️</span>
              </span>
              {hoveredColumn === 'severity' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  marginTop: '8px',
                  background: '#1e293b',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '400',
                  lineHeight: '1.5',
                  minWidth: '300px',
                  maxWidth: '400px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 1000,
                  whiteSpace: 'normal',
                  textTransform: 'none',
                  letterSpacing: '0',
                  animation: 'fadeIn 0.2s ease-in'
                }}>
                  {getColumnDescription('severity')}
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '20px',
                    width: '12px',
                    height: '12px',
                    background: '#1e293b',
                    transform: 'rotate(45deg)'
                  }} />
                </div>
              )}
            </th>
            <th style={{ 
              textAlign: 'left', 
              padding: '14px 16px',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
              fontWeight: '700',
              fontSize: '13px',
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              zIndex: 10
            }}>Signature</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '14px 16px',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
              fontWeight: '700',
              fontSize: '13px',
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}>Source IP</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '14px 16px',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
              fontWeight: '700',
              fontSize: '13px',
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}>Dest IP</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '14px 16px',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky',
              top: 0,
              background: 'linear-gradient(to bottom, #fef3c7, #fde68a)',
              fontWeight: '700',
              fontSize: '13px',
              color: '#78350f',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}>Proto</th>
          </tr>
        </thead>
        <tbody>
          {groupedAlerts.map((group, i) => {
            const severity = group.severity
            const severityStyle = getSeverityStyle(severity)
            const SeverityIcon = severityStyle.icon
            const isRepeated = group.count > 1
            const isExpanded = expandedRow === i
            
            return (
              <React.Fragment key={i}>
                <tr 
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => isRepeated && setExpandedRow(isExpanded ? null : i)}
                  style={{
                    background: isRepeated ? (hoveredRow === i ? '#fef3c7' : '#fef9c3') : getRowBackground(severity, hoveredRow === i),
                    transition: 'all 0.15s ease',
                    borderLeft: isRepeated ? '4px solid #f59e0b' : (hoveredRow === i ? `4px solid ${severityStyle.background}` : '4px solid transparent'),
                    cursor: isRepeated ? 'pointer' : 'default',
                    fontWeight: isRepeated ? '600' : 'normal'
                  }}
                >
                  <td style={{ 
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '12px',
                          color: '#1e293b',
                          fontWeight: '600'
                        }}>
                          {group.latestFormatted}
                        </span>
                        {isRepeated && (
                          <span style={{
                            background: '#f59e0b',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}>
                            ×{group.count}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#64748b',
                        fontStyle: 'italic'
                      }}>
                        {getRelativeTime(group.latest)}
                      </div>
                    </div>
                  </td>
                <td style={{ 
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: severityStyle.background,
                    color: severityStyle.color,
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <SeverityIcon size={14} />
                    {getSeverityLabel(severity)}
                  </div>
                </td>
                <td style={{ 
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '13px',
                  color: '#1e293b',
                  fontWeight: '500',
                  maxWidth: '400px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {group.signature}
                </td>
                <td style={{ 
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '12px',
                  color: '#334155',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}>
                  {group.src_ip}
                </td>
                <td style={{ 
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '12px',
                  color: '#334155',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}>
                  {group.dst_ip}
                </td>
                <td style={{ 
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '13px',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  {group.proto}
                </td>
              </tr>
              
              {/* Expanded view showing all timestamps */}
              {isExpanded && isRepeated && (
                <tr style={{ background: '#fffbeb' }}>
                  <td colSpan="6" style={{ padding: '16px', borderBottom: '2px solid #fbbf24' }}>
                    <div style={{ 
                      fontSize: '12px',
                      color: '#78350f',
                      fontWeight: '600',
                      marginBottom: '8px'
                    }}>
                      🔍 All Attack Attempts ({group.count} times):
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '8px',
                      maxHeight: '200px',
                      overflow: 'auto',
                      padding: '12px',
                      background: '#fef3c7',
                      borderRadius: '8px',
                      border: '1px solid #fbbf24'
                    }}>
                      {group.timestamps.map((ts, idx) => (
                        <div key={idx} style={{
                          padding: '8px 12px',
                          background: 'white',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          color: '#92400e',
                          border: '1px solid #fcd34d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{
                            background: '#f59e0b',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: '700'
                          }}>
                            #{idx + 1}
                          </span>
                          {ts}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
