export const SCHEMA_SQL = `
-- Fleet Digital Database Schema (SQLite 3 / ACID compliant)

PRAGMA foreign_keys = ON;

-- 1. Users & Accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  password_hash TEXT,
  driver_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle TEXT NOT NULL,
  model TEXT,
  sales_rep TEXT,
  default_route TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_custom INTEGER DEFAULT 0,
  is_imd INTEGER DEFAULT 0,
  box_capacity REAL,
  job_title TEXT,
  organization TEXT,
  total_assigned_km REAL DEFAULT 0,
  auto_odo_config TEXT, -- JSON
  auto_waybill_enabled INTEGER DEFAULT 1,
  telemetry_json TEXT, -- JSON
  km_privacy_pin TEXT, -- IMD Driver KM privacy PIN
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drivers_code ON drivers(code);
CREATE INDEX IF NOT EXISTS idx_drivers_vehicle ON drivers(vehicle);

-- 3. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  plate TEXT PRIMARY KEY,
  model TEXT,
  driver_id TEXT,
  imei TEXT,
  default_driver_name TEXT,
  status TEXT DEFAULT 'active',
  last_telemetry_json TEXT,
  updated_at TEXT NOT NULL
);

-- 4. Trips & Waybills
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD
  driver_id TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  sales_rep TEXT,
  zone TEXT,
  start_odo REAL NOT NULL,
  end_odo REAL,
  total_km REAL,
  fuel_liters REAL,
  fuel_cost REAL,
  fuel_station TEXT,
  fuel_receipt_no TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, approved
  odo_calculation_status TEXT DEFAULT 'pending', -- pending, valid, invalid, manual_override, requires_review
  route_note TEXT,
  is_manual INTEGER DEFAULT 0,
  manual_override_reason TEXT,
  manual_override_by TEXT,
  manual_override_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trips_driver_date ON trips(driver_id, date);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_date ON trips(vehicle_number, date);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);

-- 5. Daily GPS Telemetry & Mileages
CREATE TABLE IF NOT EXISTS daily_gps_mileages (
  vehicle_number TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  driver_id TEXT,
  total_km REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'gpsbox_api', -- gpsbox_api, manual
  fetched_at TEXT NOT NULL,
  api_status TEXT NOT NULL DEFAULT 'success', -- success, error, no_data
  start_odo REAL,
  end_odo REAL,
  note TEXT,
  PRIMARY KEY(vehicle_number, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_gps_date ON daily_gps_mileages(date);

-- 6. Raw Telemetry
CREATE TABLE IF NOT EXISTS telemetry_raw (
  id TEXT PRIMARY KEY,
  device_id TEXT,
  vehicle_number TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  odo REAL,
  fuel TEXT,
  fuel_liters REAL,
  fuel_percent REAL,
  temp TEXT,
  speed REAL,
  latitude REAL,
  longitude REAL,
  source TEXT NOT NULL,
  payload_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_telemetry_veh_recorded ON telemetry_raw(vehicle_number, recorded_at);

-- 7. Fuel Refills
CREATE TABLE IF NOT EXISTS fuel_refills (
  id TEXT PRIMARY KEY,
  vehicle_number TEXT NOT NULL,
  driver_id TEXT,
  date_time TEXT NOT NULL,
  liters REAL NOT NULL,
  station TEXT,
  cost REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  transaction_id TEXT,
  fuel_receipt_no TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fuel_veh ON fuel_refills(vehicle_number);

-- 8. IMD Orders
CREATE TABLE IF NOT EXISTS imd_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  customer TEXT NOT NULL,
  customer_org TEXT,
  province TEXT NOT NULL,
  destination TEXT NOT NULL,
  quantity TEXT,
  received_date TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Хүлээгдэж буй',
  assignment_id TEXT,
  share_token TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_orderno ON imd_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_share_token ON imd_orders(share_token);

-- 9. IMD Assignments
CREATE TABLE IF NOT EXISTS imd_assignments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  primary_driver_id TEXT NOT NULL,
  primary_driver_name TEXT NOT NULL,
  secondary_driver_id TEXT,
  secondary_driver_name TEXT,
  departure_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Хуваарилсан',
  token TEXT,
  payload_json TEXT, -- Full assignment details
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON imd_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_token ON imd_assignments(token);

-- 10. IMD Routes
CREATE TABLE IF NOT EXISTS imd_routes (
  id TEXT PRIMARY KEY,
  province TEXT NOT NULL,
  route_name TEXT NOT NULL,
  distance_km REAL NOT NULL,
  estimated_hours REAL,
  payload_json TEXT
);

-- 11. Official Letters
CREATE TABLE IF NOT EXISTS official_letters (
  id TEXT PRIMARY KEY,
  letter_number TEXT NOT NULL UNIQUE,
  order_id TEXT,
  assignment_id TEXT,
  file_id TEXT,
  file_name TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'DONE',
  payload_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_letters_number ON official_letters(letter_number);

-- 12. Public Share Tokens (Cryptographic tokens, hash-stored, scoped, expirable)
CREATE TABLE IF NOT EXISTS public_share_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL, -- imd_order_view, driver_trip_view, document_view
  resource_type TEXT NOT NULL, -- order, assignment, letter
  resource_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Unix epoch ms
  revoked_at INTEGER, -- Nullable Unix epoch ms
  created_at INTEGER NOT NULL,
  created_by TEXT,
  last_accessed_at INTEGER,
  access_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON public_share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_resource ON public_share_tokens(resource_type, resource_id);

-- 13. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  old_value_json TEXT,
  new_value_json TEXT,
  ip TEXT,
  request_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);

-- 14. App Configuration
CREATE TABLE IF NOT EXISTS app_configs (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 15. Migration Runs
CREATE TABLE IF NOT EXISTS migration_runs (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  checksum TEXT NOT NULL,
  record_counts_json TEXT NOT NULL
);

-- 16. Backup Metadata
CREATE TABLE IF NOT EXISTS backup_metadata (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  record_counts_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

-- 17. Daily Driver Assignments
CREATE TABLE IF NOT EXISTS daily_driver_assignments (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL, -- YYYY-MM-DD
  vehicle_plate TEXT NOT NULL,
  vehicle_division TEXT NOT NULL, -- 'IMT' or 'IMD'
  route_id TEXT,
  route_name TEXT,
  original_driver_id TEXT NOT NULL,
  original_driver_name TEXT NOT NULL,
  original_driver_code TEXT,
  actual_driver_id TEXT NOT NULL,
  actual_driver_name TEXT NOT NULL,
  actual_driver_code TEXT,
  driver_phone TEXT,
  driver_status TEXT DEFAULT 'Идэвхтэй',
  driver_reason TEXT,
  sales_rep TEXT,
  sales_rep_phone TEXT,
  sr_code TEXT,
  original_vehicle_plate TEXT,
  vehicle_status TEXT DEFAULT 'Хэвийн',
  vehicle_reason TEXT,
  actual_vehicle_plate TEXT,
  vehicle_changed INTEGER NOT NULL DEFAULT 0,
  route_status TEXT DEFAULT 'Гарсан',
  driver_changed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dda_date ON daily_driver_assignments(business_date);
CREATE INDEX IF NOT EXISTS idx_dda_vehicle_date ON daily_driver_assignments(vehicle_plate, business_date);
CREATE INDEX IF NOT EXISTS idx_dda_division ON daily_driver_assignments(vehicle_division);

-- 18. Driver Change Fines (Internal Penalties)
CREATE TABLE IF NOT EXISTS driver_change_fines (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  business_date TEXT NOT NULL, -- YYYY-MM-DD
  vehicle_plate TEXT NOT NULL,
  vehicle_division TEXT NOT NULL, -- 'IMT' or 'IMD'
  route_id TEXT,
  route_name TEXT,
  original_driver_id TEXT NOT NULL,
  original_driver_name TEXT NOT NULL,
  original_driver_code TEXT,
  actual_driver_id TEXT NOT NULL,
  actual_driver_name TEXT NOT NULL,
  actual_driver_code TEXT,
  fine_reason TEXT NOT NULL DEFAULT 'Жолооч солигдсон',
  fine_amount REAL NOT NULL DEFAULT 10000,
  driver_deduction REAL NOT NULL DEFAULT 10000,
  organization TEXT NOT NULL,
  fee_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dcf_date ON driver_change_fines(business_date);
CREATE INDEX IF NOT EXISTS idx_dcf_vehicle ON driver_change_fines(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_dcf_division ON driver_change_fines(vehicle_division);
CREATE INDEX IF NOT EXISTS idx_dcf_driver ON driver_change_fines(actual_driver_id);
`;
