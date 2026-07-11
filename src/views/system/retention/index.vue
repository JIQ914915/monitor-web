<template>
  <div>
    <el-alert
      v-if="readonly"
      type="warning"
      :closable="false"
      show-icon
      title="只读模式"
      description="仅超级管理员可修改数据保留策略，当前账号仅可查看。"
      style="margin-bottom: 12px"
    />

    <el-card shadow="never">
      <el-table :data="rows" v-loading="loading">
        <el-table-column label="数据类别" width="130">
          <template #default="{ row }">
            <el-tag :type="tagType(row.key)" effect="plain">{{ row.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="说明" min-width="300" show-overflow-tooltip />
        <el-table-column label="出厂默认" width="160">
          <template #default="{ row }">
            {{ factory[row.key] }} 天 <span class="human">（{{ humanDays(factory[row.key]) }}）</span>
          </template>
        </el-table-column>
        <el-table-column label="保留时间" width="260">
          <template #default="{ row }">
            <el-input-number v-model="row.days" :min="1" :max="3650" :disabled="readonly" controls-position="right" />
            <span class="unit">天</span>
            <span class="human">{{ humanDays(row.days) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="actions">
        <el-button :disabled="readonly" @click="resetFactory">恢复出厂默认</el-button>
        <el-button type="primary" :disabled="readonly" :loading="saving" @click="save">保存配置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRetention, saveRetention } from '@/api/retention'
import { useUserStore } from '@/stores/user'

const CATEGORIES = [
  { key: 'minute', label: '分钟级', desc: '分钟级原始采样明细与加工后的标准指标（global_status / processlist / innodb_trx 等）' },
  { key: 'hourly', label: '小时级', desc: '小时级原始与汇总/聚合指标（小时平均、小时最大值等连续聚合结果；含 SQL 指纹 metric_top_sql）' },
  { key: 'daily', label: '天级', desc: '天级汇总指标（日峰值、日告警次数等）' },
  { key: 'slow_sql_sample', label: '慢SQL样本', desc: '慢SQL真实执行样本（events_statements_history 分钟级采集，含参数原文；供慢SQL列表展示）' },
  { key: 'event', label: '告警事件', desc: '历史告警事件记录（归档历史库，不物理删除）' },
  { key: 'log', label: '操作日志', desc: '用户操作审计记录' },
  { key: 'report', label: '报告文件', desc: '生成的巡检 / 事件报告归档文件' }
]

const userStore = useUserStore()
const readonly = ref(!userStore.hasPermission('data_retention'))

const loading = ref(false)
const saving = ref(false)
const factory = reactive<Record<string, number>>({})
const rows = ref<{ key: string; label: string; desc: string; days: number }[]>([])
let original: Record<string, number> = {}

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
function tagType(key: string): TagType {
  return ({ minute: 'danger', hourly: 'warning', daily: 'success', slow_sql_sample: 'primary' } as Record<string, TagType>)[key] || 'info'
}

function humanDays(d: number) {
  if (!d || d < 0) return ''
  if (d % 365 === 0) return `约 ${d / 365} 年`
  if (d >= 365) return `约 ${(d / 365).toFixed(1)} 年`
  if (d >= 30 && d % 30 === 0) return `约 ${d / 30} 个月`
  if (d >= 60) return `约 ${Math.round(d / 30)} 个月`
  return `${d} 天`
}

async function load() {
  loading.value = true
  try {
    const { factory: fac, configs } = await getRetention()
    Object.assign(factory, fac)
    const map: Record<string, number> = {}
    configs.forEach((c) => (map[c.category] = c.retentionDays))
    original = { ...map }
    rows.value = CATEGORIES.map((c) => ({ ...c, days: map[c.key] ?? fac[c.key] ?? 30 }))
  } finally {
    loading.value = false
  }
}

function resetFactory() {
  rows.value.forEach((r) => (r.days = factory[r.key]))
}

async function save() {
  const shrunk = rows.value.filter((r) => original[r.key] != null && r.days < original[r.key])
  if (shrunk.length) {
    const detail = shrunk.map((r) => `${r.label}：${original[r.key]} 天 → ${r.days} 天`).join('<br/>')
    await ElMessageBox.confirm(
      `以下类别的保留时间将被缩短，超出新保留期的历史数据将被清理且不可恢复：<br/><br/>${detail}`,
      '确认缩短数据保留时间',
      { type: 'warning', dangerouslyUseHTMLString: true, confirmButtonText: '确认保存', cancelButtonText: '取消' }
    )
  }
  saving.value = true
  try {
    await saveRetention(rows.value.map((r) => ({ category: r.key, retentionDays: r.days, enabled: true })))
    ElMessage.success('保存成功')
    load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-head h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.unit {
  margin: 0 6px 0 8px;
  color: var(--muted);
}
.human {
  color: var(--muted);
  font-size: 12px;
}
</style>
