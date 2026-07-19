<template>
  <div class="realtime-page">
    <!-- 无实例选中提示 -->
    <InstanceEmpty v-if="!inst" />

    <template v-else>
      <!-- Banner -->
      <InstanceBanner
        :inst="inst"
        :owner-a-name="ownerAName"
        :owner-b-name="ownerBName"
        :group-name="groupName"
        :health-score="healthData?.score"
        @open-health="showHealthDialog = true"
        @toggle="handleToggle"
      />

      <!-- 能力降级提示：版本不支持/权限不足/采集异常时的友好说明 -->
      <CapabilityBanner :instance-id="inst.id" />

      <!-- Tabs -->
      <el-card shadow="never" class="tab-card">
        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="性能监控" name="performance">
            <PerformanceTab :instance-id="inst.id" />
          </el-tab-pane>
          <el-tab-pane label="连接信息" name="connections">
            <ConnectionsTab :instance-id="inst.id" />
          </el-tab-pane>
          <el-tab-pane label="资源使用" name="resources">
            <ResourcesTab :instance-id="inst.id" />
          </el-tab-pane>
          <el-tab-pane v-if="inst.hostId" label="主机资源" name="host">
            <HostResourceTab :instance-id="inst.id" :host-id="inst.hostId" :host-name="inst.hostName" :host-os-type="inst.hostOsType" />
          </el-tab-pane>
          <el-tab-pane label="事件 & 风险" name="events">
            <EventsTab :instance-id="inst.id" />
          </el-tab-pane>
          <el-tab-pane label="安全审计" name="security">
            <SecurityTab :instance-id="inst.id" />
          </el-tab-pane>
          <el-tab-pane label="配置参数" name="config">
            <ConfigTab :instance-id="inst.id" />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>

    <!-- 健康评分弹窗 -->
    <HealthScoreDialog v-model="showHealthDialog" :data="healthData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import CapabilityBanner from '@/components/CapabilityBanner.vue'
import { toggleInstance } from '@/api/instance'
import { listUserOptions } from '@/api/user'
import { listGroupOptions } from '@/api/group'
import { getHealthScore } from '@/api/metric'
import InstanceBanner from '@/views/monitor/shared/realtime/components/InstanceBanner.vue'
import HealthScoreDialog from '@/views/monitor/shared/realtime/components/HealthScoreDialog.vue'
import PerformanceTab from './components/PerformanceTab.vue'
import ConnectionsTab from './components/ConnectionsTab.vue'
import ResourcesTab from './components/ResourcesTab.vue'
import HostResourceTab from './components/HostResourceTab.vue'
import EventsTab from './components/EventsTab.vue'
import SecurityTab from './components/SecurityTab.vue'
import ConfigTab from './components/ConfigTab.vue'
import type { HealthScoreVo } from '@/types/monitor'
import type { UserOption, GroupOption } from '@/types'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const activeTab = ref('performance')
const showHealthDialog = ref(false)
const healthData = ref<HealthScoreVo | null>(null)

// 负责人 & 分组名称（从选项接口解析）
const userOptions = ref<UserOption[]>([])
const groupOptions = ref<GroupOption[]>([])

const ownerAName = computed(() => {
  if (!inst.value?.ownerAId) return ''
  return userOptions.value.find(u => u.id === inst.value!.ownerAId)?.name ?? `#${inst.value.ownerAId}`
})
const ownerBName = computed(() => {
  if (!inst.value?.ownerBId) return ''
  return userOptions.value.find(u => u.id === inst.value!.ownerBId)?.name ?? `#${inst.value.ownerBId}`
})
const groupName = computed(() => {
  if (!inst.value?.groupIds?.length) return ''
  const names = inst.value.groupIds
    .map(id => groupOptions.value.find(g => g.id === id)?.name)
    .filter(Boolean)
  return names.join(' / ') || ''
})

async function loadMeta() {
  const [users, groups] = await Promise.allSettled([listUserOptions(), listGroupOptions()])
  if (users.status === 'fulfilled') userOptions.value = users.value
  if (groups.status === 'fulfilled') groupOptions.value = groups.value
}

async function loadHealth(instanceId: number) {
  try { healthData.value = await getHealthScore(instanceId) } catch { healthData.value = null }
}

async function handleToggle(status: 'normal' | 'paused') {
  if (!inst.value) return
  try {
    await toggleInstance(inst.value.id, status)
    ElMessage.success(status === 'normal' ? '已开启监控采集' : '已暂停监控采集')
    instanceStore.setCurrent({ ...inst.value, status })
  } catch { /* request.ts 已处理 */ }
}

watch(showHealthDialog, async (open) => {
  if (open && inst.value) await loadHealth(inst.value.id)
})

watch(() => inst.value?.id, (id) => {
  if (id) loadHealth(id)
}, { immediate: true })

// 仅加载一次
loadMeta()
</script>

<style scoped>
.realtime-page {
  display: flex;
  flex-direction: column;
  gap: var(--density-gap, 16px);
  min-height: 400px;
}
.tab-card > :deep(.el-card__body) {
  padding: 0 16px 16px;
}
.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
</style>
