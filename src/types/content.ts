/**
 * 内容层的共享类型。
 *
 * 抽到单独文件的原因：这些类型同时被三个地方用——
 *   ① 构建期的 Vite 插件（plugins/markdown.ts，在 Node 里跑）
 *   ② 运行期的数据层（src/data/posts.ts，在浏览器里跑）
 *   ③ `*.md` 的模块声明（env.d.ts）
 * 放一起才不会出现「两处定义悄悄写歪」的情况。
 */

/** 文章正文里抽出来的一个标题，用来生成侧边目录 */
export interface TocItem {
  /** 页面上的锚点 id */
  id: string
  /** 标题文字 */
  text: string
  /** 2 或 3，对应 h2 / h3 */
  level: number
}

/** Markdown 文件头部 frontmatter 里写的字段 */
export interface PostFrontmatter {
  title: string
  summary: string
  category: string
  tags: string[]
  /** YYYY-MM-DD */
  date: string
  readingMinutes: number
  /** public 下的绝对路径 */
  cover: string
}

/** frontmatter + 由文件名推导出的 slug */
export interface PostMeta extends PostFrontmatter {
  slug: string
}

/** 自写 Vite 插件编译一个 .md 之后，模块里导出的东西 */
export interface MarkdownModule {
  meta: PostFrontmatter
  html: string
  toc: TocItem[]
}
