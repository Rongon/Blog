/**
 * 项目数据。
 *
 * 【当前实现】写死数组。模块 5 做项目列表与详情时，会把它抽成
 *   带正文（技术难点、我的职责）的完整结构，并补上详情页。
 */

export interface ProjectMeta {
  slug: string
  name: string
  /** 一句话定位，卡片上用 */
  tagline: string
  /** 一两句说明，列表页和详情页头部用 */
  summary: string
  role: string
  period: string
  stack: string[]
  /** 卡片缩略图，public 下的绝对路径；空字符串表示暂时不放图 */
  thumb: string
  /** 站内详情页路径；没有详情页的先留空 */
  to: string
  highlights: string[]
}

export const projects: ProjectMeta[] = [
  {
    slug: 'program2026',
    name: 'Program2026 · 个人作品集与技术博客',
    tagline: '本站。同一份内容，优化前后各部署一版，数字摊开给人看。',
    summary:
      '一个纯前端的作品集 + 技术博客站点：Markdown 在构建时编译成页面，评论区用乐观更新保证即时反馈，全部图片、缓存与分包策略都做过实测对照。',
    role: '独立开发',
    period: '2026.02 - 至今',
    stack: ['Vue 3', 'TypeScript', 'Vite', 'Pinia'],
    thumb: '/images/covers/forest-sun.jpg',
    to: '/projects/program2026',
    highlights: [
      '构建时把 Markdown 编译成 HTML，客户端不下载解析器',
      '站内提供「优化前 / 优化后」两个入口，可现场对照首屏指标',
    ],
  },
  {
    slug: 'lowcode-platform',
    name: '企业内部低代码搭建平台',
    tagline: '拖拽式页面搭建，把重复的中后台页面从「写」变成「配」。',
    summary:
      '面向内部业务的中后台页面搭建工具，支持拖拽布局、物料组件配置与页面发布。',
    role: '前端开发',
    period: '2024 - 2026',
    stack: ['React', 'TypeScript', 'amis'],
    thumb: '/images/covers/forest-fog.jpg',
    to: '',
    highlights: ['用 JSON Schema 描述页面结构，实现配置与渲染分离', '沉淀了一批可复用的业务物料组件'],
  },
  {
    slug: 'goods-admin',
    name: '商品后台管理系统',
    tagline: '商品、权限与数据大屏三块，一个人从零写完。',
    summary: '商品管理后台，包含登录、SPU/SKU 管理、按角色的按钮级权限，以及一块数据大屏。',
    role: '独立开发',
    period: '2024.02 - 2024.03',
    stack: ['Vue 3', 'Element Plus', 'Pinia', 'ECharts'],
    thumb: '/images/covers/night-sky.jpg',
    to: '',
    highlights: ['用全局自定义指令做按钮级权限，减少模板里的判断', '数据大屏用 scale 适配不同分辨率'],
  },
]

export function getFeaturedProjects(limit = 2): ProjectMeta[] {
  return projects.slice(0, limit)
}
