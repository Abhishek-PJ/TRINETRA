import os
import csv
import time
import shutil
import json
import hashlib
import random
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
CSV_DIR = (BASE_DIR.parent / "traffic-csv").resolve()
SAVED_DIR = (BASE_DIR.parent / "traffic-csv-saved").resolve()
ALERTS_DIR = (BASE_DIR.parent / "alerts-history").resolve()
EVE_PATH = Path(os.environ.get("EVE_PATH", "/var/log/suricata/eve.json"))
ALERTS_DB_PATH = ALERTS_DIR / "alerts_history.json"

# Create directories if they don't exist
SAVED_DIR.mkdir(exist_ok=True)
ALERTS_DIR.mkdir(exist_ok=True)

# Track last processed position in eve.json to avoid duplicates
LAST_PROCESSED_FILE = ALERTS_DIR / ".last_processed"

def get_last_processed_position():
    """Get the last processed position in eve.json."""
    try:
        if LAST_PROCESSED_FILE.exists():
            with LAST_PROCESSED_FILE.open('r') as f:
                data = json.load(f)
                return data.get('position', 0)
    except Exception:
        pass
    return 0

def set_last_processed_position(position):
    """Save the last processed position in eve.json."""
    try:
        with LAST_PROCESSED_FILE.open('w') as f:
            json.dump({'position': position}, f)
    except Exception:
        pass

app = FastAPI(title="Suricata IDS Web API")

# Allow local dev UIs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Flow(BaseModel):
    src_ip: Optional[str] = None
    dst_ip: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: Optional[int] = None
    timestamp: Optional[str] = None
    # Keep flexible for other numeric fields
    extra: dict


def list_csv_files(include_saved: bool = True, max_age_minutes: int = 10) -> List[dict]:
    """List CSV files with metadata, filtering by age and including saved files."""
    if not CSV_DIR.exists():
        return []
    
    files_info = []
    cutoff_time = time.time() - (max_age_minutes * 60)
    
    # Get regular CSV files
    for p in sorted(CSV_DIR.glob("*.csv")):
        try:
            stat = p.stat()
            file_info = {
                "name": p.name,
                "path": p,
                "mtime": stat.st_mtime,
                "saved": False,
                "age_minutes": (time.time() - stat.st_mtime) / 60
            }
            # Only include if within age limit
            if stat.st_mtime >= cutoff_time:
                files_info.append(file_info)
        except Exception:
            continue
    
    # Get saved CSV files if requested
    if include_saved and SAVED_DIR.exists():
        for p in sorted(SAVED_DIR.glob("*.csv")):
            try:
                stat = p.stat()
                files_info.append({
                    "name": p.name,
                    "path": p,
                    "mtime": stat.st_mtime,
                    "saved": True,
                    "age_minutes": (time.time() - stat.st_mtime) / 60
                })
            except Exception:
                continue
    
    # Sort by modification time (newest first)
    files_info.sort(key=lambda x: x["mtime"], reverse=True)
    return files_info


def cleanup_old_csvs(max_age_minutes: int = 10):
    """Delete CSV files older than max_age_minutes from CSV_DIR."""
    if not CSV_DIR.exists():
        return 0
    
    deleted_count = 0
    cutoff_time = time.time() - (max_age_minutes * 60)
    
    for p in CSV_DIR.glob("*.csv"):
        try:
            if p.stat().st_mtime < cutoff_time:
                p.unlink()
                deleted_count += 1
        except Exception:
            continue
    
    return deleted_count


def read_csv_head(p: Path, limit: int = 100) -> List[dict]:
    if not p.exists():
        raise FileNotFoundError(str(p))
    rows: List[dict] = []
    try:
        with p.open("r", newline="") as f:
            # Assume header exists; DictReader will handle normal CSVs
            reader = csv.DictReader(f)
            # If no header detected, fieldnames may be None; guard
            if getattr(reader, 'fieldnames', None) is None:
                return []
            for i, row in enumerate(reader):
                if i >= limit:
                    break
                rows.append(row)
    except Exception:
        # If anything goes wrong (encoding, malformed), return empty rows
        return []
    return rows


