<template>
  <div class="host-tab">
    <!-- 未关联主机引导 -->
    <el-empty
      v-if="!hostId"
      description="该实例尚未关联主机，关联后可查看 CPU / 内存 / 磁盘等主机资源指标"
      :image-size="72"
    >
      <div class="empty-tip">请在「系统设置 → 实例管理」编辑实例，选择所在主机</div>
    </el-empty>

    <template v-else>
      <!-- ① 主机状态卡片 -->
      <el-card shadow="never" v-loading="loadingLatest">
        <template #header>
          <div class="card-header-row">
            <span class="card-title">
              主机资源概况
              <el-tag v-if="hostName" size="small" effect="plain" style="margin-left: 8px">{{ hostName }}</el-tag>
              <el-tag size="small" effect="plain" type="info" style="margin-left: 6px">{{ isWindows ? 'Windows' : 'Linux' }}</el-tag>
              <el-tag
                v-if="latest['host.availability'] != null"
                size="small"
                :type="latest['host.availability'] === 1 ? 'success' : 'danger'"
                style="margin-left: 6px"
              >{{ latest['host.availability'] === 1 ? '主机可达' : '主机不可达' }}</el-tag>
            </span>
            <div>
              <span v-if="latest['host.uptime'] != null" class="uptime-text">已运行 {{ fmtUptime(latest['host.uptime']!) }}</span>
              <el-button size="small" @click="loadAll">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
          </div>
        </template>
        <el-empty
          v-if="!hasAnyData && !loadingLatest"
          description="暂无主机指标数据（请确认主机 exporter 采集已配置并正常运行）"
          :image-size="56"
        />
        <div v-else class="gauge-grid">
          <div v-for="g in gauges" :key="g.key" class="gauge-item" :class="{ 'gauge-item--warn': g.warn }">
            <div class="gauge-label">{{ g.label }}</div>
            <div class="gauge-val-row">
              <span class="gauge-val" :style="{ color: g.warn ? '#E5484D' : undefined }">{{ g.text }}</span>
              <el-progress
                v-if="g.percent != null"
                :percentage="Math.min(100, g.percent)"
                :color="g.warn ? '#E5484D' : '#15A36A'"
                :stroke-width="6" :show-text="false"
                style="flex: 1; margin-left: 10px"
              />
            </div>
            <div v-if="g.sub" class="gauge-sub">{{ g.sub }}</div>
          </div>
        </div>
      </el-card>

      <!-- ② 资源 24h 趋势 -->
      <el-card shadow="never">
        <template #header><span class="card-title">资源趋势（近 24 小时）</span></template>
        <div class="trend-grid">
          <TrendChart title="CPU 使用率" :data="trends.cpu" unit="%" color="#0C7C97" :loading="loadingTrend"
            tip="两次采样间 CPU 非空闲时间占比，持续高于 90% 说明主机算力吃紧" />
          <TrendChart title="内存使用率" :data="trends.mem" unit="%" color="#15A36A" :loading="loadingTrend"
            :tip="isWindows ? '1 - 可用内存/物理内存总量' : '1 - 可用内存/总内存，基于内核 MemAvailable 估算'" />
          <TrendChart v-if="!isWindows" title="CPU IOWait" :data="trends.third" unit="%" color="#E08600" :loading="loadingTrend"
            tip="CPU 处于 IO 等待的时间占比，持续偏高说明磁盘是瓶颈" />
          <TrendChart
            :class="{ 'trend-wide': !isWindows }"
            title="磁盘 IO 繁忙度"
            :series="diskIoSeries"
            unit="%"
            :loading="loadingTrend"
            :tip="isWindows ? '各盘符 IO 繁忙时间占比（每盘一条线），持续偏高说明该盘是瓶颈' : '各块设备 IO 繁忙时间占比（每盘一条线），持续偏高说明该盘是瓶颈'"
          />
          <TrendChart
            class="trend-wide"
            title="磁盘读写速率"
            :series="diskIoRateSeries"
            value-format="bytes"
            unit="/s"
            :loading="loadingTrend"
            tip="各盘每秒读写字节数（每盘读/写各一条线），突增通常对应备份、大批量导入导出或临时表落盘"
          />
          <TrendChart
            class="trend-wide"
            title="网络流量"
            :series="netSeries"
            value-format="bytes"
            unit="/s"
            :loading="loadingTrend"
            tip="全部物理网卡每秒收发字节数（排除回环），突增通常对应大批量查询、备份或数据同步"
          />
        </div>
      </el-card>

      <!-- ③ 磁盘挂载点/盘符明细 -->
      <el-card shadow="never" v-loading="loadingLatest">
        <template #header><span class="card-title">{{ isWindows ? '磁盘盘符' : '磁盘挂载点' }}</span></template>
        <el-empty v-if="!mountRows.length && !loadingLatest" :description="isWindows ? '暂无盘符数据' : '暂无挂载点数据'" :image-size="56" />
        <ProTable
          v-else
          :data="mountRows"
          :columns="mountColumns"
          :show-toolbar="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
        >
          <template #col-mount="{ row }">
            <span class="mount-name">{{ row.mount }}</span>
            <el-tag v-if="row.readonly" size="small" type="danger" style="margin-left: 6px">只读</el-tag>
          </template>
          <template #col-total="{ row }">{{ fmtBytes(row.totalBytes) }}</template>
          <template #col-avail="{ row }">{{ fmtBytes(row.availBytes) }}</template>
          <template #col-usage="{ row }">
            <div class="usage-cell">
              <el-progress
                :percentage="Math.min(100, row.usagePercent)"
                :color="row.usagePercent >= 85 ? '#E5484D' : row.usagePercent >= 70 ? '#E08600' : '#15A36A'"
                :stroke-width="6" :show-text="false"
                style="flex: 1"
              />
              <span class="usage-text" :style="{ color: row.usagePercent >= 85 ? '#E5484D' : undefined }">
                {{ row.usagePercent.toFixed(1) }}%
              </span>
            </div>
          </template>
          <template #col-inode="{ row }">
            <span v-if="row.inodeUsagePercent != null">{{ row.inodeUsagePercent.toFixed(1) }}%</span>
            <span v-else class="muted">-</span>
          </template>
        </ProTable>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import TrendChart from '@/components/TrendChart.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { getHostDiskIoTrend, getMetricLatest, getMetricTextLatest, getPerfTrendBatch, type HostDiskIoTrendVo } from '@/api/metric'
