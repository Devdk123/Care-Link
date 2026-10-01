-- ==============================================================================
-- CareLink EHR - Complete Supabase Schema Definition
-- Run this entire script in the Supabase SQL Editor
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "moddatetime" SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "public";

-- ==========================================
-- TABLES DEFINITION
-- ==========================================

-- DOCTORS
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  specialty text,
  avatar_url text,
  is_on_call boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  dob date,
  gender text,
  blood_type text,
  condition text,
  status text CHECK (status IN ('Active', 'Critical', 'Stable', 'Recovered')),
  risk_score int CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_tier text CHECK (risk_tier IN ('Low', 'Medium', 'High')),
  last_visit date,
  notes text,
  avatar_url text,
  insurance text,
  address text,
  emergency_contact jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int DEFAULT 30,
  type text,
  status text CHECK (status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- MEDICATIONS
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  start_date date,
  refills_remaining int DEFAULT 0,
  status text CHECK (status IN ('Active', 'Archived')),
  prescribed_by uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- VITALS
CREATE TABLE public.vitals (
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

-- ==========================================
-- TRIGGERS (moddatetime)
-- ==========================================

CREATE TRIGGER handle_updated_at_patients
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_appointments
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

-- DOCTORS: Doctors can read and update their own profile.
CREATE POLICY "Doctors can view own profile" 
ON public.doctors FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Doctors can update own profile" 
ON public.doctors FOR UPDATE USING (auth.uid() = id);

-- PATIENTS: Doctors can CRUD patients assigned to them.
CREATE POLICY "Doctors can view own patients" 
ON public.patients FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can insert own patients" 
ON public.patients FOR INSERT WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update own patients" 
ON public.patients FOR UPDATE USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can delete own patients" 
ON public.patients FOR DELETE USING (doctor_id = auth.uid());

-- APPOINTMENTS: Doctors can CRUD their own appointments.
CREATE POLICY "Doctors can view own appointments" 
ON public.appointments FOR SELECT USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can insert own appointments" 
ON public.appointments FOR INSERT WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "Doctors can update own appointments" 
ON public.appointments FOR UPDATE USING (doctor_id = auth.uid());

CREATE POLICY "Doctors can delete own appointments" 
ON public.appointments FOR DELETE USING (doctor_id = auth.uid());

-- MEDICATIONS: Doctors can CRUD medications for their patients.
-- (Using subquery to check if the patient belongs to the logged-in doctor)
CREATE POLICY "Doctors can view medications for own patients" 
ON public.medications FOR SELECT 
USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "Doctors can insert medications for own patients" 
ON public.medications FOR INSERT 
WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "Doctors can update medications for own patients" 
ON public.medications FOR UPDATE 
USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "Doctors can delete medications for own patients" 
ON public.medications FOR DELETE 
USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

-- VITALS: Doctors can CRUD vitals for their patients.
CREATE POLICY "Doctors can view vitals for own patients" 
ON public.vitals FOR SELECT 
USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "Doctors can insert vitals for own patients" 
ON public.vitals FOR INSERT 
WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "Doctors can update vitals for own patients" 
ON public.vitals FOR UPDATE 
USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

CREATE POLICY "Doctors can delete vitals for own patients" 
ON public.vitals FOR DELETE 
USING (patient_id IN (SELECT id FROM public.patients WHERE doctor_id = auth.uid()));

-- ==========================================
-- VIEWS
-- ==========================================

-- View to get quick dashboard stats for the logged-in doctor.
-- Because of RLS, queries against the underlying tables will automatically be filtered.
-- However, since views run with invoker privileges by default in Supabase (if security_invoker=true is set),
-- we can set it up to securely return only the requesting doctor's stats.
CREATE OR REPLACE VIEW public.v_doctor_stats WITH (security_invoker=true) AS
SELECT 
    d.id AS doctor_id,
    (SELECT COUNT(*) FROM public.patients p WHERE p.doctor_id = d.id) AS total_patients,
    (SELECT COUNT(*) FROM public.patients p WHERE p.doctor_id = d.id AND p.status = 'Critical') AS critical_patients,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.doctor_id = d.id AND DATE(a.scheduled_at) = CURRENT_DATE AND a.status IN ('Scheduled', 'Confirmed')) AS appointments_today,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.doctor_id = d.id AND DATE(a.scheduled_at) BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND a.status IN ('Scheduled', 'Confirmed')) AS appointments_this_week,
    (SELECT ROUND(AVG(risk_score), 1) FROM public.patients p WHERE p.doctor_id = d.id AND p.risk_score IS NOT NULL) AS avg_patient_risk_score
FROM public.doctors d
WHERE d.id = auth.uid();

-- ==========================================
-- SEED DATA
-- Note: Replace '00000000-0000-0000-0000-000000000000' with your actual auth.uid() 
-- if you test this manually, or mock a doctor row if testing without auth.
-- ==========================================