def latest_nonempty_rows(limit: int = 200, skip_newest: bool = True):
    files = list_csv_files(include_saved=False, max_age_minutes=10)  # Don't include saved files for latest
    if not files:
        return None, []

    # Extract Path objects (already sorted newest first by list_csv_files)
    file_paths = [f["path"] for f in files]
    
    if skip_newest:
        # Optionally skip the newest file to avoid reading an in-progress capture
        candidates = file_paths[1:] if len(file_paths) > 1 else file_paths
    else:
        # Include all files, starting with newest
        candidates = file_paths

    # Search from newest to oldest among candidates
    for p in candidates:
        try:
            if p.stat().st_size == 0:
                continue
            rows = read_csv_head(p, limit=limit)
            if rows:
                return p.name, rows
        except Exception:
            # Try the next older file if this one is mid-write or malformed
            continue
    
    return None, []


@app.get("/api/files")
def api_files(background_tasks: BackgroundTasks):
    # Schedule cleanup in background
    background_tasks.add_task(cleanup_old_csvs, max_age_minutes=10)
    
    files = list_csv_files(include_saved=True, max_age_minutes=10)
    return {
        "count": len(files),
        "files": [{
            "name": f["name"],
            "saved": f["saved"],
            "age_minutes": round(f["age_minutes"], 1)
        } for f in files]
    }


@app.get("/api/latest")
def api_latest(limit: int = 200):
    name, rows = latest_nonempty_rows(limit=limit, skip_newest=False)
    return {"file": name, "rows": rows}


@app.get("/api/file/{name}")
def api_file(name: str, limit: int = 500):
    # Check both regular and saved directories
    target = CSV_DIR / name
    saved = False
    
    if not target.exists():
        target = SAVED_DIR / name
        saved = True
        
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Never fail: on read error, return empty rows for a smoother UX
    rows = read_csv_head(target, limit=limit)
    return {"file": target.name, "rows": rows, "saved": saved}


@app.get("/api/health")
def health():
    return {"status": "ok", "csv_dir": str(CSV_DIR), "eve_path": str(EVE_PATH)}


# Entry for `uvicorn main:app --reload --port 8000`


def load_alert_history() -> list:
    """Load alert history from JSON file."""
    try:
        if ALERTS_DB_PATH.exists():
            with ALERTS_DB_PATH.open('r') as f:
                return json.load(f)
    except Exception:
        pass
    return []

def save_alert_history(alerts: list):
    """Save alert history to JSON file."""
    try:
        with ALERTS_DB_PATH.open('w') as f:
            json.dump(alerts, f, indent=2)
    except Exception:
        pass

def generate_alert_fingerprint(alert_obj):
    """Generate a unique fingerprint for an alert to detect duplicates."""
    try:
        alert = alert_obj.get('alert', {})
        
        # Create fingerprint from key fields
        fingerprint_data = {
            'timestamp': alert_obj.get('timestamp', ''),
            'signature': alert.get('signature', ''),
            'signature_id': alert.get('signature_id', ''),
            'severity': alert.get('severity', ''),
            'src_ip': alert_obj.get('src_ip', ''),
            'dest_ip': alert_obj.get('dest_ip', ''),
            'proto': alert_obj.get('proto', '')
        }
        
        # Create hash from the fingerprint data
        fingerprint_str = json.dumps(fingerprint_data, sort_keys=True)
        return hashlib.md5(fingerprint_str.encode()).hexdigest()
    except Exception:
        # If we can't generate fingerprint, return random to allow storage
        return f"random_{random.randint(0, 999999)}"

