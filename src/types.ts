export type Status = 'nominal' | 'watch' | 'critical'

export type HazardKey = 'gravity' | 'radiation' | 'isolation' | 'environment' | 'distance'

export type HealthMetricKey =
  | 'heartRate'
  | 'bloodPressure'
  | 'bloodGlucose'
  | 'temperature'
  | 'spo2'
  | 'radiation'
  | 'co2'
  | 'sleep'
  | 'exercise'
  | 'mood'
  | 'stress'
  | 'cognitive'
  | 'scan'

export type NumericMetricKey = Exclude<HealthMetricKey, 'scan'>

export type InputKind = 'number' | 'scale' | 'scan'

export interface HealthValues {
  heartRate: number
  bloodPressure: number
  bloodPressureDiastolic: number
  bloodGlucose: number
  temperature: number
  spo2: number
  radiation: number
  co2: number
  sleep: number
  exercise: number
  mood: number
  stress: number
  cognitive: number
}

export interface HistoryEntry extends HealthValues {
  date: string
  label: string
}

export interface AstronautProfile {
  id: string
  name: string
  initials: string
  role: string
  specialty: string
  missionDay: number
  color: string
  baselines: HealthValues
  streak: number
  badges: string[]
}

export interface MissionEnvironment {
  id: string
  name: string
  shortName: string
  gravity: string
  comms: string
  latency: string
  radiationNominalMax: number
  radiationWatchMax: number
  co2NominalMax: number
  co2WatchMax: number
  spo2NominalMin: number
  sleepNominalMin: number
  exerciseNominalMin: number
  risks: string[]
  checklist: DailyTask[]
}

export interface DailyTask {
  id: string
  title: string
  detail: string
  time: string
}

export interface MetricMeta {
  key: HealthMetricKey
  label: string
  shortLabel: string
  unit: string
  inputKind: InputKind
  precision: number
  hazards: HazardKey[]
  description: string
  howToMeasure: string[]
  whyItMatters: string
  selfCare: string[]
  escalation: string[]
  scaleLabels?: [string, string]
}

export interface ThresholdBand {
  nominalLow: number
  nominalHigh: number
  watchLow: number
  watchHigh: number
  baselineLow: number
  baselineHigh: number
  referenceLabel: string
}

export interface MetricEvaluation {
  key: HealthMetricKey
  status: Status
  value: number
  displayValue: string
  message: string
  band: ThresholdBand
}

export type ScanModality = 'ocular-oct' | 'portable-ultrasound'

export interface ScanState {
  modality: ScanModality
  image: string | null
  fileName: string | null
  updatedAt: string | null
  checklist: Record<string, boolean>
}

export interface SyncPacket {
  id: string
  kind: 'alert' | 'countermeasure' | 'checkpoint'
  severity: Status
  title: string
  body: string
  createdAt: string
  state: 'queued' | 'transmitted'
  astronautName: string
  environmentName: string
}

export interface AppState {
  activeProfileId: string
  activeEnvironmentId: string
  activeScenarioId: Scenario['id'] | null
  valuesByProfile: Record<string, HealthValues>
  historyByProfile: Record<string, HistoryEntry[]>
  outbox: SyncPacket[]
  taskChecks: Record<string, boolean>
  actionChecks: Record<string, boolean>
  scansByProfile: Record<string, ScanState>
  lastLoggedByProfile: Record<string, string | null>
}

export interface Scenario {
  id: string
  title: string
  shortTitle: string
  description: string
  focusMetric: NumericMetricKey
  impact: Partial<HealthValues>
  severity: Status
  protocolTitle: string
}

export type GuidanceTab = 'measure' | 'why' | 'action'
