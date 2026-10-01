-- ==============================================================================
-- CareLink Clinical AI Portal — Complete Supabase Schema & Seed Script (2026)
-- Run this in the Supabase SQL Editor for project: nxzybemsodjjsmwnedgk
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "public";

-- ==============================================================================
-- 2. CORE CLINICAL EHR TABLES
-- ==============================================================================

-- DOCTORS
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  specialty text DEFAULT 'Cardiology',
  avatar_url text,
  is_on_call boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  dob date,
  gender text,
  blood_type text,
  condition text,
  status text CHECK (status IN ('Active', 'Critical', 'Stable', 'Recovered')) DEFAULT 'Active',
  risk_score int CHECK (risk_score >= 0 AND risk_score <= 100) DEFAULT 50,
  risk_tier text CHECK (risk_tier IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  last_visit date DEFAULT CURRENT_DATE,
  notes text,
  avatar_url text,
  insurance text,
  address text,
  emergency_contact jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 30,
  type text DEFAULT 'Consultation',
  status text CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show', 'Waiting')) DEFAULT 'Scheduled',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MEDICATIONS
CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  start_date date DEFAULT CURRENT_DATE,
  refills_remaining int DEFAULT 0,
  status text CHECK (status IN ('Active', 'Archived')) DEFAULT 'Active',
  prescribed_by uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- VITALS
CREATE TABLE IF NOT EXISTS public.vitals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  recorded_at timestamptz DEFAULT now(),
  blood_pressure_sys int,
  blood_pressure_dia int,
  heart_rate int,
  temperature numeric(4,1),
  oxygen_saturation int,
  weight numeric(5,1),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ==============================================================================
-- 3. FEDERATED ML MODEL REGISTRY & READMISSION PREDICTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.model_registry (
    model_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_version VARCHAR(50) NOT NULL UNIQUE,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'XGBoost-Federated',
    federated_rounds SMALLINT NOT NULL DEFAULT 14,
    num_hospitals SMALLINT NOT NULL DEFAULT 3,
    roc_auc NUMERIC(4,3) DEFAULT 0.727,
    recall NUMERIC(4,3) DEFAULT 0.784,
    cohen_kappa NUMERIC(4,3) DEFAULT 0.540,
    decision_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.predictions (
    prediction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
    model_id INT REFERENCES public.model_registry(model_id),
    probability NUMERIC(5,4) NOT NULL CHECK (probability BETWEEN 0 AND 1),
    risk_tier VARCHAR(10) NOT NULL CHECK (risk_tier IN ('Low','Medium','High')),
    predicted_label SMALLINT NOT NULL CHECK (predicted_label IN (0,1)),
    threshold_used NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shap_values (
    shap_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prediction_id BIGINT NOT NULL REFERENCES public.predictions(prediction_id) ON DELETE CASCADE,
    feature_name VARCHAR(60) NOT NULL,
    impact NUMERIC(8,5) NOT NULL,
    abs_rank SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinician_feedback (
    feedback_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id VARCHAR(80) NOT NULL,
    patient_id VARCHAR(80),
    action VARCHAR(20) NOT NULL,
    reason TEXT,
    original_recommendation TEXT,
    clinician_id VARCHAR(80),
    clinician_specialty VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shap_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_feedback ENABLE ROW LEVEL SECURITY;

-- Allow public read & authenticated write for clinical operations
DO $$ 
BEGIN
  -- Doctors policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read doctors') THEN
    CREATE POLICY "Allow all read doctors" ON public.doctors FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow auth insert doctors') THEN
    CREATE POLICY "Allow auth insert doctors" ON public.doctors FOR INSERT WITH CHECK (true);
  END IF;

  -- Patients policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read patients') THEN
    CREATE POLICY "Allow all read patients" ON public.patients FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow auth manage patients') THEN
    CREATE POLICY "Allow auth manage patients" ON public.patients FOR ALL USING (true);
  END IF;

  -- Appointments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read appointments') THEN
    CREATE POLICY "Allow all read appointments" ON public.appointments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all manage appointments') THEN
    CREATE POLICY "Allow all manage appointments" ON public.appointments FOR ALL USING (true);
  END IF;

  -- Medications policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read medications') THEN
    CREATE POLICY "Allow all read medications" ON public.medications FOR SELECT USING (true);
  END IF;

  -- Vitals policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read vitals') THEN
    CREATE POLICY "Allow all read vitals" ON public.vitals FOR SELECT USING (true);
  END IF;

  -- ML Registry & Predictions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read model_registry') THEN
    CREATE POLICY "Allow all read model_registry" ON public.model_registry FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read predictions') THEN
    CREATE POLICY "Allow all read predictions" ON public.predictions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all read shap_values') THEN
    CREATE POLICY "Allow all read shap_values" ON public.shap_values FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all manage feedback') THEN
    CREATE POLICY "Allow all manage feedback" ON public.clinician_feedback FOR ALL USING (true);
  END IF;
END $$;

-- ==============================================================================
-- 5. INITIAL SEED DATA
-- ==============================================================================

DO $$ 
DECLARE
  v_doc_id uuid;
  v_pat1 uuid := uuid_generate_v4();
  v_pat2 uuid := uuid_generate_v4();
  v_pat3 uuid := uuid_generate_v4();
  v_pat4 uuid := uuid_generate_v4();
  v_pat5 uuid := uuid_generate_v4();
  v_pat6 uuid := uuid_generate_v4();
BEGIN
  -- Insert or fetch Doctor Profile
  INSERT INTO public.doctors (id, name, email, specialty, is_on_call)
  VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dr. Sarah Smith', 'dr.smith@carelink.com', 'Cardiology', true)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_doc_id FROM public.doctors WHERE email = 'dr.smith@carelink.com' LIMIT 1;
  IF v_doc_id IS NULL THEN
    v_doc_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  END IF;

  -- 6 Core Clinical Seed Patients
  INSERT INTO public.patients (id, doctor_id, name, email, phone, dob, gender, blood_type, condition, status, risk_score, risk_tier, insurance)
  VALUES 
    (v_pat1, v_doc_id, 'Rajesh Kumar', 'rajesh.kumar@example.com', '+919876543210', '1955-03-12', 'Male', 'O+', 'Congestive Heart Failure', 'Critical', 89, 'High', 'Ayushman Bharat PM-JAY'),
    (v_pat2, v_doc_id, 'Sunita Sharma', 'sunita.sharma@example.com', '+919876543211', '1962-07-24', 'Female', 'A+', 'Atrial Fibrillation & Osteoarthritis', 'Critical', 84, 'High', 'CGHS'),
    (v_pat3, v_doc_id, 'Kameshwar Yadav', 'kameshwar.yadav@example.com', '+919876543212', '1964-11-05', 'Male', 'B+', 'Acute Coronary Syndrome', 'Active', 78, 'High', 'Ayushman Bharat PM-JAY'),
    (v_pat4, v_doc_id, 'Anil Verma', 'anil.verma@example.com', '+919876543213', '1970-01-15', 'Male', 'O-', 'Diabetic Nephropathy (eGFR 34)', 'Active', 74, 'High', 'ECHS'),
    (v_pat5, v_doc_id, 'Meera Patel', 'meera.patel@example.com', '+919876543214', '1980-09-30', 'Female', 'AB+', 'Post-MI Care Regimen', 'Stable', 35, 'Low', 'Max Bupa'),
    (v_pat6, v_doc_id, 'Eleanor James', 'eleanor.james@example.com', '+919876543215', '1985-04-18', 'Female', 'A-', 'Hypertension Stage II', 'Stable', 22, 'Low', 'Star Health')
  ON CONFLICT DO NOTHING;

  -- Seed Appointments
  INSERT INTO public.appointments (doctor_id, patient_id, scheduled_at, duration_minutes, type, status)
  VALUES 
    (v_doc_id, v_pat1, now() + interval '2 hours', 45, 'Emergency Review', 'Confirmed'),
    (v_doc_id, v_pat2, now() + interval '4 hours', 30, 'DDI Medication Adjustment', 'Scheduled'),
    (v_doc_id, v_pat3, now() + interval '1 day', 60, 'PM-JAY Pre-Auth Consultation', 'Scheduled'),
    (v_doc_id, v_pat4, now() - interval '2 hours', 30, 'Renal Function Lab Review', 'Completed'),
    (v_doc_id, v_pat5, now() + interval '2 days', 45, 'Post-Discharge Follow-up', 'Scheduled'),
    (v_doc_id, v_pat6, now() + interval '3 days', 30, 'Vitals Telemetry Check', 'Waiting')
  ON CONFLICT DO NOTHING;

  -- Seed Active Medications
  INSERT INTO public.medications (patient_id, name, dosage, frequency, prescribed_by)
  VALUES 
    (v_pat1, 'Furosemide', '40mg', 'Once daily', v_doc_id),
    (v_pat1, 'Carvedilol', '12.5mg', 'Twice daily', v_doc_id),
    (v_pat2, 'Warfarin', '5mg', 'Once daily (evening)', v_doc_id),
    (v_pat2, 'Metoprolol', '50mg', 'Twice daily', v_doc_id),
    (v_pat3, 'Aspirin', '150mg', 'Once daily', v_doc_id),
    (v_pat3, 'Clopidogrel', '75mg', 'Once daily', v_doc_id)
  ON CONFLICT DO NOTHING;

  -- Seed Model Registry
  INSERT INTO public.model_registry (model_version, algorithm, federated_rounds, num_hospitals, roc_auc, recall, cohen_kappa, is_active)
  VALUES ('v2.4-federated-production', 'XGBoost-Federated', 14, 3, 0.727, 0.784, 0.540, true)
  ON CONFLICT (model_version) DO NOTHING;

END $$;
