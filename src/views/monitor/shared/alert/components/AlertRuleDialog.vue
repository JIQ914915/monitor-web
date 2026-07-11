<template>
  <CrudDrawer
    ref="drawerRef"
    :visible="visible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    :title="isBuiltin ? '内置规则' : '自定义规则'"
    size="560px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="emit('update:visible', $event)"
    @save="onDrawerSave"
    @closed="resetForm"
  >
    <template #default>
      <div class="drawer-body">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <!-- 基础信息 -->
      <div class="section-title">基础信息</div>
      <el-row :gutter="16">
        <el-col :span="14">
          <el-form-item label="规则名称" prop="ruleName">
            <el-input v-model="form.ruleName" placeholder="请输入规则名称" :disabled="isBuiltin" />
          </el-form-item>
        </el-col>
        <el-col :span="10">
          <el-form-item label="告警级别" prop="ruleLevel">
            <el-select v-model="form.ruleLevel" style="width: 100%">
              <el-option
                v-for="item in getDictItems('alert_level')"
                :key="item.itemValue"
                :label="item.itemLabel"
                :value="item.itemValue"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row v-if="!conditionLocked" :gutter="16">
        <el-col :span="isBuiltin ? 24 : 12">
          <el-form-item label="监控指标">
            <el-select
              v-model="form.metricName"
              placeholder="请选择"
              style="width: 100%"
              filterable
              :disabled="isBuiltin"
            >
              <el-option-group label="连接">
                <el-option label="连接数" value="connections" />
                <el-option label="连接使用率" value="connectionUsage" />
                <el-option label="活跃线程数" value="threadsRunning" />
              </el-option-group>
              <el-option-group label="性能">
                <el-option label="QPS" value="qps" />
                <el-option label="TPS" value="tps" />
                <el-option label="慢SQL数量" value="slowQueries" />
              </el-option-group>
              <el-option-group label="资源">
                <el-option label="CPU使用率" value="cpu" />
                <el-option label="内存使用率" value="memory" />
                <el-option label="磁盘使用率" value="diskUsage" />
              </el-option-group>
              <el-option-group label="可用性">
                <el-option label="复制延迟" value="replicationDelay" />
                <el-option label="实例可用性" value="availability" />
              </el-option-group>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="扫描间隔" prop="scanIntervalMin">
        <el-select v-model="form.scanIntervalMin" style="width: 220px">
          <el-option
            v-for="item in intervalOptions"
            :key="item"
            :label="`每 ${item} 分钟`"
            :value="item"
          />
        </el-select>
        <span class="hint">最小可配 {{ minAllowedIntervalMin }} 分钟（由最慢依赖指标决定）</span>
      </el-form-item>

      <!-- 触发条件（布尔型锁定规则：条件由系统固化，展示友好描述） -->
      <template v-if="conditionLocked">
        <div class="section-title">触发与恢复条件</div>
        <el-alert type="info" :closable="false" style="margin-bottom: 16px">
          <template #title>该规则的触发与恢复条件由系统内置，不支持修改；可调整告警级别、扫描间隔、通知设置和启用状态</template>
        </el-alert>
        <el-form-item label="触发条件">
          <span class="locked-cond">{{ props.rule?.conditionDisplay || '检测到异常状态时立即触发' }}</span>
        </el-form-item>
        <el-form-item label="恢复条件">
          <span class="locked-cond">{{ props.rule?.recoveryDisplay || '状态恢复正常时自动恢复' }}</span>
        </el-form-item>
      </template>

      <template v-else>
      <!-- 触发条件 -->
      <div class="section-title">触发条件</div>
      <el-form-item label="条件" prop="operator">
        <el-row :gutter="8" style="width: 100%">
          <el-col :span="7">
            <el-select v-model="form.operator" style="width: 100%" :disabled="isBuiltin">
              <el-option label="大于 >" value=">" />
              <el-option label="大于等于 >=" value=">=" />
              <el-option label="小于 <" value="<" />
              <el-option label="小于等于 <=" value="<=" />
              <el-option label="等于 =" value="=" />
              <el-option label="不等于 !=" value="!=" />
            </el-select>
          </el-col>
          <el-col :span="7">
            <el-input-number
              v-model="form.threshold"
              controls-position="right"
              style="width: 100%"
              placeholder="阈值"
            />
          </el-col>
          <el-col :span="10">
            <el-input v-model="form.unit" placeholder="单位（如 %, ms, 个）" :disabled="isBuiltin" />
          </el-col>
        </el-row>
      </el-form-item>
      <el-form-item label="持续时间">
        <el-input-number v-model="form.duration" :min="0" :step="60" style="width: 160px" />
        <span class="hint">秒（0 = 立即触发）</span>
      </el-form-item>

      <!-- 恢复条件 -->
      <div class="section-title">恢复条件</div>
      <el-form-item label="恢复阈值">
        <el-row :gutter="8" style="width: 100%">
          <el-col :span="7">
            <el-select v-model="form.recoveryOperator" style="width: 100%" :disabled="isBuiltin">
              <el-option label="小于 <" value="<" />
              <el-option label="小于等于 <=" value="<=" />
              <el-option label="大于 >" value=">" />
              <el-option label="大于等于 >=" value=">=" />
            </el-select>
          </el-col>
          <el-col :span="7">
            <el-input-number
              v-model="form.recoveryThreshold"
              controls-position="right"
              style="width: 100%"
              placeholder="恢复阈值"
            />
          </el-col>
          <el-col :span="10">
            <span class="hint-inline">与触发条件单位一致</span>
          </el-col>
        </el-row>
      </el-form-item>
      <el-form-item label="持续时间">
        <el-input-number v-model="form.recoveryDuration" :min="0" :step="60" style="width: 160px" />
        <span class="hint">秒（恢复确认窗口）</span>
      </el-form-item>
      </template>

      <!-- 通知设置 -->
      <div class="section-title">通知设置</div>
      <el-form-item label="通知时机">
        <el-checkbox v-model="form.notifyOnTrigger">触发时通知</el-checkbox>
        <el-checkbox v-model="form.notifyOnRecovery" style="margin-left: 16px">恢复时通知</el-checkbox>
      </el-form-item>
      <el-form-item label="通知渠道">
        <el-checkbox v-model="form.channelEmail">邮件</el-checkbox>
        <el-checkbox v-model="form.channelSms" style="margin-left: 16px">短信</el-checkbox>
        <el-checkbox v-model="form.channelWebhook" style="margin-left: 16px">Webhook</el-checkbox>
        <el-checkbox v-model="form.channelDingtalk" style="margin-left: 16px">钉钉机器人</el-checkbox>
        <el-checkbox v-model="form.channelWecom" style="margin-left: 16px">企业微信机器人</el-checkbox>
        <el-checkbox v-model="form.channelFeishu" style="margin-left: 16px">飞书机器人</el-checkbox>
      </el-form-item>
      <el-form-item
        v-if="form.channelWebhook || form.channelDingtalk || form.channelWecom || form.channelFeishu"
        label=" "
      >
        <span class="hint">Webhook/机器人地址与签名密钥在「系统管理 → 通知通道」统一配置</span>
      </el-form-item>
      <el-form-item label="静默期">
        <el-input-number
          v-model="form.silencePeriod"
          :min="0"
          :max="1440"
          controls-position="right"
          style="width: 160px"
        />
        <span class="hint">分钟（同规则静默期内不重复通知）</span>
      </el-form-item>

      <!-- 其他 -->
      <div class="section-title">其他</div>
      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          placeholder="可选描述信息"
          :disabled="conditionLocked"
        />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
        <span class="hint">{{ form.enabled ? '保存后立即生效' : '保存后不启用' }}</span>
      </el-form-item>
    </el-form>
      </div>
    </template>
  </CrudDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { saveAlertRule } from '@/api/alert'
