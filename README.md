# Blog · 个人技术博客

一个前端的技术博客，同时是一轮**性能优化的完整记录**：同一份源码、同一批内容，用两个 build mode 各构建一次，部署成一个站点的两个入口。谁都能打开、能自己跑分、能对着代码看每一项改了什么。

- 优化后：https://rongon.github.io/Blog/
- 优化前：https://rongon.github.io/Blog/naive/

两个版本共用右上角的一个「优化后 | 优化前」开关，同一个标签页跳转。**除了性能，页面文字、结构、样式完全一致** —— 这是这个项目的核心约束，不是巧合：`scripts/check-parity.mjs` 每次部署前会逐页比对两版的静态文字与结构，不一致就让 CI 失败。

## 差多少

同一台机器、Lighthouse 13.5.0、`--preset=desktop`、冷缓存（每次新建 Chrome 用户目录），各跑 5 次取中位数。

| 指标 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| Performance（中位） | 52（区间 46–76） | 99（区间 99–100） | — |
| LCP（最大内容绘制） | 8,673 ms | 694 ms | **−92.0%** |
| TBT（总阻塞时间） | 57 ms | 15 ms | **−73.7%** |
| CLS（累积布局偏移） | 0.548 | 0 | 归零 |
| 首屏总传输 | 28,551 KiB（29.2 MB） | 1,286 KiB（1.3 MB） | **−95.5%** |
| └ 图片 | 28,046 KiB | 1,090 KiB | −96.1% |
| └ 脚本 | 416 KiB | 144 KiB | −65.4% |
| 请求数 | 21 | 23 | — |

字节数是唯一不抖的数：同一份构建跑五次，1,286 KiB 一个字节都不变；LCP 在 451–748 ms 之间浮动，优化前那边甚至会在 5,579–9,336 ms 之间跳。所以判断一项优化有没有用，看的是一组数，不是单次分数。原始报告在 `perf/final-*.json`，中位数汇总在 `perf/final-summary.json`，文章里的图由 `scripts/build-charts.mjs` 直接读这些 JSON 生成。

## 声明口径

- **只测桌面**。移动端只保证功能可用（两版都要能用、都能点），不统计性能数字，这是明确的边界。
- **没有基线的项不记成绩**。GitHub Pages 自带 CDN / HTTP/2 / 压缩，这些没有「开 / 不开」两个版本可比，不算分。
- **FCP 不引用**。两版都是 SPA，FCP 由 simulate 模型推算，区间还会重叠。

## 技术栈

Vue 3 · TypeScript · Vite 8 · Vue Router 5 · Pinia 4 · Element Plus（按需引入）· SCSS · markdown-it · Shiki · Supabase · sharp

## 功能

- **文章**：Markdown 在**构建期**编译成 HTML 和元数据，Shiki 高亮也只在构建期跑 —— 客户端不下载任何 Markdown 解析器或高亮器
- **检索**：分页、分类、标签、关键词四维组合筛选，全部条件以 URL query 为唯一数据源，刷新与前进后退都能还原，非法参数自动纠正
- **评论**：乐观更新（点发表立刻上屏）+ 失败按 id 精确回滚 + `client_id` 幂等键 + 服务端 30 秒限流
- **登录**：只保留 GitHub OAuth，站内不存密码；顶栏「登录」直接开始授权，不经过中间页
- **主题**：报纸/出版风的浅色与深色，跟随系统偏好并记住手动选择；`index.html` 里有一段同步脚本，在样式之前就把主题定好，避免刷新时白闪
- **响应式**：四档断点（≤1199 / ≤899 / ≤599），图片走 `srcset` + `sizes` 按视口选档，窄屏用右上角三条杠菜单

## 十项优化（每一步一个 tag）

| # | 做了什么 | tag |
| --- | --- | --- |
| 0 | 基线：把当时还没优化的版本冻结下来 | `v0-naive` |
| 1 | 图片全部转 WebP（21 张，36.6 → 20.2 MB） | `v1-webp` |
| 2 | 响应式图片 `srcset` + `sizes`（收益最大的一项） | `v2-srcset` |
| 3 | 非首屏图片懒加载（桌面省 0 字节，如实记录） | `v3-lazy` |
| 4 | 图片补 `width`/`height`（CLS 0.548 → 0） | `v4-dimensions` |
| 5 | 路由级代码分割 | `v5-codesplit` |
| 6 | Element Plus 按需引入（省约 200 KiB） | `v6-ondemand` |
| 7 | 图片质量收口（题图按张降质 + 编码 effort） | `v7-imagequality` |
| 8 | 登录 SDK 移出首屏包 | `v8-asyncauth` |
| 9 | 关键资源 preload + 空闲预取路由 | `v9-preload` |
| 10 | 原始 JPG 移出 `public/`（主产物 69 → 33.8 MB） | `v10-trimpublic` |

