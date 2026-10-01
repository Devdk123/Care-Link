/**
 * usePrediction — fetches ML readmission risk prediction for a single patient.
 * Calls GET /predict/{patient_id} on the FastAPI backend.
 * Falls back to demo prediction when backend is unreachable.
 */
import { useState, useEffect, useCallback } from 'react';
import { getPrediction, sendFeedback } from '../lib/api';
import type { Prediction, FeedbackPayload } from '../types';

export function usePrediction(patientId: number | null | undefined) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    if (patientId == null) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getPrediction(patientId);
      setPrediction(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch prediction.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  const submitFeedback = async (
    action: 'confirmed' | 'overridden',
    note?: string
  ): Promise<boolean> => {
    if (!prediction) return false;

    const payload: FeedbackPayload = {
      prediction_id: prediction.prediction_id,
      action,
      note,
    };

    return await sendFeedback(payload);
  };

  return {
    prediction,
    loading,
    error,
    refresh: fetchPrediction,
    submitFeedback,
  };
}
