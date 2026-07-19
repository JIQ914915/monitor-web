<template>
  <div class="inst-banner" :style="{ '--accent': accentColor }">

    <!-- ① 左侧：类型徽章 + 实例名 + 类型/版本 + 状态 -->
    <div class="ib-identity">
      <div class="ib-badge" :style="{ background: badgeGradient }">
        {{ dbTypeAbbr }}
      </div>
      <div class="ib-title">
        <div class="ib-name">{{ inst.name }}</div>
        <div class="ib-sub">
          <span class="ib-type-text">{{ inst.dbType || '未知类型' }} {{ inst.dbVersion }}</span>
          <span class="ib-status-dot" :class="statusDotClass" />
          <span class="ib-status-text" :class="statusTextClass">{{ statusLabel }}</span>
        </div>
      </div>
    </div>

    <div class="ib-divider" />

    <!-- ② 主机地址 -->
    <div class="ib-prop">
      <div class="ib-prop-label">主机地址</div>
      <div class="ib-prop-val mono">{{ inst.host }}:{{ inst.port }}</div>
    </div>

    <div class="ib-divider" />

    <!-- ③ 负责人 -->
    <div class="ib-prop">
      <div class="ib-prop-label">负责人</div>
      <div class="ib-prop-val">
        <span v-if="ownerAName">A：{{ ownerAName }}</span>
        <span v-if="ownerBName" class="owner-b">B：{{ ownerBName }}</span>
        <span v-if="!ownerAName && !ownerBName" class="muted">未设置</span>
      </div>
    </div>

    <div class="ib-divider" />

    <!-- ④ 所属分组 -->
    <div class="ib-prop">
      <div class="ib-prop-label">所属分组</div>
      <div class="ib-prop-val">
        <span v-if="groupName">{{ groupName }}</span>
        <span v-else class="muted">未分配</span>
      </div>
    </div>

    <div class="ib-divider" />

    <!-- ⑤ 监控采集 -->
    <div class="ib-prop">
      <div class="ib-prop-label">监控采集</div>
      <div class="ib-prop-val ib-monitor">
        <el-switch
          :model-value="inst.status !== 'paused'"
          size="small"
          @change="handleToggle"
        />
        <span :class="inst.status !== 'paused' ? 'ib-on' : 'ib-off'">
          {{ inst.status !== 'paused' ? '已启用' : '已停用' }}
        </span>
      </div>
    </div>

    <!-- ⑥ 右侧：健康评分 -->
    <div class="ib-health" @click="emit('openHealth')">
      <HealthGauge :value="score" :size="64" :stroke="6" :show-label="false" />
      <div class="ib-score-meta">
        <span class="ib-score-lbl">健康评分</span>
        <DictTag dict="health_level" :value="healthLevel" size="small" effect="dark" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DictTag from '@/components/DictTag.vue'
import HealthGauge from '@/components/HealthGauge.vue'
import type { DbInstance } from '@/types'

const props = defineProps<{
  inst: DbInstance
  ownerAName?: string
  ownerBName?: string
  groupName?: string
  healthScore?: number   // 实时计算健康分，优先于 inst.health
}>()

const emit = defineEmits<{
  (e: 'openHealth'): void
  (e: 'toggle', status: 'normal' | 'paused'): void
}>()

// ── DB 类型徽章 ────────────────────────────────────────────────────────────
const DB_STYLE: Record<string, { accent: string; gradient: string; abbr: string }> = {
  MySQL:      { accent: '#0C7C97', gradient: 'linear-gradient(135deg,#0C7C97,#095E73)', abbr: 'MY' },
  PostgreSQL: { accent: '#15A36A', gradient: 'linear-gradient(135deg,#15A36A,#0e7a4f)', abbr: 'PG' },
  Oracle:     { accent: '#E08600', gradient: 'linear-gradient(135deg,#E08600,#b86b00)', abbr: 'OR' },
  SQLServer:  { accent: '#6B7280', gradient: 'linear-gradient(135deg,#6B7280,#4b5563)', abbr: 'MS' },
}
const UNKNOWN_DB_STYLE = { accent: '#6B7280', gradient: 'linear-gradient(135deg,#6B7280,#4b5563)', abbr: 'DB' }
const dbStyle = computed(() => props.inst.dbType ? DB_STYLE[props.inst.dbType] ?? UNKNOWN_DB_STYLE : UNKNOWN_DB_STYLE)
const accentColor  = computed(() => dbStyle.value.accent)
const badgeGradient = computed(() => dbStyle.value.gradient)
const dbTypeAbbr   = computed(() => dbStyle.value.abbr)

