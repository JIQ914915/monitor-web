<template>
  <div class="dashboard" v-loading="loading">
    <!-- 整体健康总览（门面区，§11.1.2）：聚合健康分 + 五维构成 + 一句话风险解读 -->
    <el-card class="hero" shadow="never">
      <div class="hero-inner">
        <div class="hero-gauge">
          <HealthGauge :value="gaugeValue" :size="140" :stroke="12" />
          <div class="hero-caption">整体健康</div>
        </div>
        <div class="hero-readout">
          <div class="hero-headline">
            <span class="hero-level" :style="{ color: levelColor(overview?.healthLevel) }">
              {{ levelLabel(overview?.healthLevel) }}
            </span>
            <span class="hero-scope" v-if="overview && overview.scoredCount > 0">
              基于 {{ overview.scoredCount }} 个实例综合评估
            </span>
          </div>
          <p class="hero-sentence">{{ riskSentence }}</p>
          <div class="hero-dims">
            <div v-for="d in dims" :key="d.key" class="dim-row">
              <span class="dim-label">{{ d.label }}</span>
              <span class="dim-track">
                <span
                  class="dim-fill"
                  :style="{ width: (d.rate < 0 ? 0 : d.rate) + '%', background: dimColor(d.rate) }"
                />
              </span>
              <span class="dim-val" :style="{ color: dimColor(d.rate) }">
                {{ d.rate < 0 ? '--' : d.rate }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 实例状态汇总：5 张统计卡（迷你趋势线为近 7 天走向） -->
    <div class="stat-cards">
      <StatCard label="实例总数" :value="overview?.total" tone="var(--signal)">
        <template #sub>
          较昨日
          <span :class="totalDelta > 0 ? 'sc-up' : totalDelta < 0 ? 'sc-down' : ''">
            {{ totalDelta > 0 ? `+${totalDelta}` : totalDelta < 0 ? totalDelta : '持平' }}
          </span>
        </template>
        <SparkLine v-if="trends" class="sc-spark" :data="trends.total" color="var(--signal)" />
      </StatCard>
      <StatCard label="正常实例" :value="overview?.normal" :sub="`占比 ${pct(overview?.normal)}`" tone="var(--sev-ok)">
        <SparkLine v-if="trends" class="sc-spark" :data="trends.normal" color="var(--sev-ok)" />
      </StatCard>
      <StatCard label="告警实例" :value="overview?.alert" sub="需关注" tone="var(--sev-warn)">
        <SparkLine v-if="trends" class="sc-spark" :data="trends.alert" color="var(--sev-warn)" />
      </StatCard>
      <StatCard label="异常实例" :value="overview?.abnormal" sub="需处理" tone="var(--sev-crit)">
        <SparkLine v-if="trends" class="sc-spark" :data="trends.abnormal" color="var(--sev-crit)" />
      </StatCard>
      <StatCard label="离线实例" :value="overview?.paused" sub="已暂停采集" tone="var(--sev-offline)">
        <SparkLine v-if="trends" class="sc-spark" :data="trends.paused" color="var(--sev-offline)" />
      </StatCard>
    </div>

    <!-- 数据库类型分布 -->
    <el-card class="section-card" shadow="never">
      <template #header>数据库类型分布</template>
      <el-empty v-if="!dbTypes.length" description="暂无纳管实例" :image-size="72" />
      <div v-else class="type-grid">
        <div v-for="t in dbTypes" :key="t.name" class="type-card">
          <div class="type-head">
            <span class="type-badge" :style="{ background: typeColor(t.name) }">
              {{ t.name.slice(0, 2).toUpperCase() }}
            </span>
            <div class="type-meta">
              <div class="type-name">{{ t.name }}</div>
              <div class="type-count">共 {{ t.total }} 个实例</div>
            </div>
          </div>
          <div class="type-status">
            <span class="ts-item ts-ok">正常 {{ t.normal }}</span>
            <span class="ts-item ts-warn">告警 {{ t.alert }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 高风险实例 Top10 -->
    <el-card class="section-card" shadow="never">
      <template #header>高风险实例 Top 10</template>
      <el-empty
        v-if="!topRisk.length"
        description="当前没有高风险实例，实例池运行良好"
        :image-size="72"
      />
      <el-table v-else :data="topRisk" stripe>
        <el-table-column label="#" width="48" align="center">
          <template #default="{ $index }">
            <span class="rank" :class="rankClass($index)">{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="实例名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="数据库类型" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ row.dbType || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dbVersion" label="版本" width="80">
          <template #default="{ row }">{{ row.dbVersion || '-' }}</template>
        </el-table-column>
        <el-table-column label="主机" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.host }}:{{ row.port }}</template>
        </el-table-column>
        <el-table-column label="所属分组" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.groupNames?.length ? row.groupNames.join('、') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="130">
          <template #default="{ row }">
            <div class="owner-line">
              <el-tag size="small" type="primary">A</el-tag>
              <span>{{ row.ownerAName || '-' }}</span>
            </div>
            <div v-if="row.ownerBName" class="owner-line">
              <el-tag size="small" type="info">B</el-tag>
              <span>{{ row.ownerBName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <DictTag dict="instance_status" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="健康评分" width="90" align="center">
          <template #default="{ row }">
            <HealthGauge :value="row.health ?? NaN" :size="46" :show-label="false" />
          </template>
        </el-table-column>
        <el-table-column label="活跃告警" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.activeAlerts > 0" type="danger" size="small">{{ row.activeAlerts }}</el-tag>
            <span v-else class="dim-text">0</span>
          </template>
        </el-table-column>
        <el-table-column label="风险等级" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="dark" :type="riskTag(row as FleetRiskInstance)">
              {{ riskLabel(row as FleetRiskInstance) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="viewInstance(row as FleetRiskInstance)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import HealthGauge from '@/components/HealthGauge.vue'
import SparkLine from '@/components/SparkLine.vue'
import StatCard from '@/components/StatCard.vue'
import DictTag from '@/components/DictTag.vue'
import {
  getFleetOverview,
  getInstance,
  type FleetOverview,
  type FleetRiskInstance
} from '@/api/instance'
import { useDict } from '@/composables/useDict'
import { useInstanceStore } from '@/stores/instance'
import { getRealtimePath } from '@/utils/instanceMenu'

const router = useRouter()
const instanceStore = useInstanceStore()
const { getDictLabel } = useDict('health_level')

const loading = ref(false)
const overview = ref<FleetOverview>()

const dims = computed(() => overview.value?.dims ?? [])
const trends = computed(() => overview.value?.trends)
/** 实例总数较昨日增减（趋势末两位差值） */
const totalDelta = computed(() => {
  const t = trends.value?.total
  if (!t || t.length < 2) return 0
  return t[t.length - 1] - t[t.length - 2]
})
const dbTypes = computed(() => overview.value?.dbTypes ?? [])
const topRisk = computed(() => overview.value?.topRisk ?? [])
const gaugeValue = computed(() =>
  overview.value && overview.value.avgHealth >= 0 ? overview.value.avgHealth : NaN
)

/** 一句话风险解读：让非专业用户直接得到结论（小白友好原则） */
const riskSentence = computed(() => {
  const o = overview.value
  if (!o || o.total === 0) return '尚未纳管任何数据库实例，请先在实例管理中添加实例。'
  if (o.avgHealth < 0) return '实例暂无健康评分数据，请检查采集任务与健康评分作业是否正常运行。'
  const parts: string[] = []
  if (o.abnormal > 0) parts.push(`${o.abnormal} 个实例连接异常`)
  if (o.alert > 0) parts.push(`${o.alert} 个实例存在未恢复告警`)
  const worst = [...(o.dims ?? [])].filter((d) => d.rate >= 0).sort((a, b) => a.rate - b.rate)[0]
  if (parts.length === 0) {
    return worst && worst.rate < 90
      ? `全部实例运行正常，${worst.label}维度得分相对偏低（${worst.rate} 分），可留意相关指标走势。`
      : '全部实例运行正常，各维度状态良好。'
  }
  let s = parts.join('，')
  if (worst && worst.rate < 80) s += `；${worst.label}维度达标率最低（${worst.rate} 分）`
  return s + '，建议优先处理下方高风险实例。'
})

const LEVEL_COLOR: Record<string, string> = {
  excellent: 'var(--status-excellent)',
  good: 'var(--signal)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)'
}
const levelColor = (lv?: string) => (lv && LEVEL_COLOR[lv]) || 'var(--faint)'
const levelLabel = (lv?: string) => (lv ? getDictLabel('health_level', lv) || lv : '--')

function dimColor(rate: number) {
  if (rate < 0) return 'var(--faint)'
  if (rate >= 90) return 'var(--status-excellent)'
  if (rate >= 75) return 'var(--signal)'
  if (rate >= 60) return 'var(--status-warning)'
  return 'var(--status-critical)'
}

function pct(n?: number) {
  const o = overview.value
  if (!o || !o.total || n === undefined) return '--'
  return ((n / o.total) * 100).toFixed(1) + '%'
}

/** 数据库品牌色徽章（§11.1.3 类型配色约定） */
const TYPE_COLOR: Record<string, string> = {
  mysql: '#409EFF',
  postgresql: '#67C23A',
  oracle: '#E6A23C'
}
const typeColor = (name: string) => TYPE_COLOR[name.toLowerCase()] ?? '#909399'

const rankClass = (i: number) => (i < 3 ? 'rank-top' : i < 6 ? 'rank-mid' : 'rank-rest')

/** 风险等级：由健康等级与状态派生（连接异常/严重=严重，警告=预警，其余=关注） */
function riskLabel(row: FleetRiskInstance) {
  if (row.status === 'abnormal' || row.healthLevel === 'critical') return '严重'
  if (row.healthLevel === 'warning') return '预警'
  return '关注'
}
function riskTag(row: FleetRiskInstance): 'danger' | 'warning' | 'info' {
  const label = riskLabel(row)
  return label === '严重' ? 'danger' : label === '预警' ? 'warning' : 'info'
}

/** 查看：携带明确 instanceId 进入实时概况（§11.1.4 视角切换约定） */
async function viewInstance(row: FleetRiskInstance) {
  try {
    const ins = await getInstance(row.id)
    if (!ins) {
      ElMessage.warning('实例不存在或已被删除')
      return
    }
    instanceStore.setCurrent(ins)
    const path = getRealtimePath(ins.dbType)
    if (!path) {
      ElMessage.warning(`暂不支持数据库类型：${ins.dbType || '未配置'}`)
      return
    }
    router.push(path)
  } catch {
    ElMessage.error('打开实例失败，请稍后重试')
  }
}

onMounted(async () => {
  loading.value = true
  try {
    overview.value = await getFleetOverview()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--density-gap);
}

/* ── 整体健康门面 ─────────────────────────────── */
/* 左侧 4px 信号色竖条，与下方状态统计卡视觉呼应 */
.hero {
  border-left: 4px solid var(--signal);
  border-radius: var(--radius-base);
}
.hero-inner {
  display: flex;
  align-items: center;
  gap: 48px;
  flex-wrap: wrap;
}
.hero-gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: none;
}
.hero-caption {
  color: var(--muted);
  font-size: 13px;
}
.hero-readout {
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hero-headline {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.hero-level {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 700;
}
.hero-scope {
  color: var(--muted);
  font-size: 13px;
}
.hero-sentence {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.6;
}
.hero-dims {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 6px 28px;
  max-width: 760px;
}
.dim-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dim-label {
  width: 56px;
  flex: none;
  color: var(--muted);
  font-size: 13px;
}
.dim-track {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--track);
  overflow: hidden;
}
.dim-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.dim-val {
  width: 30px;
  flex: none;
  text-align: right;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

/* ── 5 张状态统计卡（公共 StatCard 组件 + 迷你趋势线）── */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--density-gap);
}
.sc-spark {
  position: absolute;
  right: 16px;
  bottom: 14px;
  pointer-events: none;
}
.sc-up   { color: var(--sev-ok); }
.sc-down { color: var(--sev-crit); }

/* ── 数据库类型分布 ───────────────────────────── */
.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--density-gap);
}
.type-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  padding: 16px;
  background: var(--el-fill-color-light);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.type-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.type-badge {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  flex: none;
}
.type-name {
  font-weight: 600;
  font-size: 15px;
}
.type-count {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}
.type-status {
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.ts-item {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}
.ts-ok {
  color: var(--sev-ok);
  background: rgba(21, 163, 106, 0.1);
}
.ts-warn {
  color: var(--sev-warn);
  background: rgba(224, 134, 0, 0.1);
}

/* ── 高风险实例 Top10 ─────────────────────────── */
.rank {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.rank-top  { color: var(--sev-crit); }
.rank-mid  { color: var(--sev-warn); }
.rank-rest { color: var(--sev-offline); }
.owner-line {
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.7;
}
.dim-text {
  color: var(--faint);
}
</style>
