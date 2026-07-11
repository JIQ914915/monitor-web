<template>
  <div>
    <el-alert
      v-if="readonly"
      type="warning"
      :closable="false"
      show-icon
      title="只读模式"
      description="当前账号无编辑权限，仅可查看通知通道配置。"
      style="margin-bottom: 12px"
    />
    <el-card shadow="never" v-loading="loading">
      <el-table :data="rows">
        <el-table-column label="通道" width="150">
          <template #default="{ row }">
            <el-tag effect="plain">{{ channelLabel(row.channel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" :disabled="readonly" />
          </template>
        </el-table-column>
        <el-table-column label="通知地址（每行一个 URL）" min-width="360">
          <template #default="{ row }">
            <el-input
              v-model="row.urlsText"
              type="textarea"
              :rows="2"
              :disabled="readonly"
              :placeholder="urlPlaceholder(row.channel)"
            />
          </template>
        </el-table-column>
        <el-table-column label="签名密钥" min-width="220">
          <template #default="{ row }">
            <el-input
              v-if="hasSecret(row.channel)"
              v-model="row.secret"
              :disabled="readonly"
              :placeholder="secretPlaceholder(row.channel)"
              show-password
            />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="最近更新" width="170">
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </el-table-column>
      </el-table>

      <div class="actions">
        <el-button type="primary" :disabled="readonly" :loading="saving" @click="save">保存配置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listNotifyChannels, saveNotifyChannels } from '@/api/alert'
import { useUserStore } from '@/stores/user'
import { useDict } from '@/composables/useDict'
import { formatDateTime as formatTime } from '@/utils/format'

const { getDictLabel } = useDict('notify_channel_type')

interface Row {
  channel: string
  enabled: boolean
  urlsText: string
  secret: string
  updatedAt?: string | null
}

const userStore = useUserStore()
const readonly = ref(!userStore.hasPermission('notify_channel:update'))

const loading = ref(false)
const saving = ref(false)
const rows = ref<Row[]>([])

/** 渠道名称由 notify_channel_type 字典解析 */
function channelLabel(channel: string) {
  return getDictLabel('notify_channel_type', channel) || channel
}

function hasSecret(channel: string) {
  return channel === 'dingtalk' || channel === 'feishu'
}

function urlPlaceholder(channel: string) {
  switch (channel) {
    case 'dingtalk':
      return 'https://oapi.dingtalk.com/robot/send?access_token=xxx'
    case 'wecom':
      return 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
    case 'feishu':
      return 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
    default:
      return 'https://example.com/alert-webhook'
  }
}

function secretPlaceholder(channel: string) {
  return channel === 'dingtalk'
    ? '机器人安全设置「加签」密钥（SEC 开头），留空则不启用加签'
    : '机器人「安全设置-签名校验」密钥，留空则不启用签名'
}

async function load() {
  loading.value = true
  try {
    const list = await listNotifyChannels()
    rows.value = list.map((c) => ({
      channel: c.channel,
      enabled: c.enabled,
      urlsText: (c.urls ?? []).join('\n'),
      secret: c.secret ?? '',
      updatedAt: c.updatedAt
    }))
  } finally {
    loading.value = false
  }
}

async function save() {
  const invalid = rows.value.find((r) => r.enabled && !splitUrls(r.urlsText).length)
  if (invalid) {
    ElMessage.warning(`已启用「${channelLabel(invalid.channel)}」，请至少填写一个通知地址`)
    return
  }
  saving.value = true
  try {
    await saveNotifyChannels(
      rows.value.map((r) => ({
        channel: r.channel,
        enabled: r.enabled,
        urls: splitUrls(r.urlsText),
        // 掩码 "******" 表示未修改；空字符串表示清除密钥
        secret: hasSecret(r.channel) ? r.secret : undefined
      }))
    )
    ElMessage.success('保存成功')
    load()
  } finally {
    saving.value = false
  }
}

function splitUrls(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

onMounted(load)
</script>

<style scoped>
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.muted {
  color: var(--muted);
}
</style>
