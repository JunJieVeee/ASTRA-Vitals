import { METRICS, PROFILES } from './data'
import type {
  AppState,
  AstronautProfile,
  HealthMetricKey,
  HealthValues,
  HistoryEntry,
  MetricEvaluation,
  MissionEnvironment,
  NumericMetricKey,
  Scenario,
  ScanState,
  Status,
  SyncPacket,
  ThresholdBand,
} from './types'

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const STORAGE_KEY = 'astra-vitals.local-state.v1'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function roundTo(value: number, precision = 0) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function formatDateTime(iso: string) {
  return dateTimeFormatter.format(new Date(iso))
}

export function getMetricMeta(key: HealthMetricKey) {
  const metric = METRICS.find((entry) => entry.key === key)
  if (!metric) {
    throw new Error(`Unknown metric: ${key}`)
  }
  return metric
}

export function getMetricValue(values: HealthValues, key: NumericMetricKey) {
  return values[key]
}

export function formatValue(key: HealthMetricKey, values: HealthValues) {
  const meta = getMetricMeta(key)
  if (key === 'bloodPressure') {
    return `${Math.round(values.bloodPressure)}/${Math.round(values.bloodPressureDiastolic)}`
  }
  if (key === 'scan') {
    return 'Review image'
  }
  const value = values[key]
  return `${value.toFixed(meta.precision)}${meta.unit ? ` ${meta.unit}` : ''}`
}

function baselineDelta(key: NumericMetricKey) {
  const deltas: Record<NumericMetricKey, number> = {
    heartRate: 9,
    bloodPressure: 12,
    bloodGlucose: 14,
    temperature: 0.35,
    spo2: 2,
    radiation: 0.2,
    co2: 1.1,
    sleep: 1.25,
    exercise: 16,
    mood: 1,
    stress: 1,
    cognitive: 1,
  }
  return deltas[key]
}

export function getBaselineBand(key: NumericMetricKey, profile: AstronautProfile) {
  const delta = baselineDelta(key)
  const base = profile.baselines[key]
  return {
    low: roundTo(Math.max(0, base - delta), key === 'temperature' || key === 'radiation' ? 1 : 0),
    high: roundTo(base + delta, key === 'temperature' || key === 'radiation' ? 1 : 0),
  }
}

export function getThresholdBand(
  key: NumericMetricKey,
  profile: AstronautProfile,
  environment: MissionEnvironment,
): ThresholdBand {
  const baseline = getBaselineBand(key, profile)
  const common = {
    baselineLow: baseline.low,
    baselineHigh: baseline.high,
    referenceLabel: 'NASA-STD-3001 reference line*',
  }

  switch (key) {
    case 'heartRate':
      return { ...common, nominalLow: 50, nominalHigh: 100, watchLow: 45, watchHigh: 120 }
    case 'bloodPressure':
      return { ...common, nominalLow: 90, nominalHigh: 130, watchLow: 80, watchHigh: 180 }
    case 'bloodGlucose':
      return { ...common, nominalLow: 70, nominalHigh: 140, watchLow: 60, watchHigh: 180 }
    case 'temperature':
      return { ...common, nominalLow: 36, nominalHigh: 37.8, watchLow: 35, watchHigh: 38.5 }
    case 'spo2':
      return { ...common, nominalLow: environment.spo2NominalMin, nominalHigh: 100, watchLow: 90, watchHigh: 100 }
    case 'radiation':
      return {
        ...common,
        nominalLow: 0,
        nominalHigh: environment.radiationNominalMax,
        watchLow: 0,
        watchHigh: environment.radiationWatchMax,
      }
    case 'co2':
      return {
        ...common,
        nominalLow: 0,
        nominalHigh: environment.co2NominalMax,
        watchLow: 0,
        watchHigh: environment.co2WatchMax,
      }
    case 'sleep':
      return { ...common, nominalLow: environment.sleepNominalMin, nominalHigh: 10, watchLow: 4, watchHigh: 12 }
    case 'exercise':
      return { ...common, nominalLow: environment.exerciseNominalMin, nominalHigh: 150, watchLow: 10, watchHigh: 180 }
    case 'mood':
      return { ...common, nominalLow: 3, nominalHigh: 5, watchLow: 2, watchHigh: 5 }
    case 'stress':
      return { ...common, nominalLow: 1, nominalHigh: 3, watchLow: 1, watchHigh: 4 }
    case 'cognitive':
      return { ...common, nominalLow: 3, nominalHigh: 5, watchLow: 2, watchHigh: 5 }
  }
}

