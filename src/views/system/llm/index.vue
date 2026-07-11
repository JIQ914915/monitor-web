<template>
  <div class="llm-page">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="智能分析说明"
      description="启用后可在「告警管理 → 事件下钻」页一键生成 AI 事件总结、可能原因与处理建议。所有输出仅供参考，系统不会自动执行任何数据库操作；高风险处置须人工确认。推荐对接内网本地部署的大模型服务（Ollama / vLLM 等 OpenAI 兼容接口），实现数据不出域。"
      class="page-alert"
    />

    <el-card shadow="never" v-loading="loading">
      <el-form :model="form" label-width="140px" class="llm-form">
        <el-form-item label="启用智能分析">
          <el-switch v-model="form.enabled" :disabled="readonly" />
        </el-form-item>

        <el-form-item label="接口地址" required>
          <el-input
            v-model="form.baseUrl"
            :disabled="readonly"
            placeholder="OpenAI 兼容接口地址，到 /v1 为止，如 http://ollama.internal:11434/v1"
            clearable
          />
          <div class="form-tip">支持任意 OpenAI 兼容服务：本地 Ollama / vLLM / 各云厂商兼容端点</div>
        </el-form-item>

        <el-form-item label="模型名称" required>
          <el-input
            v-model="form.model"
            :disabled="readonly"
            placeholder="如 qwen2.5:14b / deepseek-chat / gpt-4o-mini"
            clearable
            style="max-width: 360px"
          />
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            :disabled="readonly"
            type="password"
            show-password
            placeholder="本地部署可留空；显示 ****** 表示已配置（不修改则保持原值）"
            style="max-width: 480px"
          />
          <div class="form-tip">加密存储，保存后不再回显真实值</div>
        </el-form-item>

        <el-form-item label="调用超时">
          <el-input-number v-model="form.timeoutSeconds" :min="10" :max="300" :disabled="readonly" controls-position="right" />
          <span class="unit">秒</span>
        </el-form-item>

        <el-divider content-position="left">安全与合规</el-divider>

        <el-form-item label="允许公网调用">
          <el-switch v-model="form.allowExternal" :disabled="readonly" />
          <div class="form-tip">
            <b>关闭（推荐）= 数据不出域</b>：仅允许调用内网 / 本机地址的大模型服务；
            开启后允许调用公网服务，监控上下文（实例名、告警信息、SQL 片段等）将发送至外部服务商，请评估合规风险
          </div>
        </el-form-item>

        <el-form-item label="上下文脱敏">
          <el-switch v-model="form.desensitize" :disabled="readonly" />
          <div class="form-tip">开启后发送前对上下文做脱敏：IP 地址打码（保留前两段）、SQL 字面量参数化</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :disabled="readonly" :loading="saving" @click="save">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getLlmConfig, saveLlmConfig } from '@/api/llm'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const readonly = ref(!userStore.hasPermission('llm_config:update'))

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  enabled: false,
  baseUrl: '',
  apiKey: '',
  model: '',
  timeoutSeconds: 60,
  allowExternal: false,
  desensitize: true
})

async function load() {
  loading.value = true
  try {
    const cfg = await getLlmConfig()
    form.enabled = cfg.enabled
    form.baseUrl = cfg.baseUrl ?? ''
    form.apiKey = cfg.apiKey ?? ''
    form.model = cfg.model ?? ''
    form.timeoutSeconds = cfg.timeoutSeconds ?? 60
    form.allowExternal = cfg.allowExternal
    form.desensitize = cfg.desensitize
  } finally {
    loading.value = false
  }
}

async function save() {
  if (form.enabled && !form.baseUrl.trim()) {
    ElMessage.warning('启用智能分析前请先填写接口地址')
    return
  }
  saving.value = true
  try {
    await saveLlmConfig({ ...form, baseUrl: form.baseUrl.trim(), model: form.model.trim() })
    ElMessage.success('配置已保存')
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.llm-page { display: flex; flex-direction: column; gap: 16px; }
.page-alert :deep(.el-alert__description) { line-height: 1.7; }
.llm-form { max-width: 820px; }
.form-tip { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.6; margin-top: 4px; width: 100%; }
.unit { margin-left: 8px; color: var(--el-text-color-secondary); }
</style>