import type { TrendPoint } from '@/types/monitor'

const props = defineProps<{ instanceId: number; hostId?: number | null; hostName?: string; hostOsType?: string }>()

const isWindows = computed(() => props.hostOsType === 'windows')

const loadingLatest = ref(false)
const loadingTrend = ref(false)

const LATEST_CODES = [
  'host.availability', 'host.uptime',
  'host.cpu.usage', 'host.cpu.iowait', 'host.load.load1', 'host.load.per_core',
  'host.mem.usage', 'host.mem.available_bytes', 'host.swap.usage',
  'host.disk.usage_max', 'host.disk.inode_usage_max', 'host.disk.readonly_count'
]

const latest = ref<Record<string, number | null>>({})
const hasAnyData = computed(() => Object.values(latest.value).some((v) => v != null))

interface MountRow {
  mount: string
  fstype?: string
  totalBytes: number
  availBytes: number
  usagePercent: number
  inodeUsagePercent: number | null
  readonly: boolean
}
const mountRows = ref<MountRow[]>([])

const mountColumns = computed<TableColumn[]>(() => {
  const cols: TableColumn[] = [
    { prop: 'mount', label: isWindows.value ? '盘符' : '挂载点', minWidth: 160, slot: 'col-mount', showOverflowTooltip: false },
    { prop: 'fstype', label: '文件系统', width: 100 },
    { prop: 'totalBytes', label: '总容量', minWidth: 100, align: 'right', slot: 'col-total' },
    { prop: 'availBytes', label: '可用', minWidth: 100, align: 'right', slot: 'col-avail' },
    { prop: 'usagePercent', label: '空间使用率', minWidth: 180, slot: 'col-usage', showOverflowTooltip: false },
  ]
  if (!isWindows.value) {
    // Windows 无 inode 概念，不展示该列
    cols.push({ prop: 'inodeUsagePercent', label: 'Inode', width: 90, align: 'center', slot: 'col-inode', showOverflowTooltip: false })
  }
  return cols
})

