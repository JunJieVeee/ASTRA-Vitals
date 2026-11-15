import { Activity, Award, Check, ClipboardCheck, HeartPulse, ShieldAlert } from 'lucide-react'
import { calculateReadiness, getEvaluations, isAbnormal, readinessLabel, taskKey } from '../engine'
import type { AppState, AstronautProfile, HealthValues, MissionEnvironment } from '../types'

export interface ReadinessPanelProps {
  astronaut: AstronautProfile
  values: HealthValues
  environment: MissionEnvironment
  taskChecks: AppState['taskChecks']
  onToggleTask: (taskId: string) => void
}

const gaugeRadius = 45
const gaugeCircumference = 2 * Math.PI * gaugeRadius

function readinessStyle(score: number) {
  if (score >= 88) {
    return {
      stroke: 'stroke-emerald-400',
      badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
      text: 'text-emerald-300',
    }
  }
  if (score >= 70) {
    return {
      stroke: 'stroke-amber-400',
      badge: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
      text: 'text-amber-300',
    }
  }
  return {
    stroke: 'stroke-red-400',
    badge: 'border-red-400/30 bg-red-400/10 text-red-100',
    text: 'text-red-300',
  }
}

export function ReadinessPanel({ astronaut, values, environment, taskChecks, onToggleTask }: ReadinessPanelProps) {
  const evaluations = getEvaluations(values, astronaut, environment)
  const checklist = environment.checklist.map((task) => ({
    task,
    checkKey: taskKey(astronaut.id, environment.id, task.id),
  }))
  const completedTasks = checklist.filter(({ checkKey }) => Boolean(taskChecks[checkKey])).length
  const score = calculateReadiness(evaluations, completedTasks, checklist.length)
  const label = readinessLabel(score)
  const style = readinessStyle(score)
  const criticalCount = evaluations.filter((evaluation) => evaluation.status === 'critical').length
  const attentionCount = evaluations.filter((evaluation) => isAbnormal(evaluation.status)).length
  const gaugeOffset = gaugeCircumference - (score / 100) * gaugeCircumference

  return (
    <section
      className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/30"
      aria-labelledby="readiness-title"
    >
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <HeartPulse className="h-4 w-4" aria-hidden="true" />
            Crew operations
          </div>
          <h2 id="readiness-title" className="mt-2 text-lg font-semibold text-slate-100">Crew readiness</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Live prototype score for {astronaut.name} in the {environment.shortName} environment.
          </p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${style.badge}`}>
          <Activity className="h-4 w-4" aria-hidden="true" />
          {label}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`Crew Readiness Score: ${score} out of 100`}>
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="stroke-slate-800" cx="60" cy="60" r={gaugeRadius} fill="none" strokeWidth="10" />
                <circle
                  className={`${style.stroke} transition-[stroke-dashoffset] duration-500`}
                  cx="60"
                  cy="60"
                  r={gaugeRadius}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-3xl font-bold tabular-nums text-slate-100">{score}</strong>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">of 100</span>
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Readiness signal</span>
              <p className={`mt-1 text-lg font-semibold ${style.text}`}>{label}</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                {completedTasks}/{checklist.length} scheduled tasks complete. {attentionCount === 0 ? 'No abnormal numeric telemetry.' : `${attentionCount} metric${attentionCount === 1 ? '' : 's'} needs attention.`}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-sm">
            <div>
              <span className="block text-xs uppercase tracking-wide text-slate-500">Habit streak</span>
              <strong className="mt-1 flex items-center gap-1.5 text-slate-100">
                <Activity className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                {astronaut.streak} days
              </strong>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wide text-slate-500">Priority flags</span>
              <strong className={`mt-1 block ${criticalCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {criticalCount} critical
              </strong>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100">Mission health badges</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {astronaut.badges.map((badge) => (
              <span key={badge} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {badge}
              </span>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            Readiness combines current mission-band evaluations with completion of the environment’s daily routine.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <ClipboardCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              Scheduled measurement reminders
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-100">{environment.name} daily checklist</h3>
          </div>
          <span className="text-sm text-slate-400">{completedTasks}/{checklist.length} completed</span>
        </div>

        <ul className="mt-4 space-y-2">
          {checklist.map(({ task, checkKey }) => {
            const checked = Boolean(taskChecks[checkKey])
            const inputId = `readiness-${astronaut.id}-${environment.id}-${task.id}`
            const detailId = `${inputId}-detail`
            return (
              <li key={task.id} className={`rounded-lg border p-3 transition ${checked ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'}`}>
                <div className="flex items-start gap-3">
                  <input
                    id={inputId}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-600 bg-slate-950 accent-emerald-400 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    type="checkbox"
                    checked={checked}
                    aria-describedby={detailId}
                    onChange={() => onToggleTask(task.id)}
                  />
                  <label className="min-w-0 cursor-pointer" htmlFor={inputId}>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <strong className={checked ? 'text-emerald-100' : 'text-slate-200'}>{task.title}</strong>
                      <time className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">{task.time}</time>
                    </span>
                    <span id={detailId} className="mt-1 block text-sm leading-5 text-slate-400">{task.detail}</span>
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
