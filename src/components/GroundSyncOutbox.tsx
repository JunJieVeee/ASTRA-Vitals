import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { CheckCircle2, Clock, Inbox, Radio, Send } from 'lucide-react'
import { formatDateTime } from '../engine'
import type { AppState, MissionEnvironment, Status, SyncPacket } from '../types'
import { statusLabel } from './StatusPill'

export interface GroundSyncOutboxProps {
  state: AppState
  environment: MissionEnvironment
  onStateChange: Dispatch<SetStateAction<AppState>>
}

interface PacketListProps {
  heading: string
  packets: SyncPacket[]
  emptyMessage: string
}

const severityStyles: Record<Status, string> = {
  nominal: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  watch: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  critical: 'border-red-400/35 bg-red-400/10 text-red-100',
}

function PacketList({ heading, packets, emptyMessage }: PacketListProps) {
  return (
    <section className="min-w-0" aria-label={heading}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-100">{heading}</h3>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-300">{packets.length}</span>
      </div>

      {packets.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-3 py-5 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {packets.map((packet) => (
            <li key={packet.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {packet.kind} telemetry
                  </span>
                  <h4 className="mt-1 text-sm font-semibold text-slate-100">{packet.title}</h4>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${severityStyles[packet.severity]}`}>
                  {statusLabel(packet.severity)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-400">{packet.body}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-800 pt-3 text-xs text-slate-500">
                <span>{packet.astronautName}</span>
                <span>{packet.environmentName}</span>
                <time dateTime={packet.createdAt}>{formatDateTime(packet.createdAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function GroundSyncOutbox({ state, environment, onStateChange }: GroundSyncOutboxProps) {
  const [lastSync, setLastSync] = useState<{ at: string; packetCount: number } | null>(null)
  const queuedPackets = state.outbox.filter((packet) => packet.state === 'queued')
  const transmittedPackets = state.outbox.filter((packet) => packet.state === 'transmitted')

  const simulateCommsWindowSync = () => {
    const syncedAt = new Date().toISOString()
    const packetCount = queuedPackets.length

    if (packetCount > 0) {
      onStateChange((currentState) => ({
        ...currentState,
        outbox: currentState.outbox.map((packet) => (
          packet.state === 'queued' ? { ...packet, state: 'transmitted' } : packet
        )),
      }))
    }

    setLastSync({ at: syncedAt, packetCount })
  }

  return (
    <section
      className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-5 shadow-xl shadow-slate-950/30"
      aria-labelledby="ground-sync-title"
    >
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Radio className="h-4 w-4" aria-hidden="true" />
            Delay-tolerant ground link
          </div>
          <h2 id="ground-sync-title" className="mt-2 text-lg font-semibold text-slate-100">Ground-sync outbox</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Packet routing for {environment.name}. Local telemetry remains queued until a simulated communication window opens.
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950"
          type="button"
          onClick={simulateCommsWindowSync}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Simulate Comms Window Sync
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
        <Clock className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <strong className="font-semibold">Active communication context:</strong>
        <span>{environment.comms} · {environment.latency} delay</span>
      </div>

      {lastSync && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-100" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          {lastSync.packetCount > 0
            ? `${lastSync.packetCount} queued ${lastSync.packetCount === 1 ? 'packet was' : 'packets were'} marked transmitted at `
            : 'A comms window was checked at '}
          <time dateTime={lastSync.at} className="font-semibold">{formatDateTime(lastSync.at)}</time>.
        </p>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <PacketList
          heading="Queued for next window"
          packets={queuedPackets}
          emptyMessage="No telemetry packets are waiting for the next communication window."
        />
        <PacketList
          heading="Transmitted to ground"
          packets={transmittedPackets}
          emptyMessage="No packets have been marked transmitted in this local session."
        />
      </div>

      <p className="mt-5 flex items-start gap-2 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
        <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        This prototype changes local packet state only. It does not send health information to an external network or clinical system.
      </p>
    </section>
  )
}
