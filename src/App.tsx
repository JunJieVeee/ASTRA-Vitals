import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BellRing,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Cloud,
  Dumbbell,
  FileClock,
  Gauge,
  HeartPulse,
  Moon,
  Orbit,
  Radio,
  Radiation,
  RefreshCcw,
  Rocket,
  ScanLine,
  ShieldAlert,
  Signal,
  Thermometer,
  UserRound,
  Wifi,
  WifiOff,
  Wind,
} from 'lucide-react'
import { DEMO_SCAN_IMAGE, ENVIRONMENTS, METRICS, PROFILES, SCAN_CHECKS, SCENARIOS } from './data'
import {
  STORAGE_KEY,
  actionKey,
  createDemoState,
  createPacket,
  emptyScan,
  evaluateMetric,
  formatDateTime,
  formatValue,
  getActionProtocol,
  getEvaluations,
  getMetricMeta,
  hydrateState,
  isAbnormal,
  recordToday,
  taskKey,
} from './engine'
import { GroundSyncOutbox } from './components/GroundSyncOutbox'
import { GuidanceDrawer } from './components/GuidanceDrawer'
import { NasaScienceModal } from './components/NasaScienceModal'
import { ReadinessPanel } from './components/ReadinessPanel'
import { ScanPanel } from './components/ScanPanel'
import { ScenarioSimulator } from './components/ScenarioSimulator'
import { StatusPill, statusLabel } from './components/StatusPill'
import { TrendChart } from './components/TrendChart'
import type {
  AppState,
  GuidanceTab,
  HealthMetricKey,
  HealthValues,
  MetricEvaluation,
  MetricMeta,
  NumericMetricKey,
  ScanModality,
  Scenario,
  Status,
} from './types'

type DrawerSelection = { key: HealthMetricKey; tab: GuidanceTab }
type Toast = { message: string; warning?: boolean }

const metricIcons: Record<HealthMetricKey, LucideIcon> = {
  heartRate: HeartPulse,
  bloodPressure: Gauge,
  bloodGlucose: Activity,
  temperature: Thermometer,
  spo2: Wind,
  radiation: Radiation,
  co2: Cloud,
  sleep: Moon,
  exercise: Dumbbell,
  mood: CircleAlert,
  stress: Signal,
  cognitive: Brain,
  scan: ScanLine,
}

const numericMetrics = METRICS.filter((metric) => metric.inputKind === 'number')
const scaleMetrics = METRICS.filter((metric) => metric.inputKind === 'scale')

function loadInitialState(): AppState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return createDemoState()
    return hydrateState(JSON.parse(saved)) ?? createDemoState()
  } catch {
    return createDemoState()
  }
}

function MetricCard({
  metric,
  evaluation,
  values,
  onOpen,
}: {
  metric: MetricMeta
  evaluation: MetricEvaluation
  values: HealthValues
  onOpen: (key: HealthMetricKey, tab?: GuidanceTab) => void
}) {
  const Icon = metricIcons[metric.key]
  const detail = evaluation.status === 'nominal' ? 'Tap for guidance' : evaluation.message

  return (
    <button
      type="button"
      className={`metric-card metric-card--${evaluation.status}`}
      onClick={() => onOpen(metric.key)}
      aria-label={`Open guidance for ${metric.label}. Current status: ${statusLabel(evaluation.status)}.`}
    >
      <div className="metric-card-topline">
        <span className="metric-icon"><Icon size={18} strokeWidth={2.1} aria-hidden="true" /></span>
        <StatusPill status={evaluation.status} compact />
      </div>
      <div className="metric-card-value">{formatValue(metric.key, values)}</div>
      <div className="metric-card-label">{metric.shortLabel}</div>
      <div className="metric-card-footer">
        <span>{detail}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </div>
    </button>
  )
}

