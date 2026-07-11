<template>
  <el-dialog v-model="visible" title="选择实例" width="900px" top="8vh" @open="onOpen">
    <div class="ip-toolbar">
      <el-input v-model="keyword" placeholder="搜索实例名称 / 主机" clearable style="width: 280px">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="status" placeholder="状态" clearable style="width: 130px">
        <el-option label="正常" value="normal" />
        <el-option label="异常" value="abnormal" />
        <el-option label="暂停" value="paused" />
      </el-select>
    </div>

    <div class="ip-body" v-loading="loading">
      <div class="ip-side">
        <div class="ip-side-group">
          <div
            v-for="q in quickNodes"
            :key="q.key"
            class="ip-side-item"
            :class="{ active: sideKey === q.key }"
            @click="sideKey = q.key"
          >
            <el-icon><component :is="q.icon" /></el-icon>
            <span>{{ q.label }}</span>
          </div>
        </div>
        <div class="ip-side-title">分组</div>
        <div class="ip-side-group">
          <div
            v-for="g in groups"
            :key="g.id"
            class="ip-side-item"
            :class="{ active: sideKey === 'g_' + g.id }"
            @click="sideKey = 'g_' + g.id"
          >
            <el-icon><Folder /></el-icon>
            <span>{{ g.name }}</span>
          </div>
        </div>
      </div>

      <div class="ip-list-wrap">
        <div class="ip-list-head">共 {{ filtered.length }} 个实例</div>
        <el-scrollbar class="ip-list">
          <el-empty v-if="!filtered.length" description="暂无实例" />
          <div
            v-for="inst in filtered"
            :key="inst.id"
            class="ip-item"
            :class="{ current: current?.id === inst.id }"
            @click="choose(inst)"
          >
            <span class="ip-dot" :class="inst.status" />
            <div class="ip-main">
              <div class="ip-name">
                {{ inst.name }}
                <el-tag size="small" effect="plain">{{ inst.dbType }} {{ inst.dbVersion }}</el-tag>
              </div>
              <div class="ip-host">{{ inst.host }}:{{ inst.port }}</div>
            </div>
            <HealthGauge :value="inst.health" :size="40" :stroke="4" :show-label="false" />
            <el-icon
              class="ip-fav"
              :class="{ on: isFav(inst.id) }"
              @click.stop="instanceStore.toggleFavorite(inst.id)"
            >
              <StarFilled v-if="isFav(inst.id)" /><Star v-else />
            </el-icon>
          </div>
        </el-scrollbar>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { Search, Folder, Clock, Star, StarFilled, Coin } from '@element-plus/icons-vue'
import HealthGauge from '@/components/HealthGauge.vue'
import { useAppStore } from '@/stores/app'
import { useInstanceStore } from '@/stores/instance'
import { listAllInstances } from '@/api/instance'
import { listGroups } from '@/api/group'
import type { DbInstance, InstanceGroup } from '@/types'

const app = useAppStore()
const instanceStore = useInstanceStore()

const visible = computed({
  get: () => app.pickerVisible,
  set: (v) => (v ? app.openPicker() : app.closePicker())
})

const quickNodes = [
  { key: 'all', label: '全部实例', icon: Coin },
  { key: 'recent', label: '最近访问', icon: Clock },
  { key: 'fav', label: '我的收藏', icon: Star }
]

const instances = ref<DbInstance[]>([])
const groups = ref<InstanceGroup[]>([])
const loading = ref(false)
const keyword = ref('')
const status = ref('')
const sideKey = ref('all')

const current = computed(() => instanceStore.current)
const isFav = (id: number) => instanceStore.favoriteIds.includes(id)

const baseList = computed<DbInstance[]>(() => {
  if (sideKey.value === 'recent') {
    return instanceStore.recentIds
      .map((id) => instances.value.find((i) => i.id === id))
      .filter((i): i is DbInstance => !!i)
  }
  if (sideKey.value === 'fav') {
    return instances.value.filter((i) => instanceStore.favoriteIds.includes(i.id))
  }
  if (sideKey.value.startsWith('g_')) {
    const gid = Number(sideKey.value.slice(2))
    return instances.value.filter((i) => (i.groupIds || []).includes(gid))
  }
  return instances.value
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return baseList.value.filter((i) => {
    if (status.value && i.status !== status.value) return false
    if (kw && !i.name.toLowerCase().includes(kw) && !i.host.toLowerCase().includes(kw)) return false
    return true
  })
})

async function loadData() {
  loading.value = true
  try {
    const [ins, grp] = await Promise.all([listAllInstances(), listGroups()])
    instances.value = ins
    groups.value = grp
  } finally {
    loading.value = false
  }
}

/** 每次打开都重新加载：保证新增/删除的实例、最新状态与健康分即时可见（实例数 ≤1000，查询很轻） */
function onOpen() {
  loadData()
}

function choose(inst: DbInstance) {
  instanceStore.setCurrent(inst)
  app.closePicker()
}

function handleGlobalOpen() {
  app.openPicker()
}

onMounted(() => window.addEventListener('open-instance-picker', handleGlobalOpen))
onBeforeUnmount(() => window.removeEventListener('open-instance-picker', handleGlobalOpen))
</script>

<style scoped>
.ip-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.ip-body {
  display: flex;
  gap: 12px;
  height: 460px;
}
.ip-side {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--line);
  padding-right: 12px;
  overflow: auto;
}
.ip-side-title {
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--muted);
}
.ip-side-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ip-side-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--ink-soft);
  border-radius: var(--radius-base);
  cursor: pointer;
}
.ip-side-item:hover {
  background: var(--track);
}
.ip-side-item.active {
  color: var(--signal);
  background: var(--signal-soft);
  font-weight: 500;
}
.ip-list-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ip-list-head {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}
.ip-list {
  flex: 1;
}
.ip-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-base);
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.ip-item:hover {
  border-color: var(--signal);
  background: var(--track);
}
.ip-item.current {
  border-color: var(--signal);
  background: var(--signal-soft);
}
.ip-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}
.ip-dot.normal {
  background: var(--sev-ok, #15a36a);
}
.ip-dot.abnormal {
  background: var(--sev-crit, #f05261);
}
.ip-dot.paused {
  background: var(--faint);
}
.ip-main {
  flex: 1;
  min-width: 0;
}
.ip-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--ink);
}
.ip-host {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}
.ip-fav {
  font-size: 16px;
  color: var(--faint);
  cursor: pointer;
}
.ip-fav.on {
  color: var(--warning, #e08600);
}
.ip-fav:hover {
  color: var(--warning, #e08600);
}
</style>
