CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'FAMILY' CHECK (role IN ('FAMILY','CAREGIVER','DOCTOR','ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS care_requests (
  id SERIAL PRIMARY KEY,
  patient_name VARCHAR(120) NOT NULL,
  service_type VARCHAR(80) NOT NULL,
  preferred_date DATE NOT NULL,
  address TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  family_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vital_records (
  id SERIAL PRIMARY KEY,
  patient_name VARCHAR(120) NOT NULL,
  systolic INTEGER,
  diastolic INTEGER,
  heart_rate INTEGER,
  spo2 INTEGER,
  notes TEXT DEFAULT '',
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_requests_family ON care_requests(family_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON care_requests(status);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vital_records(patient_name);
