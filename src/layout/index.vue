<template>
  <div class="app-layout" :class="`layout-${theme.layout}`">
    <!-- 左侧布局：完整侧边栏（菜单已按当前实例类型过滤） -->
    <Sidebar v-if="theme.layout === 'side'" :menus="sideMenus" />
    <!-- 混合布局：侧边栏仅显示当前一级的子菜单；当前一级无子菜单时不显示，内容占满宽度 -->
    <Sidebar
      v-else-if="theme.layout === 'mix' && mixChildren.length"
      :menus="mixChildren"
      :base-path="activeRootPath"
    />

    <div class="app-main">
      <Navbar>
        <!-- 顶部布局：完整横向菜单 -->
        <TopMenu v-if="theme.layout === 'top'" :menus="rootMenus" />
        <!-- 混合布局：横向仅一级 -->
        <TopMenu v-else-if="theme.layout === 'mix'" :menus="rootMenus" only-root />
      </Navbar>
      <TagsView v-if="theme.tagsView" />
      <section class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </section>
    </div>
    <SettingsDrawer />
    <InstancePicker />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'
import TagsView from './components/TagsView.vue'
import TopMenu from './components/TopMenu.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import InstancePicker from './components/InstancePicker.vue'
import { useThemeStore } from '@/stores/theme'
import { usePermissionStore } from '@/stores/permission'
import { useInstanceStore } from '@/stores/instance'
import { filterMenusForInstance } from '@/utils/instanceMenu'
import type { MenuNode } from '@/types'

const theme = useThemeStore()
const route = useRoute()
const permission = usePermissionStore()
const instanceStore = useInstanceStore()

// 顶层菜单（常驻总览 + 权限下发的一级）；监控视图下的类型分组按当前实例的数据库类型过滤
const sideMenus = computed<MenuNode[]>(() =>
  filterMenusForInstance(permission.menus, instanceStore.current))

const rootMenus = computed<MenuNode[]>(() => [
  { path: '/dashboard', name: 'Dashboard', meta: { title: '总览', icon: 'Odometer' } },
  ...sideMenus.value
])

function rootPath(m: MenuNode): string {
  return m.path.startsWith('/') ? m.path : '/' + m.path
}

// 当前激活的一级（mix 模式据此联动侧栏）
const activeRootPath = computed(() => '/' + (route.path.split('/')[1] || 'dashboard'))
const activeRoot = computed(() => rootMenus.value.find((m) => rootPath(m) === activeRootPath.value))
const mixChildren = computed<MenuNode[]>(() => activeRoot.value?.children ?? [])
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100%;
  background: var(--canvas);
}
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.app-content {
  flex: 1;
  overflow: auto;
  padding: var(--content-pad);
}
.layout-top {
  flex-direction: column;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
