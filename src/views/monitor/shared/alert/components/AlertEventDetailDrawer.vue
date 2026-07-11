<template>
  <CrudDrawer
    :visible="visible"
    type="drawer"
    mode="view"
    title="告警事件详情"
    size="760px"
    @update:visible="emit('update:visible', $event)"
  >
    <template #default>
      <div v-if="event" class="drawer-actions">
        <el-button type="danger" plain size="small" :icon="DataAnalysis" @click="goDrilldown">事件分析</el-button>
      </div>
      <el-descriptions v-if="event" :column="2" border>
        <el-descriptions-item label="事件编码">{{ event.eventCode }}</el-descriptions-item>
        <el-descriptions-item label="告警级别">
          <DictTag dict="alert_level" :value="event.ruleLevel" effect="dark" />
        </el-descriptions-item>
        <el-descriptions-item label="告警规则">{{ event.ruleName }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <DictTag dict="alert_event_status" :value="event.status" effect="plain" />
        </el-descriptions-item>

        <el-descriptions-item label="告警信息" :span="2">{{ buildMessage(event) }}</el-descriptions-item>
        <el-descriptions-item label="首次触发">{{ event.triggerTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近触发">{{ event.lastTriggerTime || '-' }}</el-descriptions-item>
        <!-- 评估引擎运行痕迹：状态化展示，回答"系统还在不在盯着这条告警" -->
        <el-descriptions-item label="最近复核时间">
          <template v-if="event.lastEvalTime">
            {{ event.lastEvalTime }}
            <span class="eval-hint">（{{ relativeFromNow(event.lastEvalTime) }}）</span>
          </template>
          <template v-else>—（触发后尚未到下一轮复核）</template>
        </el-descriptions-item>
        <el-descriptions-item label="跟踪状态">
          <el-tag :type="evalStateTag(event.evalState)" size="small" effect="plain">
            {{ evalStateLabel(event.evalState) }}
          </el-tag>
          <span class="eval-hint">{{ evalStateHint(event.evalState) }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="event.evalMessage" label="异常说明" :span="2">
          {{ event.evalMessage }}
        </el-descriptions-item>
        <el-descriptions-item label="持续时间">{{ fmtDuration(event.durationSeconds) }}</el-descriptions-item>
        <el-descriptions-item label="触发次数">{{ event.triggerCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="静默至">{{ event.silenceUntilTime || '-' }}</el-descriptions-item>

        <el-descriptions-item label="确认执行人">{{ event.confirmUserName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="静默执行人">{{ event.silenceUserName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="关闭执行人">{{ event.closeUserName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最近处置备注" :span="2">{{ event.lastRemark || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 场景综合事件：信号快照 + 诊断结论 + 关联知识库 -->
      <div v-if="event && isScenarioEvent" class="notify-section">
        <div class="section-title">命中信号</div>
        <el-table :data="event.signalsSnapshot ?? []" size="small" border>
          <el-table-column prop="name" label="信号" min-width="140" show-overflow-tooltip />
          <el-table-column prop="expr" label="触发条件" min-width="160" show-overflow-tooltip />
          <el-table-column prop="currentVal" label="触发时值" width="120" align="center" />
          <el-table-column label="是否满足" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="signalTag(row as ScenarioSignal)" size="small" effect="plain">
                {{ signalLabel(row as ScenarioSignal) }}
              </el-tag>
            </template>
          </el-table-column>
          <template #empty>无信号快照</template>
        </el-table>

        <template v-if="event.alertMessage">
          <div class="section-title">诊断结论</div>
          <el-alert type="warning" :closable="false" show-icon>
            <template #title>{{ event.alertMessage }}</template>
          </el-alert>
        </template>

        <template v-if="event.knowledgeArticles?.length">
          <div class="section-title">关联知识库</div>
          <div class="kb-links">
            <el-link
              v-for="article in event.knowledgeArticles"
              :key="article.id"
              type="primary"
              :underline="false"
              class="kb-link"
              @click="goKnowledge(article.id)"
            >
              <el-icon><Collection /></el-icon>
              <span>{{ article.title }}</span>
            </el-link>
          </div>
        </template>
      </div>

      <div v-if="event" class="notify-section">
        <div class="section-title">处置流水</div>
        <el-table :data="operateLogs" v-loading="operateLogLoading" size="small" border>
          <el-table-column prop="operateType" label="操作" width="86">
            <template #default="{ row }">{{ operateTypeLabel(row.operateType) }}</template>
          </el-table-column>
          <el-table-column label="流转" width="140">
            <template #default="{ row }">{{ statusLabel(row.fromStatus) }} → {{ statusLabel(row.toStatus) }}</template>
          </el-table-column>
          <el-table-column prop="operatorName" label="操作人" width="110">
            <template #default="{ row }">{{ row.operatorName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.remark || '-' }}</template>
          </el-table-column>
          <el-table-column prop="createdAt" label="操作时间" width="165" />
          <template #empty>暂无人工处置记录</template>
        </el-table>
      </div>

      <div v-if="event" class="notify-section">
        <div class="section-title">通知记录</div>
        <el-table :data="notifyRecords" v-loading="notifyLoading" size="small" border>
          <el-table-column prop="channel" label="通道" width="86">
            <template #default="{ row }">{{ channelLabel(row.channel) }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="86">
            <template #default="{ row }">
              <DictTag dict="notify_status" :value="row.status" />
            </template>
          </el-table-column>
          <el-table-column prop="target" label="目标" min-width="160" show-overflow-tooltip />
          <el-table-column prop="responseCode" label="响应" width="90" />
          <el-table-column prop="retryCount" label="重试" width="76">
            <template #default="{ row }">{{ row.retryCount ?? 0 }}/{{ row.maxRetry ?? 0 }}</template>
          </el-table-column>
          <el-table-column prop="errorMessage" label="失败原因" min-width="180" show-overflow-tooltip />
          <el-table-column prop="sentAt" label="发送时间" width="165" />
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'dead'"
                type="primary"
                link
                size="small"
                :loading="resendingId === row.id"
                @click="handleResend(row.id)"
              >重发</el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </CrudDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Collection, DataAnalysis } from '@element-plus/icons-vue'
import { CrudDrawer } from '@/components/ProTable'
import DictTag from '@/components/DictTag.vue'
import { fmtDurationCn as fmtDuration } from '@/utils/format'
import { useDict } from '@/composables/useDict'
import { listAlertNotifyRecords, listAlertOperateLogs, resendAlertNotify } from '@/api/alert'
import { useInstanceStore } from '@/stores/instance'
import { getDrilldownPath } from '@/utils/instanceMenu'
import type { AlertEventOperateLogVo, AlertEventVo, AlertNotifyRecordVo, ScenarioSignal } from '@/types/monitor'

const props = defineProps<{
  visible: boolean
  event: AlertEventVo | null
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const { getDictLabel } = useDict(
  'alert_event_status', 'notify_channel_type', 'alert_event_operate_type'
)
const router = useRouter()
const instanceStore = useInstanceStore()

const isScenarioEvent = computed(() => props.event?.eventSource === 'scenario')

function signalLabel(signal: ScenarioSignal): string {
  if (signal.state === 'unknown') return '数据缺失'
  return signal.met ? '满足' : '未满足'
}

function signalTag(signal: ScenarioSignal): 'danger' | 'success' | 'info' {
  if (signal.state === 'unknown') return 'info'
  return signal.met ? 'danger' : 'success'
}

/** 进入事件下钻分析页（§11.7），关闭抽屉后跳转（按当前实例类型归属对应分组） */
function goDrilldown() {
  if (!props.event) return
  emit('update:visible', false)
  router.push({ path: getDrilldownPath(instanceStore.current?.dbType), query: { eventId: props.event.id } })
}

function goKnowledge(articleId: number) {
  emit('update:visible', false)
  router.push({ path: '/system/knowledge', query: { articleId: String(articleId) } })
}
const notifyLoading = ref(false)
const notifyRecords = ref<AlertNotifyRecordVo[]>([])
const resendingId = ref<number | null>(null)
const operateLogLoading = ref(false)
const operateLogs = ref<AlertEventOperateLogVo[]>([])

function statusLabel(status: string): string {
  return getDictLabel('alert_event_status', status) || status
}

function buildMessage(row: AlertEventVo) {
  return row.alertMessage?.trim() || '-'
}

function evalStateLabel(state?: string | null) {
  if (state === 'metric_missing') return '指标缺失'
  if (state === 'normal') return '正常跟踪中'
  return state || '未复核'
}

function evalStateTag(state?: string | null): 'success' | 'warning' | 'info' {
  if (state === 'metric_missing') return 'warning'
  if (state === 'normal') return 'success'
  return 'info'
}

/** 跟踪状态的白话解释：说明系统在做什么 / 用户该做什么 */
function evalStateHint(state?: string | null): string {
  if (state === 'metric_missing') {
    return '复核时查不到该指标的新数据，暂时无法判断是否恢复，请检查实例连接与采集任务'
  }
  if (state === 'normal') {
    return '系统按扫描间隔自动复核，满足恢复条件后将自动恢复'
  }
  return '告警触发后系统将按扫描间隔自动复核'
}

/** 相对时间："刚刚 / n 分钟前 / n 小时前 / n 天前" */
function relativeFromNow(time: string): string {
  const ts = new Date(time.replace(' ', 'T')).getTime()
  if (!Number.isFinite(ts)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`
  return `${Math.floor(diffSec / 86400)} 天前`
}

function channelLabel(channel: string) {
  return getDictLabel('notify_channel_type', channel) || channel
}

function operateTypeLabel(type: string) {
  return getDictLabel('alert_event_operate_type', type) || type
}

async function handleResend(id: number) {
  resendingId.value = id
  try {
    const ok = await resendAlertNotify(id)
    if (ok) {
      ElMessage.success('已重新提交发送，稍后可刷新查看结果')
      await fetchNotifyRecords()
    } else {
      ElMessage.warning('重发失败：记录不存在或已非死信状态')
    }
  } finally {
    resendingId.value = null
  }
}

async function fetchNotifyRecords() {
  if (!props.visible || !props.event?.id) {
    notifyRecords.value = []
    return
  }
  notifyLoading.value = true
  try {
    notifyRecords.value = await listAlertNotifyRecords(props.event.id)
  } finally {
    notifyLoading.value = false
  }
}

async function fetchOperateLogs() {
  if (!props.visible || !props.event?.id) {
    operateLogs.value = []
    return
  }
  operateLogLoading.value = true
  try {
    operateLogs.value = await listAlertOperateLogs(props.event.id)
  } finally {
    operateLogLoading.value = false
  }
}

watch(() => [props.visible, props.event?.id], () => {
  fetchNotifyRecords()
  fetchOperateLogs()
}, { immediate: true })
</script>

<style scoped>
.drawer-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.notify-section {
  margin-top: 14px;
}

.section-title {
  margin: 12px 0 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.kb-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kb-link :deep(.el-link__inner) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.eval-hint {
  margin-left: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