interface Gauge {
  key: string
  label: string
  text: string
  percent: number | null
  warn: boolean
  sub?: string
}

const gauges = computed<Gauge[]>(() => {
  const v = latest.value
  const win = isWindows.value
  const items: Gauge[] = []
  items.push(pct('cpu', 'CPU 使用率', v['host.cpu.usage'], 90,
    !win && v['host.cpu.iowait'] != null ? `IOWait ${v['host.cpu.iowait']!.toFixed(1)}%` : undefined))
  items.push(pct('mem', '内存使用率', v['host.mem.usage'], 90,
    v['host.mem.available_bytes'] != null ? `可用 ${fmtBytes(v['host.mem.available_bytes']!)}` : undefined))
  // Windows 无 Linux 语义的 Swap / load average，不展示对应卡片
  if (!win) {
    items.push(pct('swap', 'Swap 使用率', v['host.swap.usage'], 30))
  }
  items.push(pct('disk', '磁盘使用率（最高）', v['host.disk.usage_max'], 85,
    !win && v['host.disk.inode_usage_max'] != null ? `Inode 最高 ${v['host.disk.inode_usage_max']!.toFixed(1)}%` : undefined))
  // 磁盘 IO 信息由按盘趋势图与 IO 明细表承载，概况区不再重复展示汇总卡片
  if (!win) {
    items.push({
      key: 'load',
      label: '系统负载（load1）',
      text: v['host.load.load1'] != null ? v['host.load.load1']!.toFixed(2) : '-',
      percent: null,
      warn: (v['host.load.per_core'] ?? 0) >= 2,
      sub: v['host.load.per_core'] != null ? `单核负载 ${v['host.load.per_core']!.toFixed(2)}` : undefined
    })
  }
  return items
})

function pct(key: string, label: string, value: number | null | undefined, warnAt: number, sub?: string): Gauge {
  return {
    key,
    label,
    text: value != null ? `${value.toFixed(1)}%` : '-',
    percent: value ?? null,
    warn: value != null && value >= warnAt,
    sub
  }
}

// ===== 趋势 =====
// 第三张图按操作系统类型切换：Linux 展示 CPU IOWait，Windows 展示磁盘 IO 繁忙度
const trends = ref<{ cpu: TrendPoint[]; mem: TrendPoint[]; third: TrendPoint[]; netRecv: TrendPoint[]; netSend: TrendPoint[] }>({
  cpu: [], mem: [], third: [], netRecv: [], netSend: []
})

const netSeries = computed(() => [
  { name: '入流量', color: '#0C7C97', data: trends.value.netRecv },
  { name: '出流量', color: '#7C5CD6', data: trends.value.netSend }
])

// 按盘 IO 趋势（繁忙度每盘一条线；读写速率每盘两条线）
const DISK_PALETTE = ['#0C7C97', '#E08600', '#15A36A', '#7C5CD6', '#D6409F', '#5C7CFA', '#E5484D', '#8B8D98']
const diskIoTrendRaw = ref<HostDiskIoTrendVo['devices']>([])

const diskIoSeries = computed(() =>
  diskIoTrendRaw.value.map((d, i) => ({
    name: d.device,
    color: DISK_PALETTE[i % DISK_PALETTE.length],
    data: d.util
  }))
)

