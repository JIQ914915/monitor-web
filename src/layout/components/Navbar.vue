<template>
  <header class="navbar">
    <div class="navbar-left">
      <div v-if="theme.layout === 'top'" class="navbar-brand">
        <el-icon :size="22" color="var(--signal)"><Monitor /></el-icon>
        <span class="brand-text">数据库监控</span>
      </div>
      <el-icon v-if="theme.layout !== 'top'" class="collapse-btn" @click="toggle">
        <Expand v-if="theme.sidebarCollapsed" /><Fold v-else />
      </el-icon>
      <el-button text class="nav-home" :class="{ active: isHome }" @click="goHome">
        <el-icon><HomeFilled /></el-icon><span>首页</span>
      </el-button>
      <div class="instance-trigger" @click="app.openPicker()">
        <template v-if="current">
          <span class="it-dot" :class="current.status" />
          <span class="it-name">{{ current.name }}</span>
        </template>
        <span v-else class="it-placeholder">选择实例...</span>
        <el-icon class="it-arrow"><ArrowDown /></el-icon>
      </div>
      <Breadcrumb v-if="theme.layout !== 'top'" />
    </div>
    <div class="navbar-center"><slot /></div>
    <div class="navbar-right">
      <el-tooltip content="主题设置">
        <el-icon class="nav-action" @click="app.openSettings()"><Setting /></el-icon>
      </el-tooltip>
      <el-tooltip :content="theme.mode === 'dark' ? '切到浅色' : '切到深色'">
        <el-icon class="nav-action" @click="toggleMode">
          <Moon v-if="theme.mode !== 'dark'" /><Sunny v-else />
        </el-icon>
      </el-tooltip>
      <el-dropdown @command="onCommand">
        <span class="user-chip">
          <el-avatar :size="28" style="background: var(--signal)">{{ avatarText }}</el-avatar>
          <span class="user-name">{{ user.info?.nickname || '未登录' }}</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { useTagsViewStore } from '@/stores/tagsView'
import {
  Expand,
  Fold,
  Setting,
  Moon,
  Sunny,
  Monitor,
  ArrowDown,
  HomeFilled
} from '@element-plus/icons-vue'
import { useInstanceStore } from '@/stores/instance'
import Breadcrumb from './Breadcrumb.vue'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()
const app = useAppStore()
const user = useUserStore()
const permission = usePermissionStore()
const tagsView = useTagsViewStore()
const instanceStore = useInstanceStore()

const avatarText = computed(() => (user.info?.nickname || 'U').slice(0, 1))
const current = computed(() => instanceStore.current)
const isHome = computed(() => route.path === '/dashboard')

function goHome() {
  router.push('/dashboard')
}

function toggle() {
  theme.sidebarCollapsed = !theme.sidebarCollapsed
}
function toggleMode() {
  theme.setMode(theme.mode === 'dark' ? 'light' : 'dark')
}
function onCommand(cmd: string) {
  if (cmd === 'logout') {
    user.logout()
    permission.reset()
    tagsView.closeAll()
    router.push('/login')
  }
}
</script>

<style scoped>
.navbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.navbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}
.nav-home {
  font-size: 14px;
  color: var(--ink-soft);
  padding: 0 6px;
}
.nav-home .el-icon {
  margin-right: 4px;
}
.nav-home:hover,
.nav-home.active {
  color: var(--signal);
}
.instance-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--ink-soft);
  background: var(--track);
  border: 1px solid var(--line);
  border-radius: var(--radius-base);
  cursor: pointer;
  max-width: 240px;
}
.instance-trigger:hover {
  border-color: var(--signal);
  color: var(--signal);
}
.it-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}
.it-dot.normal {
  background: var(--sev-ok, #15a36a);
}
.it-dot.abnormal {
  background: var(--sev-crit, #f05261);
}
.it-dot.paused {
  background: var(--faint);
}
.it-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.it-placeholder {
  color: var(--muted);
}
.it-arrow {
  font-size: 12px;
}
.navbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-text {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}
.navbar-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.collapse-btn,
.nav-action {
  cursor: pointer;
  font-size: 18px;
  color: var(--ink-soft);
}
.nav-action:hover,
.collapse-btn:hover {
  color: var(--signal);
}
.page-title {
  font-weight: 600;
  color: var(--ink);
}
.navbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.user-name {
  color: var(--ink-soft);
  font-size: 13px;
}
</style>
