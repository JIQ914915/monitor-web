import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { setupDirectives } from './directives/permission'
import { useThemeStore } from './stores/theme'
import { setupErrorMonitor } from './utils/errorMonitor'

import './assets/theme/tokens.css'
import './assets/theme/dark.css'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)

// 应用持久化的主题（运行时换肤）
useThemeStore().apply()

app.use(router)
app.use(ElementPlus)
setupDirectives(app)

// 全局错误监控：捕获 Vue 组件错误、未处理异常与 Promise rejection
setupErrorMonitor(app)

app.mount('#app')
