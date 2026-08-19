import { useCallback, useRef, useState } from 'react';
import { ApiClientError } from '../api/apiClient';
import { guardarMonitoreoChanchitos } from '../api/chanchitosApi';
import { mapServerErrors } from '../utils/formErrors';
import {
  CHANCHITOS_STEP_FIELDS,
  createInitialValues,
  validateChanchitosForm,
  validateChanchitosStep,
} from '../utils/chanchitosValidation';

export function useChanchitosForm() {
  const [values, setValues] = useState(createInitialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalErrors, setGeneralErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [firstInvalidField, setFirstInvalidField] = useState(null);
  const submittingRef = useRef(false);

  const setFieldValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      const remaining = { ...current };
      delete remaining[name];
      return remaining;
    });
    setGeneralErrors([]);
    setSuccess(null);
  }, []);

  const setManyValues = useCallback((nextValues) => {
    setValues((current) => ({ ...current, ...nextValues }));
    setFieldErrors({});
    setGeneralErrors([]);
    setSuccess(null);
  }, []);

  const validateStep = useCallback((step) => {
    const stepErrors = validateChanchitosStep(values, step);
    const stepFields = CHANCHITOS_STEP_FIELDS[step] || [];

    setFieldErrors((current) => {
      const next = { ...current };
      stepFields.forEach((field) => delete next[field]);
      return { ...next, ...stepErrors };
    });

    if (Object.keys(stepErrors).length > 0) {
      setGeneralErrors(['Revise los campos marcados antes de continuar.']);
      setFirstInvalidField(Object.keys(stepErrors)[0]);
      return { success: false, fieldErrors: stepErrors };
    }

    setGeneralErrors([]);
    setFirstInvalidField(null);
    return { success: true, fieldErrors: {} };
  }, [values]);

  const submit = useCallback(async (images = []) => {
    if (submittingRef.current) {
      return { success: false, ignored: true };
    }

    const clientErrors = validateChanchitosForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setGeneralErrors(['Revise los campos marcados antes de guardar.']);
      setFirstInvalidField(Object.keys(clientErrors)[0]);
      return { success: false, validation: true, fieldErrors: clientErrors };
    }

    setIsSubmitting(true);
    submittingRef.current = true;
    setFieldErrors({});
    setGeneralErrors([]);
    setFirstInvalidField(null);

    try {
      const response = await guardarMonitoreoChanchitos(values, images);
      setSuccess(response.data);
      return { success: true, data: response.data };
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 400) {
        const mapped = mapServerErrors(error.payload?.errors || []);
        setFieldErrors(mapped.fieldErrors);
        setGeneralErrors(mapped.generalErrors.length > 0 ? mapped.generalErrors : ['Revise los campos marcados antes de guardar.']);
        setFirstInvalidField(Object.keys(mapped.fieldErrors)[0] || null);
        return { success: false, validation: true, fieldErrors: mapped.fieldErrors };
      }

      throw error;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [values]);

  const reset = useCallback(({ preserveSuccess = false } = {}) => {
    setValues(createInitialValues());
    setFieldErrors({});
    setGeneralErrors([]);
    if (!preserveSuccess) setSuccess(null);
    setFirstInvalidField(null);
  }, []);

  return {
    values,
    fieldErrors,
    generalErrors,
    isSubmitting,
    success,
    firstInvalidField,
    setFieldValue,
    setManyValues,
    validateStep,
    submit,
    reset,
  };
}
