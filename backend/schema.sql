-- =====================================================================
--  HOSPITAL X — READMISSION INTELLIGENCE  (MIMIC-IV schema)
-- =====================================================================

DROP VIEW  IF EXISTS v_patient_latest_risk CASCADE;
DROP TABLE IF EXISTS audit_log          CASCADE;
DROP TABLE IF EXISTS clinician_feedback CASCADE;
DROP TABLE IF EXISTS shap_values        CASCADE;
DROP TABLE IF EXISTS predictions        CASCADE;
DROP TABLE IF EXISTS patients           CASCADE;
DROP TABLE IF EXISTS model_registry     CASCADE;


-- 1. MODEL REGISTRY
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
CREATE UNIQUE INDEX uq_one_active_model
    ON model_registry (is_active) WHERE is_active = TRUE;


-- 2. PATIENTS  (MIMIC-IV columns)
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
COMMENT ON TABLE patients IS
    'Hospital X roster (synthetic MIMIC-shaped patients). features JSONB = model input.';


-- 3. PREDICTIONS
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


-- 4. SHAP_VALUES
CREATE TABLE shap_values (
    shap_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prediction_id  BIGINT   NOT NULL REFERENCES predictions(prediction_id) ON DELETE CASCADE,
    feature_name   VARCHAR(60) NOT NULL,
    impact         NUMERIC(8,5) NOT NULL,
    abs_rank       SMALLINT     NOT NULL
);
CREATE INDEX idx_shap_prediction ON shap_values (prediction_id);


-- 5. CLINICIAN_FEEDBACK
CREATE TABLE clinician_feedback (
    feedback_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prediction_id   BIGINT   NOT NULL REFERENCES predictions(prediction_id),
    clinician_ref   VARCHAR(40),
    action          VARCHAR(20) NOT NULL CHECK (action IN ('confirmed','overridden')),
    corrected_label SMALLINT    CHECK (corrected_label IN (0,1)),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_prediction ON clinician_feedback (prediction_id);


-- 6. AUDIT_LOG  (append-only)
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


-- 7. DASHBOARD VIEW
CREATE VIEW v_patient_latest_risk AS
SELECT DISTINCT ON (p.patient_id)
       p.patient_id, p.external_ref, p.age, p.gender,
       p.admission_type, p.discharge_location,
       pr.probability, pr.risk_tier, pr.predicted_label, pr.predicted_at
FROM   patients p
LEFT   JOIN predictions pr ON pr.patient_id = p.patient_id
ORDER  BY p.patient_id, pr.predicted_at DESC;

-- 8. To store model weights
CREATE TABLE model_store (
    model_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    model_blob      BYTEA NOT NULL,            -- the trained model bytes
    threshold       NUMERIC(4,3) NOT NULL,
    feature_columns JSONB NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);