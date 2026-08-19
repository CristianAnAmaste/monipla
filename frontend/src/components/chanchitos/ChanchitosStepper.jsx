import { Check } from 'lucide-react';
import { CHANCHITOS_WIZARD_STEPS } from '../../hooks/useChanchitosWizard';

function ChanchitosStepper({ currentStep, completedSteps, onStepChange }) {
  const current = CHANCHITOS_WIZARD_STEPS.find((step) => step.id === currentStep);

  return (
    <>
      <nav className="mb-4 sm:hidden" aria-label="Etapas del formulario">
        <p className="text-sm font-semibold text-[#4e7f55]">Paso {currentStep} de {CHANCHITOS_WIZARD_STEPS.length} · {current.title}</p>
        <ol className="mt-2 grid grid-cols-5 gap-1">
          {CHANCHITOS_WIZARD_STEPS.map((step) => {
            const isCurrent = step.id === currentStep;
            const isCompleted = completedSteps.includes(step.id);
            return <li key={step.id}><button type="button" disabled={!isCurrent && !isCompleted} onClick={() => onStepChange(step.id)} aria-current={isCurrent ? 'step' : undefined} aria-label={`Etapa ${step.id}: ${step.title}`} className={`flex size-9 w-full items-center justify-center rounded-full text-xs font-semibold ${isCompleted || isCurrent ? 'bg-[#2f713b] text-white' : 'bg-[#e5ece3] text-[#56685a]'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a] disabled:opacity-60`}>{isCompleted ? <Check className="size-4" aria-hidden="true" /> : step.id}</button></li>;
          })}
        </ol>
      </nav>
      <nav className="hidden rounded-xl border border-[#dbe5da] bg-white p-3 shadow-sm sm:block" aria-label="Etapas del formulario">
        <ol className="grid grid-cols-5 gap-2 lg:grid-cols-1">
          {CHANCHITOS_WIZARD_STEPS.map((step) => {
            const isCurrent = step.id === currentStep;
            const isCompleted = completedSteps.includes(step.id);
            const canNavigate = isCurrent || isCompleted;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => onStepChange(step.id)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${isCurrent ? 'bg-[#eaf4e8] text-[#245c2f]' : isCompleted ? 'text-[#35563b] hover:bg-[#f2f7f0]' : 'cursor-not-allowed text-[#94a195]'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a] disabled:opacity-70`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${isCompleted ? 'bg-[#2f713b] text-white' : isCurrent ? 'bg-[#39744a] text-white' : 'bg-[#e5ece3] text-[#56685a]'}`}>
                    {isCompleted ? <Check className="size-4" aria-hidden="true" /> : step.id}
                  </span>
                  <span className="text-xs leading-4 lg:text-sm">{step.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

export default ChanchitosStepper;
