<template>
  <el-drawer v-model="visible" title="主题设置" size="320px" direction="rtl">
    <el-form label-position="top" class="settings-form">
      <el-form-item label="明暗模式">
        <el-radio-group v-model="mode">
          <el-radio-button value="light">浅色</el-radio-button>
          <el-radio-button value="dark">深色</el-radio-button>
          <el-radio-button value="auto">跟随系统</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="主题主色 / 信号色">
        <div class="color-row">
          <span
            v-for="c in presetColors"
            :key="c"
            class="color-dot"
            :class="{ active: theme.signalColor.toLowerCase() === c.toLowerCase() }"
            :style="{ background: c }"
            @click="theme.patch({ signalColor: c })"
          />
          <el-color-picker
            :model-value="theme.signalColor"
            @change="(v: string | null) => v && theme.patch({ signalColor: v })"
          />
        </div>
      </el-form-item>

      <el-form-item label="布局形态">
        <el-radio-group v-model="layout">
          <el-radio-button value="side">左侧</el-radio-button>
          <el-radio-button value="top">顶部</el-radio-button>
          <el-radio-button value="mix">混合</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="界面密度">
        <el-radio-group v-model="density">
          <el-radio-button value="compact">紧凑</el-radio-button>
          <el-radio-button value="default">默认</el-radio-button>
          <el-radio-button value="loose">宽松</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="圆角">
        <el-slider v-model="radius" :min="0" :max="20" />
      </el-form-item>

      <el-form-item label="基准字号">
        <el-slider v-model="fontSize" :min="12" :max="18" />
      </el-form-item>

      <el-form-item label="多标签页">
        <el-switch v-model="tagsView" />
      </el-form-item>

      <el-divider />

      <el-form-item label="严重度配色（锁定·仅整体切换）">
        <el-radio-group v-model="palette">
          <el-radio-button value="default">默认</el-radio-button>
          <el-radio-button value="colorblind">色盲友好</el-radio-button>
        </el-radio-group>
        <p class="tip">为保证告警语义可读，不开放逐色自由修改（方案 §8.5）。</p>
      </el-form-item>

      <el-button class="reset-btn" @click="theme.reset()">恢复默认</el-button>
    </el-form>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useThemeStore, type ThemeState } from '@/stores/theme'

const app = useAppStore()
const theme = useThemeStore()

const presetColors = ['#0C7C97', '#2D7FF0', '#7C5CFC', '#15A36A', '#E08600', '#E5484D']

const visible = computed({
  get: () => app.settingsVisible,
  set: (v) => (v ? app.openSettings() : app.closeSettings())
})

function bind<K extends keyof ThemeState>(key: K) {
  return computed({
    get: () => theme[key],
    set: (v) => theme.patch({ [key]: v } as Partial<ThemeState>)
  })
}

const mode = bind('mode')
const layout = bind('layout')
const density = bind('density')
const radius = bind('radius')
const fontSize = bind('fontSize')
const tagsView = bind('tagsView')
const palette = bind('palette')
</script>

<style scoped>
.settings-form {
  padding: 0 4px;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.color-dot {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.15s ease;
}
.color-dot:hover {
  transform: scale(1.12);
}
.color-dot.active {
  border-color: var(--ink);
}
.tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.reset-btn {
  width: 100%;
  margin-top: 8px;
}
</style>
