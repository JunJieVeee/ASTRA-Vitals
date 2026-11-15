import { useEffect, useState } from 'react'
import { Check, ChevronRight, ClipboardCheck, Info, ShieldAlert, Stethoscope, X } from 'lucide-react'
import { HAZARD_LABELS } from '../data'
import { formatValue, getActionProtocol, getMetricMeta } from '../engine'
import type {
  AstronautProfile,
  GuidanceTab,
  HealthMetricKey,
  HealthValues,
  MetricEvaluation,
  MissionEnvironment,
  Scenario,
} from '../types'
import { StatusPill } from './StatusPill'

interface GuidanceDrawerProps {
  metricKey: HealthMetricKey | null
  evaluation: MetricEvaluation | null
  values: HealthValues
  profile: AstronautProfile
  environment: MissionEnvironment
  scenario: Scenario | null
  actionChecks: Record<string, boolean>
  onToggleAction: (metric: HealthMetricKey, actionId: string, action: string) => void
  onClose: () => void
  initialTab?: GuidanceTab
}

const tabs: { id: GuidanceTab; label: string; icon: typeof ClipboardCheck }[] = [
  { id: 'measure', label: 'How to Measure', icon: ClipboardCheck },
  { id: 'why', label: 'Why It Matters', icon: Info },
  { id: 'action', label: 'Action Protocol', icon: ShieldAlert },
]

export function GuidanceDrawer({
  metricKey,
  evaluation,
  values,
  profile,
  environment,
  scenario,
  actionChecks,
  onToggleAction,
  onClose,
  initialTab = 'measure',
}: GuidanceDrawerProps) {
  const [activeTab, setActiveTab] = useState<GuidanceTab>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [metricKey, initialTab])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!metricKey || !evaluation) return null

  const metric = getMetricMeta(metricKey)
  const isActiveScenario = scenario?.focusMetric === metricKey ? scenario : null
  const protocol = getActionProtocol(metricKey, evaluation, isActiveScenario)

  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-backdrop" aria-label="Close guidance" onClick={onClose} />
      <aside className="guidance-drawer" role="dialog" aria-modal="true" aria-labelledby="guidance-title">
        <div className="drawer-header">
          <div>
            <div className="eyebrow">Autonomous triage guidance</div>
            <h2 id="guidance-title">{metric.label}</h2>
            <p>{formatValue(metricKey, values)} · {environment.shortName} protocol</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close guidance drawer">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-status-row">
          <StatusPill status={evaluation.status} />
          <span>{evaluation.message}</span>
        </div>

        {isActiveScenario && (
          <div className="scenario-callout">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <strong>Demo scenario active</strong>
              <p>{isActiveScenario.title}. This sample workflow has been injected into the local device only.</p>
            </div>
          </div>
        )}

        <div className="guidance-tabs" role="tablist" aria-label="Guidance sections">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                className={activeTab === tab.id ? 'guidance-tab guidance-tab--active' : 'guidance-tab'}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="drawer-content">
          {activeTab === 'measure' && (
            <section className="guidance-section" aria-labelledby="measure-heading">
              <div className="section-heading-row">
                <Stethoscope size={19} aria-hidden="true" />
                <div>
                  <h3 id="measure-heading">Plain-language measurement steps</h3>
                  <p>Take or verify this reading using the mission-approved equipment.</p>
                </div>
              </div>
              <ol className="guided-list">
                {metric.howToMeasure.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="baseline-note">
                <strong>Personal comparison:</strong> {profile.name.split(' ')[0]}'s usual band is {evaluation.band.baselineLow}–{evaluation.band.baselineHigh} {metric.unit || 'protocol units'}.
              </div>
            </section>
          )}

          {activeTab === 'why' && (
            <section className="guidance-section" aria-labelledby="why-heading">
              <div className="section-heading-row">
                <Info size={19} aria-hidden="true" />
                <div>
                  <h3 id="why-heading">Mission relevance</h3>
                  <p>Why this signal is useful during spaceflight operations.</p>
                </div>
              </div>
              <p className="guidance-copy">{metric.whyItMatters}</p>
              <div className="hazard-connection">
                <span>RIDGE hazards connected to this indicator</span>
                <div className="hazard-chip-row">
                  {metric.hazards.map((hazard) => (
                    <span className="hazard-chip" key={hazard}>{HAZARD_LABELS[hazard]}</span>
                  ))}
                </div>
              </div>
              <div className="threshold-note">
                <strong>Active advisory band:</strong> {evaluation.band.nominalLow}–{evaluation.band.nominalHigh} {metric.unit || 'protocol units'}. The current environment changes the operational band for air, sleep, exercise, and radiation indicators.
              </div>
            </section>
          )}

          {activeTab === 'action' && (
            <section className="guidance-section" aria-labelledby="action-heading">
              <div className="protocol-header">
                <div>
                  <span className={`protocol-mode protocol-mode--${protocol.mode === 'CREW SELF-CARE' ? 'self' : 'escalate'}`}>
                    {protocol.mode}
                  </span>
                  <h3 id="action-heading">{protocol.title}</h3>
                  <p>{protocol.summary}</p>
                </div>
                <span className={`urgency-badge urgency-badge--${protocol.urgency.toLowerCase().replaceAll(' ', '-')}`}>{protocol.urgency}</span>
              </div>
              <div className="action-checklist">
                {protocol.steps.map((action, index) => {
                  const actionId = `${metricKey}-${scenario?.id ?? evaluation.status}-${index}`
                  const checked = Boolean(actionChecks[actionId])
                  return (
                    <button
                      type="button"
                      className={checked ? 'action-step action-step--checked' : 'action-step'}
                      key={actionId}
                      aria-pressed={checked}
                      onClick={() => onToggleAction(metricKey, actionId, action)}
                    >
                      <span className="action-check" aria-hidden="true">{checked && <Check size={15} strokeWidth={3} />}</span>
                      <span>{action}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
              <div className="protocol-footer-note">
                Each completed step is added to the local asynchronous ground-sync outbox. Priority medical escalation follows the mission’s approved procedures.
              </div>
            </section>
          )}
        </div>

        <div className="drawer-disclaimer">
          <ShieldAlert size={15} aria-hidden="true" />
          Prototype decision support only. It does not diagnose, prescribe, or replace the approved mission medical protocol or flight surgeon.
        </div>
      </aside>
    </div>
  )
}