`git show <tag>` 看每一步改了什么；每一步的 Lighthouse 原始报告在 `perf/`。表里没写逐项字节数，因为**每一步的产物和今天的产物已经不是同一份**（页面改过好几轮），逐项数字只在文档里作为过程值保留，结论以本文开头那张 5 次中位数的表为准。

## 本地运行

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # vue-tsc --noEmit + vite build
pnpm preview      # 预览构建产物
pnpm typecheck    # 只做类型检查
```

需要 Node 22+、pnpm 11+。

`.env` 里是两个 Supabase 配置项。**它们是公开的**：`anon`（publishable）key 按设计就会进前端 bundle，安全性由数据库 RLS 策略保证，不是靠藏 key。

### 构建两个版本

```bash
# 优化后（GitHub Pages 路径）
pnpm build --mode ghpages

# 优化前：同一份源码，用 naive 模式把十项优化逐个关掉
pnpm exec vite build --mode naive
node scripts/copy-naive-images.mjs         # 把原始 JPG 放进 dist-naive/images
# dist-naive 的产物整体放进 dist/naive/，并复制一份 404.html
```

`vite.config.ts` 里只有一个 `naive` 分支，负责把优化一个个关掉：路由改静态导入、Element Plus 改整包、启动时同步初始化登录、图片组件换成裸 `<img>`、走另一个 HTML 入口（去掉预加载）。**没有第二套代码库**，两版共享同一份 `src/`。

### 一致性检查

```bash
pnpm build --mode ghpages && pnpm exec vite build --mode naive
# 组装好 dist/naive/ 之后：
pnpm check:parity      # 22 条「路由 × 视口」逐页比对 + 移动端交互冒烟
```

用的是 runner 自带的 Chrome + CDP，零依赖。它比的是渲染后的静态文字与结构（评论区排除，因为那是运行时数据）。

## 目录结构

```
src/
  components/   通用组件（响应式图片、卡片、评论、版本开关、登录态菜单）
  composables/  usePostQuery（URL 作为筛选状态）、useTheme
  data/         文章/项目元数据、图片清单（构建期生成）、违禁词
  layouts/      顶栏 + 移动端菜单
  lib/          asset()（拼 BASE_URL）、Supabase 客户端、路由预取、登录态存储
  plugins/      element.ts（按需引入）、element.naive.ts（整包）
  router/       index.ts、index.naive.ts（优化前：全静态导入）
  services/     文章与评论接口
  stores/       Pinia（登录态、评论）
  styles/       设计变量、全局样式、断点
  views/        页面
  main.ts       优化后入口
  main.naive.ts 优化前入口（同步初始化登录、整包 Element Plus）
content/posts/  文章源文件（Markdown + frontmatter）
plugins/        markdown.ts：构建期把 Markdown 编译成 HTML
raw-images/     原始 JPG（不进构建，只作为转 WebP 与「优化前」的输入）
public/         进构建的静态资源（webp、字体、图标）
scripts/        optimize-images / rewrite-image-refs / copy-naive-images / check-parity / build-charts
supabase/       数据库 schema（表、RLS 策略、限流触发器）
perf/           Lighthouse 原始报告（含历史 step 报告与最终 final 报告）
```

## 部署

推送到 `main` 就自动部署到 GitHub Pages（`.github/workflows/deploy.yml`）。一次运行里做四件事：

1. 用 `ghpages` 模式构建优化后版本 → 站点根路径
2. 用 `naive` 模式构建优化前版本 → 拷进 `dist/naive/`，并把原始 JPG 一起放进去
3. 跑 `pnpm check:parity`：两版不一致就让这次部署失败
4. 上传产物

另外 `.github/workflows/keepalive.yml` 每周一、周四给 Supabase 打一次请求 —— 免费项目连续 7 天没有活动会被暂停，暂停后评论区会失效且不会自愈。

## 为什么值得看

- **对照实验是真的**：两版同源码、同内容、同域名，唯一的变量是性能；不是拿旧截图讲故事。
- **没起作用的那几项也写着**：懒加载在桌面省 0 字节、代码分割在首页省 0 字节，都留在文档里。
- **数字可复现**：`perf/*.json` 是 Lighthouse 原样输出的报告，跑法和口径都写在文档里，换台机器跑不会差一个数量级。

## 关于这个项目

设计上刻意避开「卡片 + 阴影 + 圆角」，走报纸/出版排版：细线、衬线字体、大量留白。中文字体用系统自带衬线栈（0 字节），拉丁字母用自托管的 PT Serif 子集（61.2 KB）。
