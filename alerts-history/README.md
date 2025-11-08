# Alert History System

This directory stores the persistent history of Suricata IDS alerts.

## Files

- **`alerts_history.json`** - Main database file containing all stored alerts with timestamps
- **`.last_processed`** - Tracks the last processed position in eve.json to avoid duplicates

## How It Works

1. **Continuous Monitoring**: The system continuously monitors `/var/log/suricata/eve.json`
2. **Incremental Processing**: Only new alerts (after last processed position) are read
3. **Deduplication**: Position tracking prevents duplicate alerts from being stored
4. **Timestamping**: Each alert gets a `stored_at` timestamp when saved
5. **Size Management**: Keeps last 10,000 alerts to prevent excessive file growth

## API Endpoints

### Get Alerts
```
GET /api/alerts?limit=200
```
Returns recent alerts from history. New alerts are automatically processed and stored.

Response:
```json
{
  "alerts": [...],
  "total_in_history": 1234,
  "returned": 200
}
```

### Get Statistics
```
GET /api/alerts/stats
```
Returns alert statistics including severity breakdown and 24-hour count.

Response:
```json
{
  "total": 1234,
  "by_severity": {
    "1": 45,
    "2": 123,
    "3": 1066
  },
  "recent_24h": 234
}
```

### Clear History
```
DELETE /api/alerts/clear
```
Clears all alert history (useful for testing or cleanup).

## Alert Structure

Each stored alert contains:
- Original Suricata alert data (signature, severity, IPs, etc.)
- `stored_at` - ISO timestamp when alert was stored
- All original eve.json fields preserved

## Benefits

- ✅ **Persistent Storage** - Alerts are never lost
- ✅ **Historical Analysis** - Analyze past security events
- ✅ **No Duplicates** - Position tracking ensures unique alerts
- ✅ **Performance** - Incremental processing is efficient
- ✅ **Size Managed** - Auto-cleanup keeps storage reasonable
- ✅ **Always Available** - Works even if eve.json is rotated

## Storage Location

All alert history is stored in:
```
/home/abhishek/trinetra_demo/suricata-ids-with-ml/alerts-history/
```
