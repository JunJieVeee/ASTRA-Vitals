import { useEffect } from 'react'
import { BookOpen, ExternalLink, ShieldAlert, X } from 'lucide-react'
import { HAZARD_LABELS, NASA_SOURCES } from '../data'
import { getMetricMeta } from '../engine'
import type { HazardKey, NumericMetricKey } from '../types'

export interface NasaScienceModalProps {
  isOpen: boolean
  onClose: () => void
}

interface RidgeMetricSummary {
  letter: 'R' | 'I' | 'D' | 'G' | 'E'
  hazard: HazardKey
  metrics: NumericMetricKey[]
  purpose: string
}

const ridgeMetricSummary: RidgeMetricSummary[] = [
  {
    letter: 'R',
    hazard: 'radiation',
    metrics: ['radiation', 'temperature'],
    purpose: 'Exposure context and recovery signal',
  },
  {
    letter: 'I',
    hazard: 'isolation',
    metrics: ['sleep', 'mood', 'stress', 'cognitive'],
    purpose: 'Sleep, behavioral health, and vigilance',
  },
  {
    letter: 'D',
    hazard: 'distance',
    metrics: ['heartRate', 'bloodPressure', 'spo2', 'cognitive'],
    purpose: 'Delay-tolerant crew-side handoff',
  },
  {
    letter: 'G',
    hazard: 'gravity',
    metrics: ['bloodPressure', 'heartRate', 'exercise'],
    purpose: 'Fluid shift and loading countermeasures',
  },
  {
    letter: 'E',
    hazard: 'environment',
    metrics: ['co2', 'spo2', 'temperature'],
    purpose: 'Closed-environment and air-quality context',
  },
]

export function NasaScienceModal({ isOpen, onClose }: NasaScienceModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation">
      <button
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
        type="button"
        aria-label="Close NASA science references"
        onClick={onClose}
      />
      <section
        className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-black/60 sm:rounded-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nasa-science-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Evidence context
            </div>
            <h2 id="nasa-science-title" className="mt-2 text-xl font-semibold text-slate-100">NASA science references</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              The prototype connects its mission-health indicators to NASA human-spaceflight hazards, open science data, and human-system standards.
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            type="button"
            onClick={onClose}
            aria-label="Close NASA science references"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-amber-50">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Non-clinical prototype medical disclaimer</h3>
            <p className="mt-1 text-sm leading-6 text-amber-100">
              This interface is educational decision-support mockup only. Its thresholds are illustrative, not official clinical limits, and it does not diagnose, prescribe, or replace approved mission medical procedures or a flight surgeon.
            </p>
          </div>
        </div>

        <section className="mt-6" aria-labelledby="ridge-summary-title">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">HRP Five Hazards</span>
              <h3 id="ridge-summary-title" className="mt-1 text-base font-semibold text-slate-100">RIDGE-to-metric summary</h3>
            </div>
            <span className="text-xs text-slate-500">Illustrative monitoring connections</span>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-900/90 text-xs uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Hazard</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Prototype indicators</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Operational connection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-300">
                {ridgeMetricSummary.map((row) => (
                  <tr key={row.hazard}>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-slate-100">
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-400/25 bg-emerald-400/10 font-mono text-xs text-emerald-200">
                        {row.letter}
                      </span>
                      {HAZARD_LABELS[row.hazard]}
                    </th>
                    <td className="px-4 py-3 leading-5 text-slate-300">
                      {row.metrics.map((metric) => getMetricMeta(metric).shortLabel).join(', ')}
                    </td>
                    <td className="px-4 py-3 leading-5 text-slate-400">{row.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="nasa-sources-title">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <h3 id="nasa-sources-title" className="text-base font-semibold text-slate-100">NASA citations</h3>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {NASA_SOURCES.map((source) => (
              <li key={source.url} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <a
                  className="inline-flex items-start gap-2 text-sm font-semibold leading-5 text-emerald-200 underline decoration-emerald-400/50 underline-offset-4 transition hover:text-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{source.title}</span>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
                <p className="mt-2 text-sm leading-5 text-slate-400">{source.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </div>
  )
}
