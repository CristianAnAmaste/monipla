import { useCallback, useRef, useState } from 'react';

export const CHANCHITOS_WIZARD_STEPS = [
  { id: 1, title: 'Origen' },
  { id: 2, title: 'Datos' },
  { id: 3, title: 'Posiciones' },
  { id: 4, title: 'Evidencias' },
  { id: 5, title: 'Revisión' },
];

export function useChanchitosWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const currentStepRef = useRef(1);

  const goNext = useCallback((expectedStep) => {
    if (currentStepRef.current !== expectedStep) return;
    const nextStep = Math.min(expectedStep + 1, CHANCHITOS_WIZARD_STEPS.length);
    currentStepRef.current = nextStep;
    setCompletedSteps((current) => current.includes(expectedStep) ? current : [...current, expectedStep]);
    setCurrentStep(nextStep);
  }, []);

  const goBack = useCallback(() => {
    const previousStep = Math.max(currentStepRef.current - 1, 1);
    currentStepRef.current = previousStep;
    setCurrentStep(previousStep);
  }, []);

  const goToCompletedStep = useCallback((step) => {
    if (step === currentStepRef.current || completedSteps.includes(step)) {
      currentStepRef.current = step;
      setCurrentStep(step);
    }
  }, [completedSteps]);

  const reset = useCallback(() => {
    currentStepRef.current = 1;
    setCurrentStep(1);
    setCompletedSteps([]);
  }, []);

  return { currentStep, completedSteps, goNext, goBack, goToCompletedStep, reset };
}