// ── 状态 ───────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; dot: string; text: string }> = {
  normal:   { label: '运行中',   dot: 'dot-online',   text: 'text-online' },
  abnormal: { label: '异常',     dot: 'dot-error',    text: 'text-error' },
  paused:   { label: '采集暂停', dot: 'dot-offline',  text: 'text-offline' },
}
const statusInfo     = computed(() => STATUS_MAP[props.inst.status] ?? STATUS_MAP.normal)
const statusLabel    = computed(() => statusInfo.value.label)
const statusDotClass = computed(() => statusInfo.value.dot)
const statusTextClass = computed(() => statusInfo.value.text)

// ── 健康等级 ───────────────────────────────────────────────────────────────
// 优先用实时计算分；inst.health 是实体上的旧字段，仅在分数有效时回退使用。
// NaN 由 HealthGauge 统一渲染为暂无数据，避免缺少指标被误判为 0 分严重。
const score = computed(() => {
  const value = props.healthScore ?? props.inst.health
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : Number.NaN
})
const healthLevel = computed(() => {
  if (!Number.isFinite(score.value)) return 'no_data'
  if (score.value >= 90) return 'excellent'
  if (score.value >= 75) return 'good'
  if (score.value >= 60) return 'warning'
  return 'critical'
})

function handleToggle(val: string | number | boolean) {
  emit('toggle', val ? 'normal' : 'paused')
}
</script>

<style scoped>
.inst-banner {
  display: flex;
  align-items: center;
  min-height: 88px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 4px solid var(--accent, #0C7C97);
  border-radius: var(--radius-base);
  box-shadow: 0 1px 2px rgba(14, 26, 43, 0.05);
  overflow: hidden;
}

/* ① 左侧标识 */
.ib-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  min-width: 220px;
  flex-shrink: 0;
}
.ib-badge {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.ib-title {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ib-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
.ib-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.ib-type-text {
  color: var(--el-text-color-secondary);
}
.ib-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-online  { background: #15A36A; box-shadow: 0 0 0 2px #15a36a30; }
.dot-error   { background: #E5484D; box-shadow: 0 0 0 2px #e5484d30; }
.dot-offline { background: #9CA3AF; }
.ib-status-text { font-weight: 500; }
.text-online  { color: #15A36A; }
.text-error   { color: #E5484D; }
.text-offline { color: #9CA3AF; }

/* 分隔线 */
.ib-divider {
  width: 1px;
  height: 40px;
  background: var(--el-border-color-lighter);
  flex-shrink: 0;
}

/* ② ~ ⑤ 属性列 */
.ib-prop {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 0 20px;
  flex: 1;
  min-width: 100px;
}
.ib-prop-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.ib-prop-val {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}
.mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
.owner-b { margin-left: 8px; }
.muted { color: var(--el-text-color-placeholder); font-weight: 400; }
.ib-monitor { gap: 6px; }
.ib-on  { font-size: 12px; color: #15A36A; }
.ib-off { font-size: 12px; color: #9CA3AF; }

/* ⑥ 右侧健康分 */
.ib-health {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  align-self: stretch;
  border-left: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.ib-health:hover {
  background: color-mix(in srgb, var(--accent, #0C7C97) 8%, transparent);
}
.ib-score-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ib-score-lbl {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
