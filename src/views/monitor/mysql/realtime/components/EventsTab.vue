<template>
  <div class="events-tab">

    <!-- ① 风险处置摘要 -->
    <div class="section">
      <div class="section-header">
        <el-icon class="icon-danger"><Warning /></el-icon>
        <span class="section-title">风险处置摘要</span>
        <el-tag
          v-if="criticalCount > 0"
          type="danger"
          size="small"
          style="margin-left:8px"
        >{{ criticalCount }} 项需立即处理</el-tag>
        <el-button
          link size="small"
          style="margin-left:auto"
          :loading="loading"
          @click="loadEvents"
        >刷新</el-button>
      </div>

      <el-empty
        v-if="!loading && riskCards.length === 0"
        description="当前无需处理的风险项"
        :image-size="64"
      />

      <el-row v-else :gutter="12">
        <el-col
          v-for="card in riskCards"
          :key="card.eventCode"
          :span="12"
          style="margin-bottom:12px"
        >
          <div class="risk-card" :class="`risk-card--${card.level}`">
            <div class="risk-card-head">
              <span class="risk-card-title">{{ card.title }}</span>
              <DictTag dict="alert_level" :value="card.level" />
            </div>
            <div class="risk-card-desc">{{ card.desc }}</div>
            <div class="risk-card-tags">
              <el-tag
                v-for="tag in card.tags"
                :key="tag"
                size="small"
                effect="plain"
              >{{ tag }}</el-tag>
            </div>
            <div class="risk-card-suggest">建议：{{ card.suggest }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- ② 当前未恢复事件 -->
    <div class="section" v-loading="loading">
      <div class="section-header">
        <el-icon class="icon-warning"><Bell /></el-icon>
        <span class="section-title">当前未恢复事件</span>
        <el-tag
          :type="activeEvents.length > 0 ? 'warning' : 'success'"
          size="small"
          style="margin-left:8px"
        >{{ activeEvents.length }} 条</el-tag>
      </div>

      <el-empty
        v-if="!loading && activeEvents.length === 0"
        description="当前实例无未恢复事件"
        :image-size="64"
      />

      <el-table
        v-else
        :data="activeEvents"
        style="width:100%"
        stripe
      >
        <el-table-column label="级别" width="80">
          <template #default="{ row }">
            <DictTag dict="alert_level" :value="row.ruleLevel" />
          </template>
        </el-table-column>
        <el-table-column prop="ruleName" label="告警规则" min-width="160" show-overflow-tooltip />
        <el-table-column label="告警信息" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="event-msg">{{ buildMessage(row as AlertEventVo) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="当前值" width="110" align="right">
          <template #default="{ row }">
            <!-- 布尔型规则事件的 0/1 触发值无业务含义，展示状态化文案 -->
            <span class="val-danger">{{
              (row as AlertEventVo).booleanCondition
                ? ((row as AlertEventVo).status === 'recovered' ? '已恢复' : '异常')
                : ((row as AlertEventVo).triggerValue ?? '-')
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="持续时间" width="110">
          <template #default="{ row }">{{ fmtDuration(row.durationSeconds) }}</template>
        </el-table-column>
        <el-table-column prop="triggerTime" label="触发时间" width="165" show-overflow-tooltip />
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goToAlert(row as AlertEventVo)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Warning, Bell } from '@element-plus/icons-vue'
import { pageAlertEvents } from '@/api/metric'
import DictTag from '@/components/DictTag.vue'
import { fmtDurationCn as fmtDuration } from '@/utils/format'
import type { AlertEventVo } from '@/types/monitor'

const props = defineProps<{ instanceId: number }>()
const router = useRouter()

const loading = ref(false)
const activeEvents = ref<AlertEventVo[]>([])
// alert_level 字典由 DictTag 组件内部加载

// ── 级别映射 ───────────────────────────────────────────────────────────────
const LEVEL_MAP = {
  level_1: { label: '一级', tag: 'danger'  as const },
  level_2: { label: '二级', tag: 'warning' as const },
  level_3: { label: '三级', tag: 'primary' as const },
  level_4: { label: '四级', tag: 'info'    as const }
} as const
type Level = keyof typeof LEVEL_MAP

// ── 告警信息合成 ────────────────────────────────────────────────────────────
// 优先展示事件落库的告警文案（含布尔型规则的状态化描述），
// 缺失时才回落到"当前值/阈值"数值拼接
function buildMessage(row: AlertEventVo) {
  if (row.alertMessage?.trim()) return row.alertMessage.trim()
  const parts: string[] = []
  if (row.triggerValue  != null) parts.push(`当前值 ${row.triggerValue}`)
  if (row.thresholdValue != null) parts.push(`阈值 ${row.thresholdValue}`)
  if (row.dimensionKey)          parts.push(`(${row.dimensionKey})`)
  return parts.length ? parts.join('，') : '—'
}

/** 跳转告警下钻页查看该事件详情（与告警中心的下钻入口一致） */
function goToAlert(row: AlertEventVo) {
  router.push({ path: '/monitor/mysql/alert/drilldown', query: { eventId: row.id } })
}

// ── 风险处置摘要（从活跃事件派生） ─────────────────────────────────────────
interface RiskCard {
  eventCode: string; level: Level; title: string
  desc: string; tags: string[]; suggest: string
}

const LEVEL_ORDER: Record<string, number> = { level_1: 0, level_2: 1, level_3: 2, level_4: 3 }

// 不同 ruleLevel 配置
const LEVEL_SUGGEST: Record<string, string> = {
  level_1: '请立即联系 DBA 排查，避免业务中断',
  level_2: '建议尽快排查，可能影响业务稳定性',
  level_3: '建议关注并适时优化，防止升级为严重问题',
  level_4: '仅供参考，无需立即处理'
}
const LEVEL_TAGS: Record<string, string[]> = {
  level_1: ['紧急', '业务影响'],
  level_2: ['需关注', '影响性能'],
  level_3: ['建议优化'],
  level_4: ['提示']
}

const riskCards = computed<RiskCard[]>(() => {
  if (activeEvents.value.length === 0) return []
  // 去重：每条规则只展示一张卡
  const seen = new Set<number>()
  const cards: RiskCard[] = []
  const sorted = [...activeEvents.value].sort(
    (a, b) => (LEVEL_ORDER[a.ruleLevel] ?? 9) - (LEVEL_ORDER[b.ruleLevel] ?? 9)
  )
  for (const ev of sorted) {
    if (seen.has(ev.ruleId)) continue
    seen.add(ev.ruleId)
    const lv = ev.ruleLevel as Level
    cards.push({
      eventCode: `${ev.ruleId}`,
      level:     lv,
      title:     ev.ruleName,
      desc:      buildMessage(ev),
      tags:      LEVEL_TAGS[lv] ?? [],
      suggest:   LEVEL_SUGGEST[lv] ?? '请关注并及时处理'
    })
    if (cards.length >= 6) break  // 最多展示 6 张
  }
  return cards
})

const criticalCount = computed(() =>
  activeEvents.value.filter(e => e.ruleLevel === 'level_1' || e.ruleLevel === 'level_2').length
)

// ── 数据加载 ───────────────────────────────────────────────────────────────
async function loadEvents() {
  if (!props.instanceId) return
  loading.value = true
  try {
    const r = await pageAlertEvents({
      instanceId: props.instanceId,
      statuses: ['pending', 'confirmed', 'handling'],
      pageNum: 1,
      pageSize: 20
    })
    activeEvents.value = (r.list ?? []).sort(
      (a, b) => (LEVEL_ORDER[a.ruleLevel] ?? 9) - (LEVEL_ORDER[b.ruleLevel] ?? 9)
    )
  } finally {
    loading.value = false
  }
}

watch(() => props.instanceId, loadEvents, { immediate: true })
</script>

<style scoped>
.events-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0;
}

/* Section */
.section { display: flex; flex-direction: column; gap: 12px; }
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.icon-danger  { color: #E5484D; font-size: 18px; }
.icon-warning { color: #E08600; font-size: 18px; }

/* 风险卡片 */
.risk-card {
  padding: 14px 16px;
  border-radius: var(--radius-base);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-left-width: 4px;
  transition: box-shadow .15s;
}
.risk-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.risk-card--fatal,
.risk-card--critical { border-color: #fde2e2; border-left-color: #E5484D; background: #fff8f8; }
.risk-card--warning  { border-color: #fdf6ec; border-left-color: #E08600; background: #fffdf7; }
.risk-card--info     { border-color: #d9ecff; border-left-color: #2D7FF0; background: #f5f9ff; }

.risk-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.risk-card-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.risk-card-desc {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  line-height: 1.5;
}
.risk-card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.risk-card-suggest {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

/* 表格 */
.event-msg { color: var(--el-text-color-regular); font-size: 12px; }
.val-danger { font-weight: 600; color: #E5484D; }
</style>
