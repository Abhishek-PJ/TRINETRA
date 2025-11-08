import os
import time
import threading
import pandas as pd
from datetime import datetime
from subprocess import Popen
import xgboost
import signal
import joblib
import pexpect  # giữ lại nếu bạn dùng suricatasc theo dạng shell
import numpy as np
from cicflowmeter.sniffer import create_sniffer

# Configuration
INTERFACE = os.environ.get("SURICATA_IFACE", "wlp0s20f3")
MODEL_PATH = "/etc/suricata/model/xgboost_model_4class.pkl"
BLACKLIST_FILE = "/etc/suricata/rules/blacklist.txt"
CSV_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "traffic-csv"))
FLOW_TIMEOUT = 3.0
SURICATA_ONLY = os.environ.get("SURICATA_ONLY", "0") == "1"

# Load model
class DummyModel:
    def predict(self, X):
        return np.full(len(X), -1)

model = DummyModel()

# Attack labels
MALICIOUS_LABELS = {
    1: 'Brute Force',
    2: 'DdoS',
    3: 'Port Scan'
}

# Feature columns (must match training set)
FEATURE_COLUMNS = {
    "src_port": "int32",             # Giả định theo logic chung vì không có trong danh sách gốc
    "dst_port": "int32",
    "flow_byts_s": "float32",
    "flow_pkts_s": "float32",
    "fwd_pkts_s": "float32",
    "bwd_pkts_s": "float32",
    "bwd_pkt_len_min": "float32",
    "fwd_seg_size_min": "int32",
    "bwd_iat_max": "float32",
    "bwd_iat_min": "float32",
    "bwd_iat_mean": "float32",
    "bwd_iat_std": "float32",
    "init_bwd_win_byts": "int32"
}

# IP blacklist set (in-memory)
blacklisted_ips = set()
blacklist_lock = threading.Lock()

# Blacklist IP via Suricata and write to file
def add_ip_to_blacklist(ip):
    with blacklist_lock:
        if ip in blacklisted_ips:
            print(f"[BLACKLIST] {ip} already blacklisted.")
            return

        try:
            # Ghi IP vào file blacklist
            with open(BLACKLIST_FILE, "a") as f:
                f.write(f"{ip}\n")

            # Thêm IP vào danh sách đen trong bộ nhớ
            blacklisted_ips.add(ip)
            print(f"[BLACKLIST] IP {ip} has been added to {BLACKLIST_FILE}.")

            # Reload Suricata rules
            cmds = [
                "sudo suricatasc -c 'reload-rules'"
            ]
            for cmd in cmds:
                pexpect.run(cmd)

        except Exception as e:
            print(f"[ERROR] Failed to blacklist {ip}: {e}")

# Hàm xử lý và dự đoán
def process_and_predict(csv_file=None, input_data=None, source_ips=None):
    try:
        # Nếu có file CSV, xử lý file CSV
        if csv_file:
            # Đọc file CSV
            df = pd.read_csv(csv_file)

            # Lấy địa chỉ IP nguồn (nếu không tồn tại, sử dụng giá trị mặc định là "10.81.50.100")
            source_ips = df.get("src_ip", pd.Series(["10.81.50.100"] * len(df)))

            # Kiểm tra và thêm các cột bị thiếu với giá trị mặc định
            for column in FEATURE_COLUMNS.keys():
                if column not in df.columns:
                    print(f"[WARNING] Missing column: {column}. Filling with default value 0.")
                    df[column] = 0  # Thêm cột bị thiếu với giá trị mặc định

            # Lọc và sắp xếp các cột theo thứ tự mà mô hình yêu cầu
            input_data = df[list(FEATURE_COLUMNS.keys())].astype(FEATURE_COLUMNS)

        # Nếu không có dữ liệu đầu vào, báo lỗi
        if input_data is None or source_ips is None:
            print("[ERROR] No input data or source IPs provided.")
            return

        # Dự đoán bằng mô hình
        predictions = model.predict(input_data)

        # Xử lý kết quả dự đoán
        for idx, prediction in enumerate(predictions):
            src_ip = source_ips.iloc[idx] if idx < len(source_ips) else "10.81.50.100"
            if src_ip == "0.0.0.0":
                src_ip = "10.81.50.100"
            if prediction in MALICIOUS_LABELS:
                attack_type = MALICIOUS_LABELS[prediction]
                print(f"[ALERT] 🚨 Detected {attack_type} from IP: {src_ip}")
                add_ip_to_blacklist(src_ip)
            else:
                print(f"[INFO] ✅ Benign traffic from IP: {src_ip}")

    except Exception as e:
        print(f"[ERROR] Processing or prediction failed: {e}")

# Modified: Start CICFlowMeter for exactly 60 seconds, then stop it
def run_cicflowmeter_timed(interface, output_csv, duration=60):
    try:
        sniffer, session = create_sniffer(
            input_file=None,
            input_interface=interface,
            output_mode="csv",
            output=output_csv,
            fields=None,
            verbose=False,
        )
        sniffer.start()
        time.sleep(duration)
        sniffer.stop()
        # Stop periodic GC if present
        if hasattr(session, "_gc_stop"):
            session._gc_stop.set()
            session._gc_thread.join(timeout=2.0)
        sniffer.join()
        # Flush all flows at the end
        session.flush_flows()
    except Exception as e:
        print(f"[ERROR] CICFlowMeter failed: {e}")

# Traffic capture loop
def capture_and_process_traffic():
    while True:
        try:
            start_time = datetime.now()
            timestamp = start_time.strftime("%H-%M-%S-%d-%m-%Y")
            output_csv = os.path.join(CSV_DIR, f"{timestamp}.csv")

            print(f"[CAPTURE] Capturing on {INTERFACE}, saving to {output_csv}...")
            run_cicflowmeter_timed(INTERFACE, output_csv, duration=30)

            # Only process if file exists and is non-empty
            if os.path.exists(output_csv) and os.path.getsize(output_csv) > 0:
                if SURICATA_ONLY:
                    print(f"[PROCESS] SURICATA_ONLY=1 set; skipping ML prediction for {output_csv}")
                else:
                    print(f"[PROCESS] Analyzing {output_csv}...")
                    process_and_predict(csv_file=output_csv)
            else:
                print(f"[WARN] Skipping processing; capture output missing/empty: {output_csv}")
        except Exception as e:
            print(f"[ERROR] Traffic capture or processing failed: {e}")

# Main
if __name__ == "__main__":
    os.makedirs(CSV_DIR, exist_ok=True)
    thread = threading.Thread(target=capture_and_process_traffic, daemon=True)
    thread.start()
    while True:
        time.sleep(1)