function NumericMetricInput({
  metric,
  values,
  evaluation,
  onValueChange,
  onOpen,
}: {
  metric: MetricMeta
  values: HealthValues
  evaluation: MetricEvaluation
  onValueChange: (key: keyof HealthValues, value: number) => void
  onOpen: (key: HealthMetricKey, tab?: GuidanceTab) => void
}) {
  const Icon = metricIcons[metric.key]
  const onInputChange = (key: keyof HealthValues) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.currentTarget.valueAsNumber
    if (Number.isFinite(nextValue)) onValueChange(key, nextValue)
  }

  return (
    <article className="input-metric">
      <div className="input-metric-header">
        <span className="metric-icon metric-icon--small"><Icon size={15} aria-hidden="true" /></span>
        <div>
          <label htmlFor={`input-${metric.key}`}>{metric.label}</label>
          <span>{metric.unit}</span>
        </div>
        <button type="button" className="mini-guidance-button" onClick={() => onOpen(metric.key)} aria-label={`Open guidance for ${metric.label}`}>
          <CircleAlert size={14} aria-hidden="true" />
        </button>
      </div>

      {metric.key === 'bloodPressure' ? (
        <div className="bp-inputs">
          <input
            id="input-bloodPressure"
            className={`metric-input metric-input--${evaluation.status}`}
            type="number"
            inputMode="decimal"
            value={values.bloodPressure}
            onChange={onInputChange('bloodPressure')}
            aria-label="Systolic blood pressure"
          />
          <span aria-hidden="true">/</span>
          <input
            className={`metric-input metric-input--${evaluation.status}`}
            type="number"
            inputMode="decimal"
            value={values.bloodPressureDiastolic}
            onChange={onInputChange('bloodPressureDiastolic')}
            aria-label="Diastolic blood pressure"
          />
        </div>
      ) : (
        <input
          id={`input-${metric.key}`}
          className={`metric-input metric-input--${evaluation.status}`}
          type="number"
          inputMode="decimal"
          step={metric.precision > 0 ? (metric.key === 'radiation' ? '0.01' : '0.1') : '1'}
          value={values[metric.key as keyof HealthValues]}
          onChange={onInputChange(metric.key as keyof HealthValues)}
        />
      )}

      <div className="input-metric-status">
        <StatusPill status={evaluation.status} compact />
        <span>{evaluation.message}</span>
      </div>
    </article>
  )
}