function statusFromBand(value: number, band: ThresholdBand): Status {
  if (value < band.watchLow || value > band.watchHigh) {
    return 'critical'
  }
  if (value < band.nominalLow || value > band.nominalHigh) {
    return 'watch'
  }
  return 'nominal'
}

function readableBand(value: number, precision: number) {
  return value.toFixed(precision).replace(/\.0$/, '')
}

function evaluationMessage(key: NumericMetricKey, value: number, band: ThresholdBand, status: Status, profile: AstronautProfile) {
  const meta = getMetricMeta(key)
  if (status === 'critical') {
    if (value < band.watchLow) {
      return `Below action band (${readableBand(band.watchLow, meta.precision)} ${meta.unit}).`
    }
    return `Above action band (${readableBand(band.watchHigh, meta.precision)} ${meta.unit}).`
  }
  if (status === 'watch') {
    if (value < band.nominalLow) {
      return `Below active mission band (${readableBand(band.nominalLow, meta.precision)} ${meta.unit}).`
    }
    if (value > band.nominalHigh) {
      return `Above active mission band (${readableBand(band.nominalHigh, meta.precision)} ${meta.unit}).`
    }
    return `Outside ${profile.name.split(' ')[0]}'s personal baseline.`
  }
  return 'Within active mission band.'
}

export function evaluateMetric(
  key: HealthMetricKey,
  values: HealthValues,
  profile: AstronautProfile,
  environment: MissionEnvironment,
): MetricEvaluation {
  if (key === 'scan') {
    return {
      key,
      status: 'nominal',
      value: 0,
      displayValue: 'Review image',
      message: 'Structured acquisition and clinician review guidance available.',
      band: {
        nominalLow: 0,
        nominalHigh: 1,
        watchLow: 0,
        watchHigh: 1,
        baselineLow: 0,
        baselineHigh: 1,
        referenceLabel: 'Protocol review',
      },
    }
  }

  const band = getThresholdBand(key, profile, environment)
  const value = getMetricValue(values, key)
  let status = statusFromBand(value, band)

  if (key === 'bloodPressure') {
    const diastolic = values.bloodPressureDiastolic
    if (value < 80 || value >= 180 || diastolic < 45 || diastolic >= 120) {
      status = 'critical'
    } else if (value < 90 || value > 140 || diastolic < 55 || diastolic > 90) {
      status = 'watch'
    } else if (value < band.baselineLow || value > band.baselineHigh) {
      status = 'watch'
    }
    const detail =
      status === 'nominal'
        ? 'Within active mission band.'
        : status === 'critical'
          ? 'Systolic or diastolic value is outside the action band.'
          : 'Repeat in approved posture and compare with personal baseline.'
    return { key, status, value, displayValue: formatValue(key, values), message: detail, band }
  }

  if (status === 'nominal' && (value < band.baselineLow || value > band.baselineHigh)) {
    status = 'watch'
  }

  return {
    key,
    status,
    value,
    displayValue: formatValue(key, values),
    message: evaluationMessage(key, value, band, status, profile),
    band,
  }
}

export function getEvaluations(values: HealthValues, profile: AstronautProfile, environment: MissionEnvironment) {
  return METRICS.filter((metric) => metric.key !== 'scan').map((metric) =>
    evaluateMetric(metric.key, values, profile, environment),
  )
}

export function isAbnormal(status: Status) {
  return status === 'watch' || status === 'critical'
}

export function calculateReadiness(evaluations: MetricEvaluation[], completedTasks: number, totalTasks: number) {
  const riskPenalty = evaluations.reduce((sum, evaluation) => {
    if (evaluation.status === 'critical') return sum + 18
    if (evaluation.status === 'watch') return sum + 6
    return sum
  }, 0)
  const routineCredit = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 10)
  return clamp(90 - riskPenalty + routineCredit, 0, 100)
}

export function readinessLabel(score: number) {
  if (score >= 88) return 'High readiness'
  if (score >= 70) return 'Guarded readiness'
  if (score >= 45) return 'Limited readiness'
  return 'Hold & assess'
}

function noise(index: number, amplitude: number, phase: number) {
  return Math.sin((index + 1) * 1.37 + phase) * amplitude + Math.cos((index + 1) * 0.61 + phase) * amplitude * 0.35
}