-- Mock Doctor for seeding purposes (bypassing auth.users constraint momentarily or assuming an existing auth user).
-- For this seed to work in a fresh environment, uncomment the following insert if you drop the FK constraint on doctors temporarily, 
-- OR make sure you have an actual user in auth.users with this UUID.
/*
INSERT INTO auth.users (id, email) VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'dr.smith@carelink.com');
*/

DO $$ 
DECLARE
  v_doctor_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; -- Replace with an actual auth.users ID
  v_patient1 uuid := uuid_generate_v4();
  v_patient2 uuid := uuid_generate_v4();
  v_patient3 uuid := uuid_generate_v4();
  v_patient4 uuid := uuid_generate_v4();
  v_patient5 uuid := uuid_generate_v4();
  v_patient6 uuid := uuid_generate_v4();
  v_patient7 uuid := uuid_generate_v4();
  v_patient8 uuid := uuid_generate_v4();
BEGIN

  -- Insert Mock Doctor
  -- Only runs if the doctor doesn't already exist (and assuming auth.user exists)
  INSERT INTO public.doctors (id, name, email, specialty, is_on_call)
  VALUES (v_doctor_id, 'Dr. Sarah Smith', 'dr.smith@carelink.com', 'Cardiology', true)
  ON CONFLICT (id) DO NOTHING;

  -- Insert 8 Patients
  INSERT INTO public.patients (id, doctor_id, name, email, phone, dob, gender, blood_type, condition, status, risk_score, risk_tier, insurance)
  VALUES 
    (v_patient1, v_doctor_id, 'Marcus Johnson', 'mjohnson@example.com', '555-0101', '1955-03-12', 'Male', 'O+', 'Congestive Heart Failure', 'Critical', 88, 'High', 'Medicare'),
    (v_patient2, v_doctor_id, 'Emily Davis', 'emilyd@example.com', '555-0102', '1982-07-24', 'Female', 'A-', 'Hypertension', 'Active', 45, 'Medium', 'BlueCross'),
    (v_patient3, v_doctor_id, 'Robert Wilson', 'rwilson@example.com', '555-0103', '1968-11-05', 'Male', 'B+', 'Type 2 Diabetes', 'Active', 62, 'Medium', 'Aetna'),
    (v_patient4, v_doctor_id, 'Sarah Miller', 'smiller@example.com', '555-0104', '1990-01-15', 'Female', 'O-', 'Asthma', 'Stable', 20, 'Low', 'Cigna'),
    (v_patient5, v_doctor_id, 'David Brown', 'dbrown@example.com', '555-0105', '1945-09-30', 'Male', 'AB+', 'Coronary Artery Disease', 'Critical', 92, 'High', 'Medicare'),
    (v_patient6, v_doctor_id, 'Jessica Taylor', 'jtaylor@example.com', '555-0106', '1975-04-18', 'Female', 'A+', 'Chronic Migraine', 'Stable', 15, 'Low', 'UnitedHealth'),
    (v_patient7, v_doctor_id, 'Michael Anderson', 'manderson@example.com', '555-0107', '1988-12-08', 'Male', 'O+', 'Post-op Recovery', 'Recovered', 10, 'Low', 'BlueCross'),
    (v_patient8, v_doctor_id, 'Lisa Thomas', 'lthomas@example.com', '555-0108', '1962-06-22', 'Female', 'B-', 'Atrial Fibrillation', 'Active', 55, 'Medium', 'Aetna');

  -- Insert 5 Appointments (Mix of today and future)
  INSERT INTO public.appointments (doctor_id, patient_id, scheduled_at, duration_minutes, type, status)
  VALUES 
    (v_doctor_id, v_patient1, now() + interval '2 hours', 45, 'Follow-up', 'Confirmed'),
    (v_doctor_id, v_patient2, now() + interval '4 hours', 30, 'Routine Check', 'Scheduled'),
    (v_doctor_id, v_patient5, now() + interval '1 day', 60, 'Consultation', 'Scheduled'),
    (v_doctor_id, v_patient3, now() - interval '2 hours', 30, 'Lab Review', 'Completed'),
    (v_doctor_id, v_patient8, now() + interval '2 days', 45, 'Follow-up', 'Scheduled');

  -- Insert a few Vitals and Medications just for depth
  INSERT INTO public.vitals (patient_id, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation)
  VALUES 
    (v_patient1, 150, 95, 88, 98.6, 94),
    (v_patient5, 160, 100, 92, 99.1, 92);

  INSERT INTO public.medications (patient_id, name, dosage, frequency, prescribed_by)
  VALUES 
    (v_patient1, 'Lisinopril', '20mg', 'Once daily', v_doctor_id),
    (v_patient5, 'Metoprolol', '50mg', 'Twice daily', v_doctor_id);

END $$;
