import { ArrowUpRight } from 'lucide-react';

function DashboardCard({ title, description, icon: Icon, accentClass, actions }) {
  return (
    <section className="flex min-h-full flex-col rounded-xl border border-[#dbe5da] bg-white p-5 shadow-sm sm:p-6">
      <div className={`flex size-10 items-center justify-center rounded-lg ${accentClass}`}>
        <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-[#1f2922]">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-6 text-[#617064]">{description}</p>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
        {actions.map((action) => (
          <a
            key={action.href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2f713b] underline-offset-4 hover:text-[#1e542b] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39744a]"
            href={action.href}
          >
            {action.label}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

export default DashboardCard;
