import { defineStore } from 'pinia'

interface AppState {
  /** 设置抽屉开关 */
  settingsVisible: boolean
  /** 实例选择面板开关 */
  pickerVisible: boolean
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    settingsVisible: false,
    pickerVisible: false
  }),
  actions: {
    openSettings() {
      this.settingsVisible = true
    },
    closeSettings() {
      this.settingsVisible = false
    },
    openPicker() {
      this.pickerVisible = true
    },
    closePicker() {
      this.pickerVisible = false
    }
  }
})
