import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia']
      }),
      Components({
        resolvers: [ElementPlusResolver()]
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      // 工程路径含空格时，rolldown 解析 index.html 入口会失败，显式给绝对路径
      rollupOptions: {
        input: fileURLToPath(new URL('./index.html', import.meta.url))
      }
    },
    server: {
      host: '0.0.0.0',
      // 5173 落在本机 Windows 保留端口段 5076-5175（Hyper-V 等），会 EACCES
      port: 3000,
      proxy: {
        // 代理整个 /api 前缀（含 /api/v1、日后 /api/v2），目标为 monitor-admin（无 context-path）
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true
        }
      }
    }
  }
})
