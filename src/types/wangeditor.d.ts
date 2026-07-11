// @wangeditor/editor-for-vue 的 package.json exports 未正确暴露类型，这里声明为宽松的 Vue 组件以供使用。
declare module '@wangeditor/editor-for-vue' {
  import type { DefineComponent } from 'vue'
  export const Editor: DefineComponent<any, any, any>
  export const Toolbar: DefineComponent<any, any, any>
}
