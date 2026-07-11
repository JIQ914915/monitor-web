import type { DrilldownMetric } from './alertDrilldown'

// Compile-time regression: database-driven drilldown metrics may declare their storage frequency.
const hourlyMetric: DrilldownMetric = {
  code: 'pg.capacity.total_size_bytes',
  label: '实例总容量',
  unit: 'GB',
  color: '#15A36A',
  frequency: '1h'
}

void hourlyMetric
