import { defineStore } from 'pinia'
import { getThemePref, saveThemePref, type ThemePref } from '@/api/preference'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type Density = 'compact' | 'default' | 'loose'
export type LayoutMode = 'side' | 'top' | 'mix'
export type Palette = 'default' | 'colorblind'

export interface ThemeState {
  /** 明暗模式（可配） */
  mode: ThemeMode
  /** 品牌主色 / 信号色（可配） */
  signalColor: string
  /** 界面密度（可配） */
  density: Density
  /** 布局形态（可配） */
  layout: LayoutMode
  /** 基准圆角档位 px（可配） */
  radius: number
  /** 基准字号 px（可配） */
  fontSize: number
  /** 严重度配色预设：default | colorblind（锁定逐色改，仅整体切换） */
  palette: Palette
  /** 是否显示多标签页 */
  tagsView: boolean
  /** 侧边栏折叠 */
  sidebarCollapsed: boolean
}

const DEFAULT_STATE: ThemeState = {
  mode: 'light',
  signalColor: '#0C7C97',
  density: 'default',
  layout: 'side',
  radius: 10,
  fontSize: 14,
  palette: 'default',
  tagsView: true,
  sidebarCollapsed: false
}

let mql: MediaQueryList | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

/** 账号级持久化的字段（不含临时态如折叠状态） */
const PERSIST_KEYS: (keyof ThemeState)[] = [
  'mode',
  'signalColor',
  'density',
  'layout',
  'radius',
  'fontSize',
  'palette',
  'tagsView'
]

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({ ...DEFAULT_STATE }),
  actions: {
    /** 把当前主题写入 :root（运行时换肤，无需重编译） */
    apply() {
      const root = document.documentElement
      const isDark =
        this.mode === 'dark' ||
        (this.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.classList.toggle('dark', isDark)
      root.dataset.density = this.density
      root.dataset.palette = this.palette
      root.style.setProperty('--signal', this.signalColor)

      // 基准字号：同时联动 Element Plus 字号档位，使菜单/表格/表单文字整体缩放
      const fs = this.fontSize
      root.style.setProperty('--font-size-base', `${fs}px`)
      root.style.setProperty('--el-font-size-base', `${fs}px`)
      root.style.setProperty('--el-font-size-extra-large', `${fs + 6}px`)
      root.style.setProperty('--el-font-size-large', `${fs + 4}px`)
      root.style.setProperty('--el-font-size-medium', `${fs + 2}px`)
      root.style.setProperty('--el-font-size-small', `${fs - 1}px`)
      root.style.setProperty('--el-font-size-extra-small', `${fs - 2}px`)

      // 圆角：由基准值派生整套档位，并联动 Element Plus，确保卡片/控件可见变化
      const r = Math.max(0, this.radius)
      root.style.setProperty('--radius-sm', `${Math.round(r * 0.6)}px`)
      root.style.setProperty('--radius-base', `${r}px`)
      root.style.setProperty('--radius-lg', `${Math.round(r * 1.4)}px`)
      root.style.setProperty('--el-border-radius-base', `${r}px`)
      root.style.setProperty('--el-border-radius-small', `${Math.round(r * 0.6)}px`)

      this.bindAuto()
    },
    /** auto 模式跟随系统切换 */
    bindAuto() {
      if (!mql) {
        mql = window.matchMedia('(prefers-color-scheme: dark)')
        mql.addEventListener('change', () => {
          if (this.mode === 'auto') this.apply()
        })
      }
    },
    setMode(mode: ThemeMode) {
      this.mode = mode
      this.apply()
      this.saveRemote()
    },
    patch(partial: Partial<ThemeState>) {
      Object.assign(this, partial)
      this.apply()
      this.saveRemote()
    },
    reset() {
      Object.assign(this, DEFAULT_STATE)
      this.apply()
      this.saveRemote()
    },
    /** 登录后从后端加载账号级主题，合并覆盖本地缓存（系统默认 + 用户覆盖，§8.5） */
    async loadRemote() {
      try {
        const pref = await getThemePref()
        if (pref && typeof pref === 'object') {
          const partial: Record<string, unknown> = {}
          for (const k of PERSIST_KEYS) {
            if (pref[k] !== undefined) partial[k] = pref[k]
          }
          Object.assign(this, partial)
        }
      } catch {
        // 后端不可用/未登录时静默回落本地缓存
      }
      this.apply()
    },
    /** 变更防抖回写后端（账号级持久化） */
    saveRemote() {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        const pref: ThemePref = {}
        for (const k of PERSIST_KEYS) pref[k] = this[k]
        saveThemePref(pref).catch(() => {
          /* 忽略保存失败，本地缓存仍生效 */
        })
      }, 600)
    }
  },
  persist: true
})
