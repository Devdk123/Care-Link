/**
 * usePatients — fetches patient list from the FastAPI backend.
 * Falls back to demo data when the backend is unreachable.
 * Replaces the old Supabase-based hook.
 */
import { useState, useEffect, useCallback } from 'react';
import { getPatients } from '../lib/api';
import type { Patient } from '../types';

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPatients();
      setPatients(data);
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return {
    patients,
    loading,
    error,
    refetchPatients: fetchPatients,
  };
}