export function createDemoHistory(profile: AstronautProfile, profileIndex: number): HistoryEntry[] {
  const now = new Date()
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (13 - index))
    const base = profile.baselines
    return {
      date: todayKey(date),
      label: dayFormatter.format(date),
      heartRate: clamp(Math.round(base.heartRate + noise(index, 3.2, profileIndex)), 46, 110),
      bloodPressure: clamp(Math.round(base.bloodPressure + noise(index, 4.5, profileIndex + 1)), 88, 135),
      bloodPressureDiastolic: clamp(Math.round(base.bloodPressureDiastolic + noise(index, 3, profileIndex + 2)), 55, 90),
      bloodGlucose: clamp(Math.round(base.bloodGlucose + noise(index, 5.8, profileIndex + 3)), 68, 145),
      temperature: roundTo(clamp(base.temperature + noise(index, 0.14, profileIndex + 4), 36, 37.8), 1),
      spo2: clamp(Math.round(base.spo2 + noise(index, 0.8, profileIndex + 5)), 94, 100),
      radiation: roundTo(clamp(base.radiation + noise(index, 0.08, profileIndex + 6), 0.08, 0.6), 2),
      co2: roundTo(clamp(base.co2 + noise(index, 0.45, profileIndex + 7), 2, 4.5), 1),
      sleep: roundTo(clamp(base.sleep + noise(index, 0.55, profileIndex + 8), 5.8, 9.2), 1),
      exercise: clamp(Math.round(base.exercise + noise(index, 7, profileIndex + 9)), 24, 68),
      mood: clamp(Math.round(base.mood + noise(index, 0.5, profileIndex + 10)), 2, 5),
      stress: clamp(Math.round(base.stress + noise(index, 0.55, profileIndex + 11)), 1, 4),
      cognitive: clamp(Math.round(base.cognitive + noise(index, 0.45, profileIndex + 12)), 2, 5),
    }
  })
}

export function emptyScan(): ScanState {
  return {
    modality: 'ocular-oct',
    image: null,
    fileName: null,
    updatedAt: null,
    checklist: {},
  }
}

export function createDemoState(): AppState {
  const activeProfile = PROFILES[0]
  const valuesByProfile = Object.fromEntries(PROFILES.map((profile) => [profile.id, { ...profile.baselines }]))
  const historyByProfile = Object.fromEntries(
    PROFILES.map((profile, index) => [profile.id, createDemoHistory(profile, index)]),
  )
  const scansByProfile = Object.fromEntries(PROFILES.map((profile) => [profile.id, emptyScan()]))
  const firstTaskKey = taskKey(activeProfile.id, 'deep-space-transit', 'transit-am')

  return {
    activeProfileId: activeProfile.id,
    activeEnvironmentId: 'deep-space-transit',
    valuesByProfile,
    historyByProfile,
    scansByProfile,
    taskChecks: { [firstTaskKey]: true },
    actionChecks: {},
    lastLoggedByProfile: { [activeProfile.id]: null, 'mateo-silva': null, 'hana-park': null },
    outbox: [
      {
        id: 'demo-transmitted-checkpoint',
        kind: 'checkpoint',
        severity: 'nominal',
        title: 'Prior routine checkpoint',
        body: 'Daily readiness snapshot acknowledged by the simulated ground queue.',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        state: 'transmitted',
        astronautName: activeProfile.name,
        environmentName: 'Deep-Space Transit Spacecraft',
      },
    ],
  }
}

export function hydrateState(candidate: unknown): AppState | null {
  if (!candidate || typeof candidate !== 'object') return null
  const raw = candidate as Partial<AppState>
  const demo = createDemoState()
  if (!raw.activeProfileId || !raw.activeEnvironmentId || !raw.valuesByProfile || !raw.historyByProfile) return null

  return {
    ...demo,
    ...raw,
    valuesByProfile: { ...demo.valuesByProfile, ...raw.valuesByProfile },
    historyByProfile: { ...demo.historyByProfile, ...raw.historyByProfile },
    scansByProfile: { ...demo.scansByProfile, ...raw.scansByProfile },
    taskChecks: { ...demo.taskChecks, ...raw.taskChecks },
    actionChecks: { ...demo.actionChecks, ...raw.actionChecks },
    lastLoggedByProfile: { ...demo.lastLoggedByProfile, ...raw.lastLoggedByProfile },
    outbox: Array.isArray(raw.outbox) ? raw.outbox : demo.outbox,
  }
}

export function recordToday(history: HistoryEntry[], values: HealthValues) {
  const date = todayKey()
  const entry: HistoryEntry = { ...values, date, label: dayFormatter.format(new Date()) }
  const withoutToday = history.filter((item) => item.date !== date)
  return [...withoutToday, entry].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
}

