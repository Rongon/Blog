/**
 * 项目数据。
 *
 * 【当前实现】写死数组（都是纯文本，没有 IO）。
 * 【以后要换】接 CloudBase 时只替换本文件内部的取数实现，
 *   `getProjectBySlug` / `getFeaturedProjects` 的签名不变，页面代码不用动。
 *
 * 文案口径提醒：正文里的数字与措辞对不上简历时，以实际测到的为准，别倒过来改数字。
 */

export interface ProjectSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface ProjectLink {
  label: string
  href: string
}

export interface ProjectMeta {
  slug: string
  name: string
  /** 一句话定位，卡片上用 */
  tagline: string
  /** 一两句说明，列表页与详情页头部用 */
  summary: string
  role: string
  period: string
  stack: string[]
  /** 卡片缩略图，public 下的绝对路径；空字符串表示暂时不放图 */
  thumb: string
  /** 站内详情页路径；空字符串表示暂无详情页，卡片不可点 */
  to: string
  /** 卡片上的两条重点 */
  highlights: string[]
  /** 详情页正文 */
  sections: ProjectSection[]
  links?: ProjectLink[]
}

export const projects: ProjectMeta[] = [
  {
    slug: 'program2026',
    name: 'Program2026 · 个人作品集与技术博客',
    tagline: '本站。同一份内容，优化前后各部署一版，数字摊开给人看。',
    summary:
      '一个纯前端的作品集 + 技术博客站点：Markdown 在构建时编译成页面，评论区用乐观更新保证即时反馈，图片、缓存与分包策略都做过实测对照。',
    role: '独立开发',
    period: '2026.02 - 至今',
    stack: ['Vue 3', 'TypeScript', 'Vite', 'Pinia', 'Markdown-it', 'Shiki'],
    thumb: '/images/covers/forest-sun.jpg',
    to: '/projects/program2026',
    highlights: [
      '构建时把 Markdown 编译成 HTML，客户端不下载任何解析器',
      '站内提供「优化前 / 优化后」两个入口，可现场对照首屏指标',
    ],
    links: [{ label: '源码仓库', href: 'https://github.com/Rongon/Program2026' }],
    sections: [
      {
        heading: '这个站想解决什么问题',
        paragraphs: [
          '面试官打开一个作品集，最想知道三件事：这人能不能写、有没有自己的判断、讲不讲得清楚。前两件事靠代码，第三件事靠页面本身。',
          '所以我没有把它做成一份「亮技能条」的简历页，而是当成一个真实的小产品在做：有内容、有评论、有取舍记录，也把「怎么验证」这一步留在站内。',
        ],
      },
      {
        heading: '几个主要的技术决定',
        bullets: [
          '**文章走构建时渲染**：自己写了一个 Vite 插件，在打包阶段用 markdown-it + Shiki 把 .md 编译成 HTML，客户端一个解析库都不下载。代价是改文章要重新构建部署——对博客来说这个代价可以接受。',
          '**URL 是筛选状态的唯一数据源**：分页、分类、标签、关键词全部写进 query，页面只是读它。好处是刷新、前进后退、分享链接都能还原视图。',
          '**评论区用乐观更新**：点发表先上屏，请求失败再干净地回滚，配合客户端临时 id 与防重复提交保证状态一致。',
          '**不做后端**：后端不写进简历，也不假装会。内容存在仓库里，评论与登录用云开发服务，数据层抽成适配器，换实现不影响页面。',
        ],
      },
      {
        heading: '性能优化这一块是怎么做的',
        paragraphs: [
          '这类内容最容易被问穿，所以我用了最笨但最经得起问的办法：功能写完先打一个 git tag 把「优化前」冻结住，之后一项一项地优化，每改一项就重新构建、重新跑一次 Lighthouse，把原始 JSON 存进仓库。',
        ],
        bullets: [
          '两个版本都真实部署，站内给两个入口，面试官可以自己点开对比',
          '每一项都记「预期收益 vs 实测收益」，**没有效果的那几项也如实写上**',
          '所有数字都来自 Lighthouse 的 JSON 报告，跑测命令写在 README 里，可以自己复现',
        ],
      },
      {
        heading: '已知的不足',
        bullets: [
          '慢版只能体现在前端能控制的那几项上：免费托管会自动给两个版本都加上 CDN、HTTP/2 与压缩，服务端类优化在线上看不出差别。',
          '「服务器带宽升级」这一项没有真实带宽可升，只用网络节流做等效演示，页面上如实标注了。',
          '评论与登录依赖第三方云服务，离线环境下不可用；本地有纯前端的降级实现。',
        ],
      },
    ],
  },
  {
    slug: 'lowcode-platform',
    name: '企业内部低代码搭建平台',
    tagline: '拖拽式页面搭建，把重复的中后台页面从「写」变成「配」。',
    summary:
      '面向内部业务的中后台页面搭建工具：拖拽布局、物料组件配置、页面发布，交付给多个业务团队使用。',
    role: '前端开发',
    period: '2024 - 2026',
    stack: ['React', 'TypeScript', 'amis'],
    thumb: '/images/covers/forest-fog.jpg',
    to: '/projects/lowcode-platform',
    highlights: [
      '用 Schema 描述页面结构，配置与渲染分离',
      '沉淀了一批可复用的业务物料组件',
    ],
    sections: [
      {
        heading: '背景',
        paragraphs: [
          '公司内部有大量长得差不多的中后台页面：查询表单、表格、详情、弹窗。每个都手写一遍，模板代码多、改动还要一个个改。',
          '这个平台的目标是让业务同学自己拖出一个页面：布局和组件从物料库里选，数据源与字段靠配置绑定，配完直接发布。',
        ],
      },
      {
        heading: '我负责的部分',
        bullets: [
          '页面的 Schema 结构设计与解析：一份 JSON 描述布局树与组件属性，渲染层负责把它变成真实界面。',
          '物料组件的接入规范：每个物料声明自己的属性面板配置，平台按声明自动生成属性编辑器。',
          '与后端的发布流程对接：页面配置保存、版本记录、发布与回滚。',
        ],
      },
      {
        heading: '两个取舍',
        bullets: [
          '**配置格式用 JSON Schema，而不是自己发明一套 DSL**——上手成本低，出问题也好排查，业务同学看得懂。',
          '**复杂交互不硬塞进低代码**：遇到明显超出配置能力的页面，就允许嵌入自定义组件，而不是把配置项无限堆下去。',
        ],
      },
    ],
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
    to: '/projects/goods-admin',
    highlights: [
      '用全局自定义指令做按钮级权限，减少模板里的判断',
      '数据大屏用 scale 适配不同分辨率',
    ],
    sections: [
      {
        heading: '做了什么',
        bullets: [
          '用户登录与权限：登录后拿到角色，路由与按钮两级控制。',
          '商品管理：SPU/SKU 的列表、新增与编辑，包含大量字段的表单与图片上传。',
          '数据大屏：一屏展示核心指标与趋势图。',
        ],
      },
      {
        heading: '两个实现细节',
        bullets: [
          '**按钮级权限做成全局指令**：在模板上写 `v-permission="\'goods:add\'"`，由指令决定元素是否渲染，避免在每个按钮外面套 v-if。',
          '**大屏适配用 scale 而不是响应式断点**：大屏是按设计稿等比缩放的展示场景，不是内容自适应的阅读场景，用 transform: scale 保持比例更合适。',
        ],
      },
    ],
  },
]

export function getProjectBySlug(slug: string): ProjectMeta | undefined {
  return projects.find((p) => p.slug === slug)
}

export function getFeaturedProjects(limit = 2): ProjectMeta[] {
  return projects.slice(0, limit)
}

/** 上一个 / 下一个项目，详情页底部用 */
export function getAdjacentProjects(slug: string): { prev?: ProjectMeta; next?: ProjectMeta } {
  const i = projects.findIndex((p) => p.slug === slug)
  if (i < 0) return {}
  return { prev: projects[i - 1], next: projects[i + 1] }
}
