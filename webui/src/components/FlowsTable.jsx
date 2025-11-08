import React, { useState } from 'react'

export function FlowsTable({ rows, advancedMode = false }) {
  const [hoveredRow, setHoveredRow] = useState(null)
  const [hoveredColumn, setHoveredColumn] = useState(null)

  // Define important columns for basic view
  const getImportantColumns = (allColumns) => {
    const importantPatterns = [
      'timestamp',
      'src_ip', 'srcip', 'source_ip',
      'dst_ip', 'dstip', 'destination_ip', 'dest_ip',
      'src_port', 'srcport', 'source_port',
      'dst_port', 'dstport', 'destination_port', 'dest_port',
      'protocol', 'proto',
      'flow_duration', 'flowduration',
      'tot_fwd_packets', 'totfwdpackets',
      'tot_bwd_packets', 'totbwdpackets',
      'flow_byts_s', 'flowbytess',
      'byt_sec', 'bytsec',
      'prediction', 'label'
    ]
    
    return allColumns.filter(col => {
      const colLower = col.toLowerCase().replace(/_/g, '')
      return importantPatterns.some(pattern => 
        colLower.includes(pattern.replace(/_/g, ''))
      )
    })
  }

  // Tooltip descriptions for common network properties
  const getColumnDescription = (columnName) => {
    const col = columnName.toLowerCase().replace(/_/g, '')
    const descriptions = {
      'srcip': '🌐 Source IP: The address of the device sending the data.',
      'dstip': '🎯 Destination IP: Where the data is being sent.',
      'srcport': '🚪 Source Port: The specific application/service on the sender\'s device.',
      'dstport': '🏢 Destination Port: The service being accessed (e.g., 80=web, 443=secure web, 22=SSH).',
      'protocol': '📋 Protocol: The communication language used (TCP=reliable, UDP=fast, ICMP=diagnostic).',
      'timestamp': '⏰ Timestamp: When this network activity happened. Essential for tracking events.',
      'flowduration': '⏱️ Flow Duration: How long the connection lasted. Helps identify unusual patterns.',
      'totfwdpackets': '📤 Forward Packets: Number of data packets sent from source to destination.',
      'totbwdpackets': '📥 Backward Packets: Response packets sent back from destination to source.',
      'flowbytess': '📊 Flow Bytes: Total data transferred. Large amounts may indicate file transfers.',
      'flowpacketss': '📦 Total Packets: Number of data chunks exchanged. More packets = more activity.',
      'label': '🏷️ Label: Classification of the traffic (benign=safe, malicious=threat).',
      'prediction': '🤖 Prediction: ML model\'s assessment of whether this traffic is safe or suspicious.',
      'bytsec': '⚡ Bytes/Second: Data transfer speed. High speeds may indicate data exfiltration.',
      'pktsec': '🔄 Packets/Second: Packet rate. Unusually high rates can signal attacks.',
      'fwdpktlenmean': '📏 Avg Forward Packet Size: Typical size of sent packets. Helps identify traffic type.',
      'bwdpktlenmean': '📐 Avg Backward Packet Size: Typical size of response packets.',
      'flowiatmean': '⌛ Inter-Arrival Time: Average delay between packets. Regular patterns = normal traffic.',
      'activemean': '✅ Active Time: How long the connection was actively sending data.',
      'idlemean': '💤 Idle Time: Periods of inactivity. Long idle times can be suspicious.',
      'init': '🚀 Initial: First packet characteristics. Important for identifying connection types.',
      'ack': '✓ ACK Flags: Acknowledgment signals in TCP. Confirms data was received.',
      'syn': '🤝 SYN Flags: Synchronization signals to establish connections.',
      'fin': '👋 FIN Flags: Signals to close connections gracefully.',
      'rst': '🛑 RST Flags: Abrupt connection resets. May indicate problems or attacks.',
      'psh': '⏩ PSH Flags: Push flags to send data immediately without buffering.',
      'urg': '🚨 URG Flags: Urgent data markers. Rarely used in normal traffic.',
    }
    
    for (const [key, desc] of Object.entries(descriptions)) {
      if (col.includes(key)) {
        return desc
      }
    }
    
    return `${columnName}: Network traffic attribute used for security analysis.`
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={{ 
        background: 'white',
        border: '2px dashed #cbd5e1',
        borderRadius: '12px',
        padding: '48px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '16px',
        fontWeight: '500'
      }}>
        No data available
      </div>
    )
  }

  const allColumns = Object.keys(rows[0])
  const columns = advancedMode ? allColumns : getImportantColumns(allColumns)

  const getPredictionColor = (prediction) => {
    if (!prediction) return 'transparent'
    const pred = String(prediction).toLowerCase()
    if (pred.includes('benign') || pred === '0') {
      return '#dcfce7' // Light green
    } else if (pred.includes('malicious') || pred === '1' || pred.includes('attack')) {
      return '#fee2e2' // Light red
    }
    return 'transparent'
  }

  const getPredictionBadgeStyle = (prediction) => {
    if (!prediction) return {}
    const pred = String(prediction).toLowerCase()
    if (pred.includes('benign') || pred === '0') {
      return {
        background: '#10b981',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600',
        display: 'inline-block'
      }
    } else if (pred.includes('malicious') || pred === '1' || pred.includes('attack')) {
      return {
        background: '#ef4444',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600',
        display: 'inline-block'
      }
    }
    return {}
  }

  return (
    <div style={{ 
      overflow: 'auto', 
      border: '1px solid #e2e8f0', 
      borderRadius: '12px',
      background: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      maxHeight: '600px'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th 
                key={c} 
                onMouseEnter={() => setHoveredColumn(c)}
                onMouseLeave={() => setHoveredColumn(null)}
                style={{ 
                  textAlign: 'left', 
                  padding: '14px 16px',
                  borderBottom: '2px solid #e2e8f0',
                  position: 'sticky',
                  top: 0,
                  background: 'linear-gradient(to bottom, #f8fafc, #f1f5f9)',
                  fontWeight: '700',
                  fontSize: '13px',
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  cursor: 'help',
                  position: 'relative'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {c.replace(/_/g, ' ')}
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>ℹ️</span>
                </span>
                
                {/* Tooltip */}
                {hoveredColumn === c && (
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
                    {getColumnDescription(c)}
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
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const prediction = r['prediction'] || r['Prediction'] || r['label'] || r['Label']
            const rowBgColor = getPredictionColor(prediction)
            
            return (
              <tr 
                key={i}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  background: hoveredRow === i ? '#f0f9ff' : (i % 2 === 0 ? 'white' : '#fafbfc'),
                  transition: 'all 0.15s ease',
                  cursor: 'default'
                }}
              >
                {columns.map((c) => {
                  const value = r[c]
                  const isPrediction = c.toLowerCase() === 'prediction' || c.toLowerCase() === 'label'
                  
                  return (
                    <td key={c} style={{ 
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      fontFamily: isPrediction ? 'inherit' : 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '13px',
                      color: '#334155',
                      whiteSpace: 'nowrap',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      background: hoveredRow === i ? '#f0f9ff' : (isPrediction ? getPredictionColor(value) : 'transparent')
                    }}>
                      {isPrediction ? (
                        <span style={getPredictionBadgeStyle(value)}>
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