export function taskKey(profileId: string, environmentId: string, taskId: string) {
  return `${todayKey()}:${profileId}:${environmentId}:${taskId}`
}

export function actionKey(profileId: string, environmentId: string, metric: HealthMetricKey, actionId: string) {
  return `${todayKey()}:${profileId}:${environmentId}:${metric}:${actionId}`
}

export function createPacket(
  kind: SyncPacket['kind'],
  severity: Status,
  title: string,
  body: string,
  profile: AstronautProfile,
  environment: MissionEnvironment,
): SyncPacket {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    severity,
    title,
    body,
    createdAt: new Date().toISOString(),
    state: 'queued',
    astronautName: profile.name,
    environmentName: environment.name,
  }
}

export interface ActionProtocol {
  title: string
  mode: 'CREW SELF-CARE' | 'FLIGHT SURGEON ESCALATION'
  urgency: 'Routine' | 'Recheck today' | 'Priority'
  summary: string
  steps: string[]
}

function scenarioSteps(scenario: Scenario) {
  const steps: Record<string, string[]> = {
    'acute-cardiac': [
      'Stop current work, secure a safe posture, and bring another crew member into the response.',
      'Activate the mission-approved acute chest-pain or cardiovascular emergency checklist without waiting for a routine comms window.',
      'Repeat approved vitals and document symptom onset, severity, exertion, and associated symptoms.',
      'Package the priority medical telemetry packet and follow command / flight-surgeon direction before resuming duty.',
    ],
    'solar-particle': [
      'Stop nonessential exposed work, account for crew, and move to the designated storm-shelter configuration.',
      'Verify personal dosimeter and vehicle radiation displays, then record location and shielding status.',
      'Suspend EVA or surface exposure until mission radiation authority gives a release.',
      'Queue a priority dose report for the next available Earth link and maintain the event timeline.',
    ],
    'fluid-shift': [
      'Pause loading or exertion, secure a seated posture, and repeat blood pressure using the approved method.',
      'Follow the mission hydration and recovery plan; do not self-adjust medication or exercise load.',
      'Complete the ocular or portable-ultrasound acquisition checklist if directed by the protocol.',
      'Send the repeat readings, symptoms, and exercise context for flight-surgeon review before resuming high-load work.',
    ],
    'isolation-decline': [
      'Pause safety-critical solo work and request a crew cross-check or workload handoff.',
      'Use the protected sleep and circadian-light recovery plan during the next available rest period.',
      'Notify the designated behavioral-health or command contact through the privacy protocol.',
      'Package the sleep, mood, stress, and alertness trend for flight-surgeon support at the next link.',
    ],
  }
  return steps[scenario.id] ?? []
}

export function getActionProtocol(
  key: HealthMetricKey,
  evaluation: MetricEvaluation,
  scenario?: Scenario | null,
): ActionProtocol {
  const meta = getMetricMeta(key)
  if (scenario && scenario.focusMetric === key) {
    return {
      title: scenario.protocolTitle,
      mode: 'FLIGHT SURGEON ESCALATION',
      urgency: scenario.severity === 'critical' ? 'Priority' : 'Recheck today',
      summary: `Demo scenario active: ${scenario.title}. Follow the onboard protocol and package a delay-tolerant handoff.`,
      steps: scenarioSteps(scenario),
    }
  }

  if (evaluation.status === 'critical') {
    return {
      title: `Priority ${meta.label} protocol`,
      mode: 'FLIGHT SURGEON ESCALATION',
      urgency: 'Priority',
      summary: 'This reading is outside the prototype action band. Stabilize the situation, use the approved onboard checklist, and seek flight-surgeon direction.',
      steps: meta.escalation,
    }
  }

  if (evaluation.status === 'watch') {
    return {
      title: `Watch & recheck ${meta.label}`,
      mode: 'CREW SELF-CARE',
      urgency: 'Recheck today',
      summary: 'This reading needs a structured recheck and documented crew-side countermeasures. Escalate if it persists, worsens, or occurs with concerning symptoms.',
      steps: meta.selfCare,
    }
  }

  return {
    title: `Maintain ${meta.label} routine`,
    mode: 'CREW SELF-CARE',
    urgency: 'Routine',
    summary: 'The current reading is within the active prototype mission band. Continue the planned cadence and report a meaningful symptom change even if the number remains normal.',
    steps: meta.selfCare,
  }
}
