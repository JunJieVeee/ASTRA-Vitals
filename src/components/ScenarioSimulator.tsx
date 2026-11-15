import type { Dispatch, SetStateAction } from 'react'
import { Activity, AlertTriangle, ChevronRight, RotateCcw, Send, ShieldAlert } from 'lucide-react'
import { SCENARIOS } from '../data'
import { createPacket, formatValue, getMetricMeta } from '../engine'
import type { AppState, AstronautProfile, MissionEnvironment, NumericMetricKey, Scenario } from '../types'

export interface ScenarioSimulatorProps {
  astronaut: AstronautProfile
  environment: MissionEnvironment
  state: AppState
  onScenarioChange: (scenarioId: Scenario['id']) => void
  onStateChange: Dispatch<SetStateAction<AppState>>
  onOpenActionProtocol: (metricKey: NumericMetricKey) => void
  onResetDemo: () => void
}

const severityStyles = {
  nominal: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  watch: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  critical: 'border-red-400/35 bg-red-400/10 text-red-100',
}

function ScenarioIcon({ severity }: Pick<Scenario, 'severity'>) {
  const Icon = severity === 'critical' ? ShieldAlert : Activity
  return <Icon className="h-4 w-4" aria-hidden="true" />
}

export function ScenarioSimulator({
  astronaut,
  environment,
  state,
  onScenarioChange,
  onStateChange,
  onOpenActionProtocol,
  onResetDemo,
}: ScenarioSimulatorProps) {
  const activeValues = state.valuesByProfile[astronaut.id] ?? astronaut.baselines

  const applyScenario = (scenario: Scenario) => {
    const simulatedValues = { ...activeValues, ...scenario.impact }
    const metric = getMetricMeta(scenario.focusMetric)
    const priorityPacket = createPacket(
      'alert',
      scenario.severity,
      `Priority telemetry: ${scenario.shortTitle}`,
      `${scenario.title} demo applied for ${astronaut.name}. Primary signal: ${metric.label} ${formatValue(scenario.focusMetric, simulatedValues)}. Onboard action protocol requested.`,
      astronaut,
      environment,
    )

    onStateChange((currentState) => {
      const currentValues = currentState.valuesByProfile[astronaut.id] ?? astronaut.baselines
      return {
        ...currentState,
        valuesByProfile: {
          ...currentState.valuesByProfile,
          [astronaut.id]: { ...currentValues, ...scenario.impact },
        },
        outbox: [priorityPacket, ...currentState.outbox],
      }
    })
    onScenarioChange(scenario.id)
    onOpenActionProtocol(scenario.focusMetric)
  }

  return (
    <section
      className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/30"
      aria-labelledby="scenario-simulator-title"
    >
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Judge-demo emergency scenarios
          </div>
          <h2 id="scenario-simulator-title" className="mt-2 text-lg font-semibold text-slate-100">
            Scenario simulator
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Apply a local telemetry injection for {astronaut.name} and open its onboard action protocol.
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          type="button"
          onClick={onResetDemo}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset demo
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {SCENARIOS.map((scenario) => {
          const metric = getMetricMeta(scenario.focusMetric)
          const currentValue = formatValue(scenario.focusMetric, activeValues)
          const simulatedValue = formatValue(scenario.focusMetric, { ...activeValues, ...scenario.impact })

          return (
            <article
              key={scenario.id}
              className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 transition hover:border-slate-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 rounded-lg border border-slate-700 bg-slate-950 p-2 text-emerald-300">
                    <ScenarioIcon severity={scenario.severity} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{scenario.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-400">{scenario.description}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold capitalize ${severityStyles[scenario.severity]}`}>
                  {scenario.severity}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs">
                <div>
                  <span className="block uppercase tracking-wide text-slate-500">Primary metric</span>
                  <strong className="mt-1 block text-sm text-slate-200">{metric.shortLabel}</strong>
                </div>
                <div>
                  <span className="block uppercase tracking-wide text-slate-500">Telemetry change</span>
                  <strong className="mt-1 block text-sm text-amber-200">
                    {currentValue} <span className="text-slate-500">→</span> {simulatedValue}
                  </strong>
                </div>
              </div>

              <button
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                type="button"
                onClick={() => applyScenario(scenario)}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Apply scenario & open protocol
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </article>
          )
        })}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Scenario data stays in the local prototype. Each injection creates a priority packet for the simulated ground-sync outbox.
      </p>
    </section>
  )
}
