/**
 * @author 彭志勇 <2457305628@qq.com>
 * @lastEditor 彭志勇 <2457305628@qq.com>
 * @lastEditTime 2024-04-24 08:36:05
 */

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag === "emoji-picker"
        }
      }
    }),
    VueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: "0.0.0.0",
    port: "8080",
    proxy: {
      "/qava": {
        // 后台地址
        target: "https://api.krumio.com/",
        changeOrigin: true,
      },
      "/mava": {
        // 后台地址
        target: "http://mio.fcip.top:6050/",
        changeOrigin: true,
      },
      "/api/gateway": {
        target: "ws://127.0.0.1:3080/",
      },
      "/api": {
        target: "http://127.0.0.1:3080/",
      }
    }
  }
})
