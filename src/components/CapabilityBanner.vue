<template>
  <!-- 能力降级横幅：仅当存在非 available 能力时显示，正常情况下不占空间 -->
  <el-alert
    v-if="abnormal.length"
    :type="alertType"
    :closable="true"
    show-icon
    class="capability-banner"
  >
    <template #title>
      <span>当前实例部分监控能力受限（{{ abnormal.length }} 项），相关页面可能显示不全</span>
    </template>
    <div class="cap-list">
      <div v-for="c in abnormal" :key="c.capability" class="cap-item">
        <DictTag dict="capability_status" :value="c.status" size="small" />
        <span class="cap-name">{{ c.name }}</span>
        <span v-if="c.message" class="cap-msg">{{ c.message }}</span>
      </div>
    </div>
  </el-alert>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getInstanceCapabilities, type InstanceCapability } from '@/api/instance'
import DictTag from '@/components/DictTag.vue'

const props = defineProps<{ instanceId?: number | null }>()

const caps = ref<InstanceCapability[]>([])

const abnormal = computed(() => caps.value.filter(c => c.status !== 'available'))

/** 横幅级别取最严重项：采集异常 → error；受限/未启用/数据不足 → warning；其余 → info */
const alertType = computed<'error' | 'warning' | 'info'>(() => {
  if (abnormal.value.some(c => c.status === 'collect_error' || c.status === 'permission_denied')) return 'error'
  if (abnormal.value.some(c => c.status === 'limited' || c.status === 'not_enabled' || c.status === 'no_data')) return 'warning'
  return 'info'
})

watch(
  () => props.instanceId,
  async id => {
    caps.value = []
    if (!id) return
    try {
      caps.value = (await getInstanceCapabilities(id)) ?? []
    } catch {
      // 能力检测属增强提示，失败静默（不打扰主页面）
      caps.value = []
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.capability-banner {
  margin-bottom: 12px;
}

.cap-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.cap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 20px;
}

.cap-name {
  font-weight: 600;
  white-space: nowrap;
}

.cap-msg {
  color: var(--el-text-color-secondary);
}
</style>