// 读用实线主色、写用同盘错位配色，名称带方向前缀便于 tooltip 区分
const diskIoRateSeries = computed(() =>
  diskIoTrendRaw.value.flatMap((d, i) => [
    { name: `读 ${d.device}`, color: DISK_PALETTE[(i * 2) % DISK_PALETTE.length], data: d.read },
    { name: `写 ${d.device}`, color: DISK_PALETTE[(i * 2 + 1) % DISK_PALETTE.length], data: d.write }
  ])
)

async function loadTrend() {
  loadingTrend.value = true
  try {
    const to = Date.now()
    const from = to - 24 * 3600 * 1000
    const [batchRes, diskIoRes] = await Promise.allSettled([
      getPerfTrendBatch({
        instanceId: props.instanceId,
        metricCodes: ['host.cpu.usage', 'host.mem.usage', 'host.cpu.iowait', 'host.net.recv_bytes', 'host.net.send_bytes'],
        from, to, frequency: '1m'
      }),
      getHostDiskIoTrend({ instanceId: props.instanceId, from, to })
    ])
    const byCode: Record<string, TrendPoint[]> = {}
    if (batchRes.status === 'fulfilled') {
      for (const s of batchRes.value.series ?? []) byCode[s.metricCode] = s.points ?? []
    }
    trends.value = {
      cpu: byCode['host.cpu.usage'] ?? [],
      mem: byCode['host.mem.usage'] ?? [],
      third: byCode['host.cpu.iowait'] ?? [],
      netRecv: byCode['host.net.recv_bytes'] ?? [],
      netSend: byCode['host.net.send_bytes'] ?? []
    }
    diskIoTrendRaw.value = diskIoRes.status === 'fulfilled' ? (diskIoRes.value.devices ?? []) : []
  } finally {
    loadingTrend.value = false
  }
}

// ===== 加载 =====
async function loadAll() {
  if (!props.instanceId || !props.hostId) return
  loadingLatest.value = true
  try {
    const [latestRes, textRes] = await Promise.allSettled([
      getMetricLatest(props.instanceId, LATEST_CODES),
      getMetricTextLatest(props.instanceId, ['host.disk.mount_detail'], '1m')
    ])
    latest.value = latestRes.status === 'fulfilled' ? (latestRes.value.values ?? {}) : {}
    mountRows.value = textRes.status === 'fulfilled'
      ? parseJsonRows<MountRow>(textRes.value.values?.['host.disk.mount_detail'])
      : []
  } finally {
    loadingLatest.value = false
  }
  loadTrend()
}

function parseJsonRows<T>(raw?: string | null): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '-'
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return Math.round(b) + ' B'
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d} 天 ${h} 小时`
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} 小时 ${m} 分钟` : `${m} 分钟`
}

watch(() => [props.instanceId, props.hostId], loadAll, { immediate: true })
</script>

<style scoped>
.host-tab { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
.card-header-row { display: flex; align-items: center; justify-content: space-between; }
.uptime-text { font-size: 12px; color: var(--el-text-color-secondary); margin-right: 12px; }
.empty-tip { font-size: 13px; color: var(--el-text-color-secondary); }
.muted { color: var(--el-text-color-placeholder); font-size: 13px; }

.gauge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.gauge-item {
  padding: 14px 16px;
  border-radius: var(--radius-base, 8px);
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-extra-light);
}
.gauge-item--warn { border-color: #fde2e2; background: #fff8f8; }
.gauge-label { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.gauge-val-row { display: flex; align-items: center; }
.gauge-val { font-size: 18px; font-weight: 700; color: var(--el-text-color-primary); line-height: 1.2; }
.gauge-sub { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px; }

.trend-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.trend-wide {
  grid-column: 1 / -1;
}

.mount-name { font-weight: 500; }
.usage-cell { display: flex; align-items: center; gap: 8px; }
.usage-text { font-size: 13px; min-width: 48px; text-align: right; }
</style>
