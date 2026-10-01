-- =====================================================================
-- CARELINK (formerly Sammy) — SUPABASE SCHEMA & RLS
-- =====================================================================

-- Clean up existing tables
DROP VIEW  IF EXISTS v_patient_latest_risk CASCADE;
DROP TABLE IF EXISTS audit_log          CASCADE;
DROP TABLE IF EXISTS clinician_feedback CASCADE;
DROP TABLE IF EXISTS shap_values        CASCADE;
DROP TABLE IF EXISTS predictions        CASCADE;
DROP TABLE IF EXISTS patients           CASCADE;
DROP TABLE IF EXISTS model_registry     CASCADE;
DROP TABLE IF EXISTS model_store        CASCADE;

-- ==========================================
-- 1. MODEL REGISTRY
-- ==========================================
CREATE TABLE model_registry (
    model_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_version     VARCHAR(50)  NOT NULL UNIQUE,
    algorithm         VARCHAR(50)  NOT NULL DEFAULT 'XGBoost-Federated',
    federated_rounds  SMALLINT     NOT NULL,
    num_hospitals     SMALLINT     NOT NULL,
    roc_auc           NUMERIC(4,3),
    recall            NUMERIC(4,3),
    cohen_kappa       NUMERIC(4,3),
    decision_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    trained_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    is_active         BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX uq_one_active_model ON model_registry (is_active) WHERE is_active = TRUE;

ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated clinicians can read model_registry"
ON model_registry FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- 2. PATIENTS
-- ==========================================
CREATE TABLE patients (
    patient_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    external_ref        VARCHAR(40)  NOT NULL UNIQUE,
    age                 SMALLINT,
    gender              VARCHAR(10),
    admission_type      VARCHAR(40),
    discharge_location  VARCHAR(60),
    insurance           VARCHAR(30),
    length_of_stay      NUMERIC(6,2),
    prior_admissions    SMALLINT,
    num_diagnoses       SMALLINT,
    features            JSONB        NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated clinicians can read patients"
ON patients FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- 3. PREDICTIONS
-- ==========================================
CREATE TABLE predictions (
    prediction_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    patient_id      INT      NOT NULL REFERENCES patients(patient_id),
    model_id        INT      NOT NULL REFERENCES model_registry(model_id),
    probability     NUMERIC(5,4) NOT NULL CHECK (probability BETWEEN 0 AND 1),
    risk_tier       VARCHAR(10)  NOT NULL CHECK (risk_tier IN ('Low','Medium','High')),
    predicted_label SMALLINT     NOT NULL CHECK (predicted_label IN (0,1)),
    threshold_used  NUMERIC(4,3) NOT NULL,
    predicted_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_pred_patient   ON predictions (patient_id);
CREATE INDEX idx_pred_risk_tier ON predictions (risk_tier);
CREATE INDEX idx_pred_time      ON predictions (predicted_at DESC);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated clinicians can read predictions"
ON predictions FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- 4. SHAP_VALUES
-- ==========================================
CREATE TABLE shap_values (
    shap_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prediction_id  BIGINT   NOT NULL REFERENCES predictions(prediction_id) ON DELETE CASCADE,
    feature_name   VARCHAR(60) NOT NULL,
    impact         NUMERIC(8,5) NOT NULL,
    abs_rank       SMALLINT     NOT NULL
);
CREATE INDEX idx_shap_prediction ON shap_values (prediction_id);

ALTER TABLE shap_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated clinicians can read shap_values"
ON shap_values FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- 5. CLINICIAN_FEEDBACK
-- ==========================================
CREATE TABLE clinician_feedback (
    feedback_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prediction_id   BIGINT   NOT NULL REFERENCES predictions(prediction_id),
    user_id         UUID     NOT NULL REFERENCES auth.users(id), -- Linked to Supabase Auth
    action          VARCHAR(20) NOT NULL CHECK (action IN ('confirmed','overridden')),
    corrected_label SMALLINT    CHECK (corrected_label IN (0,1)),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_prediction ON clinician_feedback (prediction_id);

ALTER TABLE clinician_feedback ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone authenticated can see the feedback (or you could restrict this to the owner)
CREATE POLICY "Authenticated clinicians can read feedback"
ON clinician_feedback FOR SELECT USING (auth.role() = 'authenticated');

-- Insert policy: Clinicians can only insert feedback tied to their own auth user ID
CREATE POLICY "Clinicians can insert own feedback"
ON clinician_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policy: Clinicians can only update their own feedback
CREATE POLICY "Clinicians can update own feedback"
ON clinician_feedback FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 6. AUDIT_LOG
-- ==========================================
CREATE TABLE audit_log (
    audit_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type  VARCHAR(40) NOT NULL,
    entity_type VARCHAR(40),
    entity_id   BIGINT,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time  ON audit_log (created_at DESC);
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No standard user can insert into audit_log; only the Service Role (bypassing RLS) can write.
-- Authenticated users can read it (if required for the dashboard).
CREATE POLICY "Authenticated clinicians can read audit_log"
ON audit_log FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- 7. MODEL STORE
-- ==========================================
CREATE TABLE model_store (
    model_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_blob      BYTEA NOT NULL,
    threshold       NUMERIC(4,3) NOT NULL,
    feature_columns JSONB NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE model_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated clinicians can read model_store"
ON model_store FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- 8. DASHBOARD VIEW
-- ==========================================
CREATE VIEW v_patient_latest_risk AS
SELECT DISTINCT ON (p.patient_id)
       p.patient_id, p.external_ref, p.age, p.gender,
       p.admission_type, p.discharge_location,
       pr.probability, pr.risk_tier, pr.predicted_label, pr.predicted_at
FROM   patients p
LEFT   JOIN predictions pr ON pr.patient_id = p.patient_id
ORDER  BY p.patient_id, pr.predicted_at DESC;

-- *Note on Service Role*: Your backend processes (e.g. FastAPI / EC2 nodes) should use the Supabase Service Role key 
-- to connect. The Service Role inherently bypasses RLS, meaning your backend scripts will not be blocked 
-- from writing new predictions, patients, or audit logs.