import type { AlertRuleVo, AlertRuleSaveRequest } from '@/types/alert'
import { useDict } from '@/composables/useDict'
import { CrudDrawer } from '@/components/ProTable'
import type { DrawerMode } from '@/components/ProTable'

const { getDictItems } = useDict('alert_level')

const props = defineProps<{
  visible: boolean
  rule: AlertRuleVo | null
  instanceId?: number
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  saved: []
}>()

const isBuiltin = computed(() => props.rule?.ruleType === 'builtin')
/** 布尔型锁定规则（复制线程停止等）：条件固化，仅可改级别/扫描间隔/通知/启停 */
const conditionLocked = computed(() => !!props.rule?.conditionLocked)

interface FormState {
  id: number | undefined
  ruleCode: string
  ruleName: string
  ruleType: string
  ruleLevel: string
  metricName: string
  scanIntervalMin: number
  description: string
  operator: string
  threshold: number | null
  unit: string
  duration: number
  recoveryOperator: string
  recoveryThreshold: number | null
  recoveryDuration: number
  notifyOnTrigger: boolean
  notifyOnRecovery: boolean
  channelEmail: boolean
  channelSms: boolean
  channelWebhook: boolean
  channelDingtalk: boolean
  channelWecom: boolean
  channelFeishu: boolean
  silencePeriod: number
  enabled: boolean
}