def store_new_alerts():
    """Process new alerts from eve.json and store them in history (without duplicates)."""
    try:
        if not EVE_PATH.exists():
            return 0
        
        last_pos = get_last_processed_position()
        new_alerts = []
        
        with EVE_PATH.open('r') as f:
            # Seek to last processed position
            f.seek(last_pos)
            
            for line in f:
                try:
                    obj = json.loads(line.strip())
                    if isinstance(obj, dict) and obj.get("alert"):
                        # Add processing timestamp and fingerprint
                        obj['stored_at'] = datetime.now().isoformat()
                        obj['_fingerprint'] = generate_alert_fingerprint(obj)
                        new_alerts.append(obj)
                except Exception:
                    continue
            
            # Save current position
            current_pos = f.tell()
            set_last_processed_position(current_pos)
        
        if new_alerts:
            # Load existing history
            history = load_alert_history()
            
            # Build set of existing fingerprints for fast lookup
            existing_fingerprints = set()
            for alert in history:
                if '_fingerprint' in alert:
                    existing_fingerprints.add(alert['_fingerprint'])
            
            # Filter out duplicates from new alerts
            unique_new_alerts = []
            for alert in new_alerts:
                if alert['_fingerprint'] not in existing_fingerprints:
                    unique_new_alerts.append(alert)
                    existing_fingerprints.add(alert['_fingerprint'])
            
            if unique_new_alerts:
                # Add only unique new alerts
                history.extend(unique_new_alerts)
                
                # Keep only last 10000 alerts to prevent file from growing too large
                if len(history) > 10000:
                    history = history[-10000:]
                
                # Save updated history
                save_alert_history(history)
                
                return len(unique_new_alerts)
        
        return 0
    except Exception:
        return 0

def read_eve_alerts(limit: int = 200) -> list:
    """Read alerts from history (stored alerts)."""
    try:
        # First, process any new alerts from eve.json
        store_new_alerts()
        
        # Then return from history
        history = load_alert_history()
        
        # Return most recent alerts
        return history[-limit:] if history else []
    except Exception:
        return []


@app.get("/api/alerts")
def api_alerts(limit: int = 200, background_tasks: BackgroundTasks = None):
    """Get alerts from history. New alerts are automatically stored."""
    alerts = read_eve_alerts(limit=limit)
    return {
        "alerts": alerts,
        "total_in_history": len(load_alert_history()),
        "returned": len(alerts)
    }


@app.get("/api/alerts/stats")
def api_alerts_stats():
    """Get alert statistics."""
    history = load_alert_history()
    
    if not history:
        return {
            "total": 0,
            "by_severity": {},
            "recent_24h": 0
        }
    
    # Count by severity
    by_severity = {}
    recent_24h = 0
    now = datetime.now()
    
    for alert in history:
        severity = alert.get('alert', {}).get('severity', 'unknown')
        by_severity[str(severity)] = by_severity.get(str(severity), 0) + 1
        
        # Count recent alerts (last 24 hours)
        try:
            if 'stored_at' in alert:
                stored_time = datetime.fromisoformat(alert['stored_at'])
                if (now - stored_time).total_seconds() < 86400:
                    recent_24h += 1
        except Exception:
            pass
    
    return {
        "total": len(history),
        "by_severity": by_severity,
        "recent_24h": recent_24h
    }


@app.delete("/api/alerts/clear")
def api_clear_alerts():
    """Clear alert history (useful for testing or cleanup)."""
    try:
        if ALERTS_DB_PATH.exists():
            ALERTS_DB_PATH.unlink()
        if LAST_PROCESSED_FILE.exists():
            LAST_PROCESSED_FILE.unlink()
        return {"message": "Alert history cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear alerts: {str(e)}")


@app.post("/api/save/{name}")
def api_save_csv(name: str):
    """Save a CSV file to prevent auto-deletion."""
    source = CSV_DIR / name
    
    if not source.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if already saved
    target = SAVED_DIR / name
    if target.exists():
        return {"message": "File already saved", "name": name, "saved": True}
    
    # Copy file to saved directory
    try:
        shutil.copy2(source, target)
        return {"message": "File saved successfully", "name": name, "saved": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@app.delete("/api/save/{name}")
def api_unsave_csv(name: str):
    """Remove a CSV from saved directory."""
    target = SAVED_DIR / name
    
    if not target.exists():
        raise HTTPException(status_code=404, detail="Saved file not found")
    
    try:
        target.unlink()
        return {"message": "File removed from saved", "name": name, "saved": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unsave file: {str(e)}")


@app.post("/api/cleanup")
def api_cleanup(max_age_minutes: int = 10):
    """Manually trigger cleanup of old CSV files."""
    deleted = cleanup_old_csvs(max_age_minutes=max_age_minutes)
    return {"message": f"Deleted {deleted} old CSV files", "deleted_count": deleted}
