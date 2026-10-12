/// <reference types="vite/client" />

/**
 * 环境变量的类型。Vite 只把 `VITE_` 开头的变量暴露给客户端代码，
 * 所以这里声明两个之后，`import.meta.env.VITE_SUPABASE_URL` 就有类型了。
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/**
 * .md 文件的模块形状，由 plugins/markdown.ts 在构建时生成。
 * 声明在这里，TypeScript 才知道 import 一个 .md 会拿到什么。
 */
declare module '*.md' {
  import type { PostFrontmatter, TocItem } from './src/types/content'
  export const meta: PostFrontmatter
  export const toc: TocItem[]
  export const html: string
}
