<template>
  <div class="session-page">
    <InstanceEmpty v-if="!inst" />
    <el-card v-else shadow="never" class="tab-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">连接分析</span>
          <span class="card-sub">{{ inst.name }} · 连接概览 / 来源 Top / 状态分布 / 长连接</span>
        </div>
      </template>
      <ConnectionsTab :instance-id="inst.id" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ConnectionsTab from '../realtime/components/ConnectionsTab.vue'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)
</script>

<style scoped>
.session-page { display: flex; flex-direction: column; gap: 16px; min-height: 400px; }
.card-head { display: flex; align-items: baseline; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