function ScaleMetricInput({
  metric,
  values,
  evaluation,
  onValueChange,
  onOpen,
}: {
  metric: MetricMeta
  values: HealthValues
  evaluation: MetricEvaluation
  onValueChange: (key: keyof HealthValues, value: number) => void
  onOpen: (key: HealthMetricKey, tab?: GuidanceTab) => void
}) {
  const Icon = metricIcons[metric.key]
  const value = values[metric.key as keyof HealthValues]

  return (
    <article className="scale-input-card">
      <div className="input-metric-header">
        <span className="metric-icon metric-icon--small"><Icon size={15} aria-hidden="true" /></span>
        <div>
          <span className="input-label">{metric.label}</span>
          <span>{metric.scaleLabels?.[0]} → {metric.scaleLabels?.[1]}</span>
        </div>
        <button type="button" className="mini-guidance-button" onClick={() => onOpen(metric.key)} aria-label={`Open guidance for ${metric.label}`}>
          <CircleAlert size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="scale-picker" role="group" aria-label={`${metric.label} score from 1 to 5`}>
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            type="button"
            key={option}
            className={option === value ? `scale-button scale-button--selected scale-button--${evaluation.status}` : 'scale-button'}
            aria-label={`${metric.label}, ${option} out of 5`}
            aria-pressed={option === value}
            onClick={() => onValueChange(metric.key as keyof HealthValues, option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="input-metric-status">
        <StatusPill status={evaluation.status} compact />
        <span>{evaluation.message}</span>
      </div>
    </article>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState)
  const [drawerSelection, setDrawerSelection] = useState<DrawerSelection | null>(null)
  const [trendMetric, setTrendMetric] = useState<NumericMetricKey>('heartRate')
  const [isScienceModalOpen, setIsScienceModalOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  const profile = PROFILES.find((item) => item.id === state.activeProfileId) ?? PROFILES[0]
  const environment = ENVIRONMENTS.find((item) => item.id === state.activeEnvironmentId) ?? ENVIRONMENTS[0]
  const values = state.valuesByProfile[profile.id] ?? profile.baselines
  const history = state.historyByProfile[profile.id] ?? []
  const scan = state.scansByProfile[profile.id] ?? emptyScan()

  const evaluations = useMemo(() => getEvaluations(values, profile, environment), [values, profile, environment])
  const scanEvaluation = useMemo(() => evaluateMetric('scan', values, profile, environment), [values, profile, environment])
  const evaluationsByKey = useMemo(
    () => new Map<HealthMetricKey, MetricEvaluation>([...evaluations, scanEvaluation].map((entry) => [entry.key, entry])),
    [evaluations, scanEvaluation],
  )
  const selectedEvaluation = drawerSelection ? evaluationsByKey.get(drawerSelection.key) ?? null : null
  const abnormalEvaluations = evaluations.filter((evaluation) => isAbnormal(evaluation.status))
  const criticalCount = evaluations.filter((evaluation) => evaluation.status === 'critical').length
  const activeScenario = state.activeScenarioId
    ? SCENARIOS.find((scenario) => scenario.id === state.activeScenarioId) ?? null
    : null
  const drawerScenario = drawerSelection && activeScenario?.focusMetric === drawerSelection.key ? activeScenario : null

  const drawerActionChecks = useMemo(() => {
    if (!drawerSelection || !selectedEvaluation) return {}
    const protocol = getActionProtocol(drawerSelection.key, selectedEvaluation, drawerScenario)
    return Object.fromEntries(
      protocol.steps.map((_, index) => {
        const actionId = `${drawerSelection.key}-${drawerScenario?.id ?? selectedEvaluation.status}-${index}`
        const storedKey = actionKey(profile.id, environment.id, drawerSelection.key, actionId)
        return [actionId, Boolean(state.actionChecks[storedKey])]
      }),
    )
  }, [drawerScenario, drawerSelection, environment.id, profile.id, selectedEvaluation, state.actionChecks])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      setToast({ message: 'Local storage is full. Remove a large uploaded scan or reset demo data.', warning: true })
    }
  }, [state])

  useEffect(() => {
    const updateNetworkState = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateNetworkState)
    window.addEventListener('offline', updateNetworkState)
    return () => {
      window.removeEventListener('online', updateNetworkState)
      window.removeEventListener('offline', updateNetworkState)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const openGuidance = (key: HealthMetricKey, tab: GuidanceTab = 'measure') => setDrawerSelection({ key, tab })
  const evaluationFor = (key: HealthMetricKey) => evaluationsByKey.get(key) ?? scanEvaluation

  const handleValueChange = (key: keyof HealthValues, value: number) => {
    setState((previous) => ({
      ...previous,
      valuesByProfile: {
        ...previous.valuesByProfile,
        [profile.id]: { ...(previous.valuesByProfile[profile.id] ?? profile.baselines), [key]: value },
      },
    }))
  }

  const handleProfileChange = (profileId: string) => {
    setState((previous) => ({ ...previous, activeProfileId: profileId, activeScenarioId: null }))
    setDrawerSelection(null)
    setToast({ message: 'Active astronaut profile changed. Personal baseline bands are now updated.' })
  }

  const handleEnvironmentChange = (environmentId: string) => {
    setState((previous) => ({ ...previous, activeEnvironmentId: environmentId, activeScenarioId: null }))
    setDrawerSelection(null)
    setToast({ message: 'Mission environment changed. Advisory thresholds and scheduled cadence are now updated.' })
  }

  const handleToggleTask = (taskId: string) => {
    const key = taskKey(profile.id, environment.id, taskId)
    setState((previous) => ({
      ...previous,
      taskChecks: { ...previous.taskChecks, [key]: !previous.taskChecks[key] },
    }))
  }

  const handleScenarioChange = (scenarioId: Scenario['id']) => {
    const scenario = SCENARIOS.find((entry) => entry.id === scenarioId)
    setState((previous) => ({ ...previous, activeScenarioId: scenarioId }))
    if (scenario) {
      setToast({ message: `${scenario.title} injected locally. Its Action Protocol is now open.` })
    }
  }

  const handleLogAssessment = () => {
    const signalCount = abnormalEvaluations.length
    setState((previous) => {
      const currentValues = previous.valuesByProfile[profile.id] ?? profile.baselines
      const currentAbnormal = getEvaluations(currentValues, profile, environment).filter((entry) => isAbnormal(entry.status))
      const severity: Status = currentAbnormal.some((entry) => entry.status === 'critical')
        ? 'critical'
        : currentAbnormal.length > 0
          ? 'watch'
          : 'nominal'
      const packets = [
        createPacket(
          'checkpoint',
          severity,
          'Daily health checkpoint',
          currentAbnormal.length
            ? `${currentAbnormal.length} advisory signal${currentAbnormal.length === 1 ? '' : 's'} included in this local assessment.`
            : 'Routine health snapshot is within the active prototype mission bands.',
          profile,
          environment,
        ),
        ...currentAbnormal.map((evaluation) =>
          createPacket(
            'alert',
            evaluation.status,
            `${getMetricMeta(evaluation.key).label} ${statusLabel(evaluation.status).toLowerCase()} alert`,
            `${evaluation.displayValue}. ${evaluation.message}`,
            profile,
            environment,
          ),
        ),
      ]

      return {
        ...previous,
        historyByProfile: {
          ...previous.historyByProfile,
          [profile.id]: recordToday(previous.historyByProfile[profile.id] ?? [], currentValues),
        },
        lastLoggedByProfile: { ...previous.lastLoggedByProfile, [profile.id]: new Date().toISOString() },
        outbox: [...packets, ...previous.outbox].slice(0, 30),
      }
    })
    setToast({
      message: signalCount
        ? `Assessment saved. ${signalCount} advisory telemetry packet${signalCount === 1 ? '' : 's'} queued for ground sync.`
        : 'Assessment saved locally and queued for the next communication window.',
    })
  }

  const handleToggleAction = (metric: HealthMetricKey, actionId: string, action: string) => {
    const storedKey = actionKey(profile.id, environment.id, metric, actionId)
    const evaluation = evaluationFor(metric)
    setState((previous) => {
      const wasChecked = Boolean(previous.actionChecks[storedKey])
      return {
        ...previous,
        actionChecks: { ...previous.actionChecks, [storedKey]: !wasChecked },
        outbox: wasChecked
          ? previous.outbox
          : [
              createPacket(
                'countermeasure',
                evaluation.status,
                `${getMetricMeta(metric).shortLabel} countermeasure complete`,
                action,
                profile,
                environment,
              ),
              ...previous.outbox,
            ].slice(0, 30),
      }
    })
    setToast({ message: 'Countermeasure action updated. Completed steps are included in the local ground-sync queue.' })
  }

  const handleScanModalityChange = (modality: ScanModality) => {
    setState((previous) => {
      const current = previous.scansByProfile[profile.id] ?? emptyScan()
      return {
        ...previous,
        scansByProfile: {
          ...previous.scansByProfile,
          [profile.id]: { ...current, modality, checklist: {} },
        },
      }
    })
  }

  const handleScanImageReady = (image: string, fileName: string) => {
    setState((previous) => {
      const current = previous.scansByProfile[profile.id] ?? emptyScan()
      return {
        ...previous,
        scansByProfile: {
          ...previous.scansByProfile,
          [profile.id]: { ...current, image, fileName, updatedAt: new Date().toISOString(), checklist: {} },
        },
      }
    })
    setToast({ message: 'Scan saved to local browser storage. Complete the visual handoff checklist before review.' })
  }

  const handleSimulateScan = () => {
    setState((previous) => {
      const current = previous.scansByProfile[profile.id] ?? emptyScan()
      return {
        ...previous,
        scansByProfile: {
          ...previous.scansByProfile,
          [profile.id]: {
            ...current,
            image: DEMO_SCAN_IMAGE,
            fileName: `ASTRA-SIM-${current.modality}.svg`,
            updatedAt: new Date().toISOString(),
            checklist: {},
          },
        },
      }
    })
    setToast({ message: 'Non-diagnostic simulation generated locally. Use the checklist before handing off the scan.' })
  }

  const handleToggleScanCheck = (checkId: string) => {
    setState((previous) => {
      const current = previous.scansByProfile[profile.id] ?? emptyScan()
      const wasChecked = Boolean(current.checklist[checkId])
      const item = SCAN_CHECKS[current.modality].find((entry) => entry.id === checkId)
      return {
        ...previous,
        scansByProfile: {
          ...previous.scansByProfile,
          [profile.id]: { ...current, checklist: { ...current.checklist, [checkId]: !wasChecked } },
        },
        outbox: wasChecked || !item
          ? previous.outbox
          : [
              createPacket('countermeasure', 'nominal', 'Imaging checklist item complete', item.label, profile, environment),
              ...previous.outbox,
            ].slice(0, 30),
      }
    })
    openGuidance('scan', 'action')
    setToast({ message: 'Imaging checklist updated and scan guidance opened. Completed reviews are queued locally.' })
  }

  const handleReset = () => {
    const confirmed = window.confirm('Reset all locally stored readings, scan images, action checklists, and telemetry packets to ASTRA-Vitals demo data?')
    if (!confirmed) return
    window.localStorage.removeItem(STORAGE_KEY)
    setState(createDemoState())
    setDrawerSelection(null)
    setTrendMetric('heartRate')
    setToast({ message: 'ASTRA-Vitals demo data restored on this device.' })
  }

  const topAlert = criticalCount > 0
    ? {
        status: 'critical' as Status,
        title: `${criticalCount} critical signal${criticalCount === 1 ? '' : 's'} need priority action`,
        detail: 'Open the emergency protocol and prepare an urgent Flight Surgeon handoff.',
        metric: evaluations.find((evaluation) => evaluation.status === 'critical')?.key ?? 'heartRate',
      }
    : abnormalEvaluations.length > 0
      ? {
          status: 'watch' as Status,
          title: `${abnormalEvaluations.length} signal${abnormalEvaluations.length === 1 ? '' : 's'} need a structured recheck`,
          detail: 'Guided crew self-care and a local asynchronous handoff are ready.',
          metric: abnormalEvaluations[0].key,
        }
      : {
          status: 'nominal' as Status,
          title: 'All active indicators are within the mission advisory band',
          detail: 'Continue routine monitoring and use guidance for any symptom change.',
          metric: 'heartRate' as HealthMetricKey,
        }

  const lastLogged = state.lastLoggedByProfile[profile.id]

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-mark"><Orbit size={24} strokeWidth={1.8} aria-hidden="true" /><span /></div>
            <div>
              <div className="brand-name">ASTRA<span>-VITALS</span></div>
              <div className="brand-subtitle">Autonomous Spaceflight Triage, Readiness & Action</div>
            </div>
          </div>

          <div className="top-controls">
            <label className="top-select-control">
              <UserRound size={15} aria-hidden="true" />
              <span className="sr-only">Active astronaut profile</span>
              <select value={profile.id} onChange={(event) => handleProfileChange(event.target.value)}>
                {PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}
              </select>
            </label>
            <label className="top-select-control top-select-control--environment">
              <Rocket size={15} aria-hidden="true" />
              <span className="sr-only">Active mission environment</span>
              <select value={environment.id} onChange={(event) => handleEnvironmentChange(event.target.value)}>
                {ENVIRONMENTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className={isOnline ? 'connection-badge connection-badge--online' : 'connection-badge connection-badge--offline'} title="All demo state remains available in local browser storage.">
              {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
              <span>{isOnline ? 'LOCAL-FIRST' : 'OFFLINE MODE'}</span>
            </div>
            <button className="icon-button" type="button" onClick={() => setIsScienceModalOpen(true)} aria-label="Open NASA Science and Standards">
              <BookOpen size={18} aria-hidden="true" />
            </button>
            <button className="reset-button" type="button" onClick={handleReset}>
              <RefreshCcw size={15} aria-hidden="true" /><span>Reset demo</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="mission-hero" aria-labelledby="mission-title">
          <div className="mission-identity">
            <div className="astronaut-avatar" style={{ color: profile.color, borderColor: `${profile.color}80`, backgroundColor: `${profile.color}18` }}>{profile.initials}</div>
            <div>
              <div className="eyebrow">Crew health command · Mission day {profile.missionDay}</div>
              <h1 id="mission-title">{profile.name} <span>· {profile.role}</span></h1>
              <p>{profile.specialty}. Personal baseline-centered triage for independent crew action.</p>
            </div>
          </div>

          <div className="mission-specs" aria-label="Active mission environment summary">
            <div className="mission-spec"><span><Rocket size={14} aria-hidden="true" /> Environment</span><strong>{environment.shortName}</strong><small>{environment.gravity}</small></div>
            <div className="mission-spec"><span><Radio size={14} aria-hidden="true" /> Earth link</span><strong>{environment.latency}</strong><small>{environment.comms}</small></div>
            <div className="mission-spec"><span><Radiation size={14} aria-hidden="true" /> Dose watch</span><strong>≤ {environment.radiationNominalMax.toFixed(2)} mSv/day</strong><small>active advisory band</small></div>
          </div>
        </section>

        <button type="button" className={`priority-alert priority-alert--${topAlert.status}`} onClick={() => openGuidance(topAlert.metric, topAlert.status === 'nominal' ? 'measure' : 'action')}>
          {topAlert.status === 'nominal' ? <CheckCircle2 size={21} aria-hidden="true" /> : <ShieldAlert size={21} aria-hidden="true" />}
          <span><strong>{topAlert.title}</strong><small>{topAlert.detail}</small></span>
          <ChevronRight size={19} aria-hidden="true" />
        </button>

        <div className="main-dashboard-grid">
          <section className="panel health-panel" aria-labelledby="health-overview-title">
            <div className="panel-heading">
              <div>
                <div className="eyebrow"><Activity size={14} aria-hidden="true" /> Live health indicators</div>
                <h2 id="health-overview-title">Personal baseline monitor</h2>
                <p>Tap a metric for measurement steps, RIDGE context, and a deterministic action protocol.</p>
              </div>
              <div className="status-summary"><StatusPill status={criticalCount ? 'critical' : abnormalEvaluations.length ? 'watch' : 'nominal'} /><span>{criticalCount ? `${criticalCount} priority` : abnormalEvaluations.length ? `${abnormalEvaluations.length} watch` : 'All nominal'}</span></div>
            </div>
            <div className="metric-grid">
              {METRICS.filter((metric) => metric.key !== 'scan').map((metric) => (
                <MetricCard key={metric.key} metric={metric} evaluation={evaluationFor(metric.key)} values={values} onOpen={openGuidance} />
              ))}
            </div>
          </section>

          <aside className="panel triage-panel" aria-labelledby="triage-feed-title">
            <div className="panel-heading compact-heading">
              <div>
                <div className="eyebrow"><BellRing size={14} aria-hidden="true" /> Triage feed</div>
                <h2 id="triage-feed-title">Actionable signals</h2>
                <p>Live status under the active environment.</p>
              </div>
              <StatusPill status={criticalCount ? 'critical' : abnormalEvaluations.length ? 'watch' : 'nominal'} compact />
            </div>
            {abnormalEvaluations.length ? (
              <div className="triage-list">
                {abnormalEvaluations.map((evaluation) => (
                  <button type="button" className={`triage-item triage-item--${evaluation.status}`} key={evaluation.key} onClick={() => openGuidance(evaluation.key, 'action')}>
                    <span className="triage-icon">{evaluation.status === 'critical' ? <ShieldAlert size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}</span>
                    <span><strong>{getMetricMeta(evaluation.key).label}</strong><small>{evaluation.message}</small></span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="triage-empty"><CheckCircle2 size={22} aria-hidden="true" /><span><strong>No active alerts</strong><small>Watch bands adapt when the crew changes environment.</small></span></div>
            )}
          </aside>
        </div>

        <section className="panel intake-panel" aria-labelledby="intake-title">
          <div className="panel-heading intake-heading">
            <div>
              <div className="eyebrow"><FileClock size={14} aria-hidden="true" /> Multi-modal intake</div>
              <h2 id="intake-title">Log today’s assessment</h2>
              <p>Entries evaluate against the selected astronaut’s baseline and the active mission environment in real time.</p>
            </div>
            <div className="intake-actions">
              {lastLogged && <span className="last-logged"><FileClock size={14} aria-hidden="true" /> Logged {formatDateTime(lastLogged)}</span>}
              <button type="button" className="primary-button" onClick={handleLogAssessment}><Check size={17} strokeWidth={3} aria-hidden="true" /> Log & assess</button>
            </div>
          </div>
          <div className="numeric-input-grid">
            {numericMetrics.map((metric) => (
              <NumericMetricInput key={metric.key} metric={metric} values={values} evaluation={evaluationFor(metric.key)} onValueChange={handleValueChange} onOpen={openGuidance} />
            ))}
          </div>
          <div className="scale-input-grid">
            {scaleMetrics.map((metric) => (
              <ScaleMetricInput key={metric.key} metric={metric} values={values} evaluation={evaluationFor(metric.key)} onValueChange={handleValueChange} onOpen={openGuidance} />
            ))}
          </div>
        </section>

        <div className="analytics-grid">
          <TrendChart activeMetric={trendMetric} history={history} profile={profile} environment={environment} onMetricChange={setTrendMetric} />

          <div className="integration-column">
            <ReadinessPanel
              astronaut={profile}
              values={values}
              environment={environment}
              taskChecks={state.taskChecks}
              onToggleTask={handleToggleTask}
            />
            <ScenarioSimulator
              astronaut={profile}
              environment={environment}
              state={state}
              onScenarioChange={handleScenarioChange}
              onStateChange={setState}
              onOpenActionProtocol={(metricKey) => openGuidance(metricKey, 'action')}
              onResetDemo={handleReset}
            />
          </div>
        </div>

        <div className="operations-grid">
          <ScanPanel
            scan={scan}
            onModalityChange={handleScanModalityChange}
            onImageReady={handleScanImageReady}
            onSimulate={handleSimulateScan}
            onToggleCheck={handleToggleScanCheck}
            onOpenGuidance={() => openGuidance('scan')}
          />

          <GroundSyncOutbox state={state} environment={environment} onStateChange={setState} />
        </div>
      </main>

      <GuidanceDrawer
        metricKey={drawerSelection?.key ?? null}
        evaluation={selectedEvaluation}
        values={values}
        profile={profile}
        environment={environment}
        scenario={drawerScenario}
        actionChecks={drawerActionChecks}
        onToggleAction={handleToggleAction}
        onClose={() => setDrawerSelection(null)}
        initialTab={drawerSelection?.tab}
      />

      <NasaScienceModal isOpen={isScienceModalOpen} onClose={() => setIsScienceModalOpen(false)} />

      {toast && <div className={toast.warning ? 'toast toast--warning' : 'toast'} role="status"><CheckCircle2 size={17} aria-hidden="true" />{toast.message}</div>}
    </div>
  )
}
