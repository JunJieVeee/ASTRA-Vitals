import { AlertTriangle, CheckCircle2, Radio } from 'lucide-react'
import type { Status } from '../types'

interface StatusPillProps {
  status: Status
  compact?: boolean
}

const labels: Record<Status, string> = {
  nominal: 'Nominal',
  watch: 'Watch',
  critical: 'Critical',
}

export function StatusPill({ status, compact = false }: StatusPillProps) {
  const Icon = status === 'nominal' ? CheckCircle2 : status === 'watch' ? AlertTriangle : Radio
  return (
    <span className={`status-pill status-pill--${status} ${compact ? 'status-pill--compact' : ''}`}>
      <Icon aria-hidden="true" size={compact ? 12 : 14} strokeWidth={2.2} />
      {labels[status]}
    </span>
  )
}

export function statusLabel(status: Status) {
  return labels[status]
}
