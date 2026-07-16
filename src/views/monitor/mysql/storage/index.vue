<template>
  <div class="storage-page">
    <InstanceEmpty v-if="!inst" />
    <el-card v-else shadow="never" class="tab-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">容量分析</span>
          <span class="card-sub">{{ inst.name }} · 表空间 Top / 容量预测 / Buffer Pool / 表 I/O 热点 / 疑似未使用索引</span>
        </div>
      </template>
      <MySqlDiagnosticPanel :instance-id="inst.id" kind="capacity" />
      <ResourcesTab :instance-id="inst.id" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ResourcesTab from '../realtime/components/ResourcesTab.vue'
import MySqlDiagnosticPanel from '../components/MySqlDiagnosticPanel.vue'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)
</script>

<style scoped>
.storage-page { display: flex; flex-direction: column; gap: 16px; min-height: 400px; }
.card-head { display: flex; align-items: baseline; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