const defaultForm = (): FormState => ({
  id: undefined,
  ruleCode: '',
  ruleName: '',
  ruleType: 'custom',
  ruleLevel: 'level_3',
  metricName: '',
  scanIntervalMin: 1,
  description: '',
  operator: '>',
  threshold: null,
  unit: '',
  duration: 0,
  recoveryOperator: '<',
  recoveryThreshold: null,
  recoveryDuration: 0,
  notifyOnTrigger: true,
  notifyOnRecovery: true,
  channelEmail: true,
  channelSms: false,
  channelWebhook: false,
  channelDingtalk: false,
  channelWecom: false,
  channelFeishu: false,
  silencePeriod: 0,
  enabled: true,
})

const form = reactive<FormState>(defaultForm())
const formRef = ref<FormInstance>()
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)

const rules: FormRules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  ruleLevel: [{ required: true, message: '请选择告警级别', trigger: 'change' }],
  scanIntervalMin: [{ required: true, message: '请选择扫描间隔', trigger: 'change' }],
}

const minAllowedIntervalMin = computed(() => Math.max(1, props.rule?.minAllowedIntervalMin ?? 1))
const intervalOptions = computed(() => buildIntervalOptions(minAllowedIntervalMin.value))

watch(
  () => props.visible,
  (v) => {
    if (v && props.rule) {
      Object.assign(form, {
        id: props.rule.id || undefined,
        ruleCode: props.rule.ruleCode ?? '',
        ruleName: props.rule.ruleName,
        ruleType: props.rule.ruleType,
        ruleLevel: props.rule.ruleLevel,
        metricName: props.rule.metricName ?? '',
        scanIntervalMin: props.rule.scanIntervalMin ?? Math.max(1, props.rule.minAllowedIntervalMin ?? 1),
        description: props.rule.description ?? '',
        operator: props.rule.operator ?? '>',
        threshold: props.rule.threshold ?? null,
        unit: props.rule.unit ?? '',
        duration: props.rule.duration ?? 0,
        recoveryOperator: props.rule.recoveryOperator ?? '<',
        recoveryThreshold: props.rule.recoveryThreshold ?? null,
        recoveryDuration: props.rule.recoveryDuration ?? 0,
        notifyOnTrigger: props.rule.notifyOnTrigger ?? true,
        notifyOnRecovery: props.rule.notifyOnRecovery ?? true,
        channelEmail: props.rule.channelEmail ?? true,
        channelSms: props.rule.channelSms ?? false,
        channelWebhook: props.rule.channelWebhook ?? false,
        channelDingtalk: props.rule.channelDingtalk ?? false,
        channelWecom: props.rule.channelWecom ?? false,
        channelFeishu: props.rule.channelFeishu ?? false,
        silencePeriod: props.rule.silencePeriod ?? 0,
        enabled: props.rule.instanceEnabled,
      })
    }
  },
  { immediate: true }
)

function resetForm() {
  Object.assign(form, defaultForm())
  formRef.value?.clearValidate()
}

async function onDrawerSave(_mode: DrawerMode) {
  try {
    const req: AlertRuleSaveRequest = {
      id: form.id,
      ruleCode: form.ruleCode || undefined,
      instanceId: props.instanceId,
      ruleName: form.ruleName,
      ruleType: form.ruleType as any,
      ruleLevel: form.ruleLevel as any,
      scanIntervalMin: form.scanIntervalMin,
      // 锁定规则不提交条件类字段（后端也会二次剥离，双保险）
      ...(conditionLocked.value
        ? {}
        : {
            metricName: form.metricName,
            description: form.description,
            operator: form.operator,
            threshold: form.threshold ?? undefined,
            unit: form.unit,
            duration: form.duration,
            recoveryOperator: form.recoveryOperator,
            recoveryThreshold: form.recoveryThreshold ?? undefined,
            recoveryDuration: form.recoveryDuration,
          }),
      notifyOnTrigger: form.notifyOnTrigger,
      notifyOnRecovery: form.notifyOnRecovery,
      channelEmail: form.channelEmail,
      channelSms: form.channelSms,
      channelWebhook: form.channelWebhook,
      channelDingtalk: form.channelDingtalk,
      channelWecom: form.channelWecom,
      channelFeishu: form.channelFeishu,
      silencePeriod: form.silencePeriod,
      enabled: form.enabled,
    }
    await saveAlertRule(req)
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    emit('saved')
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
}

function buildIntervalOptions(minAllowed: number): number[] {
  const preset = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440]
    .filter((v) => v >= minAllowed)
    .filter((v) => v % minAllowed === 0)
  if (preset.length) return preset
  return [1, 2, 3, 6, 12, 24].map((factor) => minAllowed * factor)
}
</script>

<style scoped>
.drawer-body {
  padding: 0 4px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 8px 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 16px;
}

.hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.hint-inline {
  line-height: 32px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.locked-cond {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 22px;
}

:deep(.el-checkbox__inner) {
  border-radius: 2px;
}
</style>
