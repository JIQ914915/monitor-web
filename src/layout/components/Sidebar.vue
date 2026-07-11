<template>
  <aside class="sidebar" :class="{ collapsed: theme.sidebarCollapsed }">
    <div v-if="withLogo" class="logo">
      <el-icon :size="22" color="var(--signal)"><Monitor /></el-icon>
      <span v-show="!theme.sidebarCollapsed" class="logo-text">数据库监控</span>
    </div>
    <el-scrollbar class="menu-scroll">
      <el-menu :default-active="activeMenu" :collapse="theme.sidebarCollapsed" router unique-opened>
        <!-- 动态菜单（按权限下发；mix 模式下传入当前一级的子菜单）。总览通过顶栏「首页」按钮跳转 -->
        <MenuItem v-for="m in renderMenus" :key="m.path" :item="m" :base-path="basePath" />
      </el-menu>
    </el-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Monitor } from '@element-plus/icons-vue'
import MenuItem from './MenuItem.vue'
import { useThemeStore } from '@/stores/theme'
import { usePermissionStore } from '@/stores/permission'
import type { MenuNode } from '@/types'

const props = withDefaults(
  defineProps<{
    /** 渲染的菜单集合；不传则用全量权限菜单（左侧布局） */
    menus?: MenuNode[]
    /** 菜单项基路径（mix 模式传入当前一级路径，叶子才能解析出完整 path） */
    basePath?: string
    withLogo?: boolean
  }>(),
  { basePath: '/', withLogo: true }
)

const route = useRoute()
const theme = useThemeStore()
const permission = usePermissionStore()

const renderMenus = computed(() => props.menus ?? permission.menus)
const activeMenu = computed(() => (route.meta.activeMenu as string) || route.path)
</script>

<style scoped>
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}
.sidebar.collapsed {
  width: 64px;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.logo-text {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}
.menu-scroll {
  flex: 1;
}
.menu-scroll :deep(.el-menu) {
  border-right: none;
  background: transparent;
}
</style>
