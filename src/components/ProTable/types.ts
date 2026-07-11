/** 表格列定义 */
export interface TableColumn {
  /** 字段名，渲染纯文本列时必须 */
  prop?: string
  /** 列标题 */
  label: string
  width?: number | string
  minWidth?: number | string
  /** 单元格内容对齐 */
  align?: 'left' | 'center' | 'right'
  /** 表头对齐，不设时同 align */
  headerAlign?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  /** 超出省略 tooltip，默认 true */
  showOverflowTooltip?: boolean
  /** 是否可排序 */
  sortable?: boolean | string
  /**
   * 自定义 slot 名称。
   * 模板中使用 <template #[col.slot]="{ row, $index }"> 渲染单元格内容。
   */
  slot?: string
  /** 格式化函数，返回字符串（优先级低于 slot） */
  formatter?: (row: any) => string | number
  /** 初始隐藏该列（可通过列设置面板重新显示） */
  hide?: boolean
}

/** 抽屉打开模式 */
export type DrawerMode = 'create' | 'edit' | 'view'
