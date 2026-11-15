import { Activity, Info } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { METRICS } from '../data'
import { getBaselineBand, getMetricMeta, getThresholdBand, roundTo } from '../engine'
import type { AstronautProfile, HistoryEntry, MissionEnvironment, NumericMetricKey } from '../types'

interface TrendChartProps {
  activeMetric: NumericMetricKey
  history: HistoryEntry[]
  profile: AstronautProfile
  environment: MissionEnvironment
  onMetricChange: (metric: NumericMetricKey) => void
}

function axisValue(value: number, precision: number) {
  return value.toFixed(precision).replace(/\.0$/, '')
}

export function TrendChart({ activeMetric, history, profile, environment, onMetricChange }: TrendChartProps) {
  const metric = getMetricMeta(activeMetric)
  const band = getThresholdBand(activeMetric, profile, environment)
  const baseline = getBaselineBand(activeMetric, profile)
  const data = history.map((entry) => ({ day: entry.label, value: entry[activeMetric] }))
  const values = data.map((entry) => entry.value)
  const rawMin = Math.min(...values, baseline.low, band.watchLow)
  const rawMax = Math.max(...values, baseline.high, band.watchHigh)
  const span = Math.max(rawMax - rawMin, activeMetric === 'temperature' ? 0.6 : 2)
  const padding = span * 0.16
  const yMin = Math.max(0, roundTo(rawMin - padding, metric.precision))
  const yMax = roundTo(rawMax + padding, metric.precision)
  const metrics = METRICS.filter((entry): entry is typeof entry & { key: NumericMetricKey } => entry.key !== 'scan')

  return (
    <section className="panel trend-panel" aria-labelledby="trend-title">
      <div className="panel-heading trend-heading">
        <div>
          <div className="eyebrow"><Activity size={14} aria-hidden="true" /> Personal analytics</div>
          <h2 id="trend-title">14-day physiological trend</h2>
          <p>Personal baseline shading with active mission advisory threshold lines.</p>
        </div>
        <div className="trend-legend" aria-label="Chart legend">
          <span><i className="legend-dot legend-dot--teal" /> Actual trend</span>
          <span><i className="legend-band" /> Personal baseline</span>
          <span><i className="legend-line" /> Mission threshold*</span>
        </div>
      </div>

      <div className="trend-metric-picker" aria-label="Choose a physiological trend">
        {metrics.map((item) => (
          <button
            type="button"
            key={item.key}
            className={activeMetric === item.key ? 'trend-chip trend-chip--active' : 'trend-chip'}
            onClick={() => onMetricChange(item.key)}
          >
            {item.shortLabel}
          </button>
        ))}
      </div>

      <div className="chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#62e4c8" stopOpacity={0.38} />
                <stop offset="100%" stopColor="#62e4c8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#254252" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8ca7b7', fontSize: 11 }}
              minTickGap={28}
            />
            <YAxis
              domain={[yMin, yMax]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8ca7b7', fontSize: 11 }}
              tickFormatter={(value: number) => axisValue(value, metric.precision)}
              width={46}
            />
            <Tooltip
              cursor={{ stroke: '#8ba7b8', strokeDasharray: '4 4' }}
              contentStyle={{ background: '#0b202d', border: '1px solid #315264', borderRadius: 10, color: '#e4f4f4', boxShadow: '0 16px 38px rgba(0, 0, 0, 0.35)' }}
              labelStyle={{ color: '#9fbac7', marginBottom: 4 }}
            />
            <ReferenceArea y1={baseline.low} y2={baseline.high} fill="#7eb5ff" fillOpacity={0.13} ifOverflow="extendDomain" />
            <ReferenceLine y={band.nominalLow} stroke="#e5b764" strokeDasharray="5 5" strokeOpacity={0.85} />
            <ReferenceLine y={band.nominalHigh} stroke="#e5b764" strokeDasharray="5 5" strokeOpacity={0.85} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#68e1c7"
              strokeWidth={2.5}
              fill="url(#trendFill)"
              activeDot={{ r: 5, stroke: '#0a1b27', strokeWidth: 2, fill: '#c8fff2' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="trend-summary">
        <div>
          <span>Personal baseline</span>
          <strong>{axisValue(baseline.low, metric.precision)}–{axisValue(baseline.high, metric.precision)} {metric.unit}</strong>
        </div>
        <div>
          <span>Active mission band</span>
          <strong>{axisValue(band.nominalLow, metric.precision)}–{axisValue(band.nominalHigh, metric.precision)} {metric.unit}</strong>
        </div>
        <div className="trend-disclaimer">
          <Info size={15} aria-hidden="true" />
          *Illustrative prototype advisory lines reference NASA-STD-3001 concepts; they are not official clinical thresholds.
        </div>
      </div>
    </section>
  )
}
