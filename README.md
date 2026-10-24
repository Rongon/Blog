# Blog · 个人技术博客

一个纯前端的技术博客，同时是一轮**性能优化的完整记录**：同一份内容、同一份源码，部署了优化前和优化后两个版本，可以随时打开对比，数字都来自 `perf/` 里存档的原始报告。

## 在线地址

| 版本 | 地址 | 是什么 |
| --- | --- | --- |
| **优化后** | https://rongon.github.io/Blog/ | 下面 10 项优化全部生效 |
| **优化前** | https://rongon.github.io/Blog/naive/ | 同一份源码，用 `--mode naive` 关掉这 10 项优化后构建的版本 |

两个版本之间可以互相切换，导航栏下方右上角有一个「优化后 \| 优化前」的开关，同一个标签页，不新开窗口。

## 首屏差多少

同一台机器、同一个 Lighthouse 13.5.0、`--preset=desktop`、冷缓存，各跑 5 次取中位数。

| 指标 | 慢版 | 快版 | 变化 |
| --- | --- | --- | --- |
| LCP（最大内容绘制） | 7,810 ms | 1,127 ms | **−85.6%** |
| TBT（总阻塞时间） | 208 ms | 43 ms | **−79.3%** |
| CLS（累积布局偏移） | 0.418 | 0 | 归零 |
| 首屏总传输 | 30,377 KiB | 1,097 KiB | **−96.4%** |
| └ 图片 | 29,886 KiB | 901 KiB | −97% |
| └ 脚本 | 402 KiB | 143 KiB | −64% |
| 请求数 | 24 | 22 | — |

字节数是这里面唯一不抖的数：同一份构建跑五次，1,097 KiB 一个字节都不变；LCP 会在 782–1,191 ms 之间浮动。所以判断一项优化有没有用，看的是一组数，不是单次分数。

## 技术栈

Vue 3 · TypeScript · Vite 8 · Vue Router 5 · Pinia 4 · Element Plus（按需引入）· SCSS · markdown-it · Shiki · Supabase · sharp

## 功能

- **文章**：Markdown 在**构建期**编译成 HTML 和元数据，Shiki 做代码高亮也只在构建期跑 —— 客户端不下载任何 Markdown 解析器和语法高亮器
- **检索**：分页、分类、标签、关键词四维组合筛选，全部条件以 URL query 为唯一数据源，刷新和浏览器前进后退都能还原；非法参数会被自动纠正
- **评论**：乐观更新（点发表立刻上屏）+ 失败按 id 精确回滚 + `client_id` 幂等键 + 30 秒限流
- **主题**：报纸/出版风的浅色与深色两套，跟随系统偏好并记住手动选择
- **响应式**：四档断点，图片走 `srcset` + `sizes`，按视口宽度选档

## 10 项优化（每一项一个 tag）

| # | 做了什么 | tag | 首屏传输 |
| --- | --- | --- | --- |
| 0 | 优化前的原始版本（基线） | `v0-naive` | 30,343 KiB |
| 1 | 图片全部转 WebP | `v1-webp` | 18,166 KiB |
| 2 | 响应式图片（`srcset` + `sizes`） | `v2-srcset` | 1,785 KiB |
| 3 | 非首屏图片懒加载 | `v3-lazy` | 1,785 KiB |
| 4 | 图片补齐 `width`/`height`（CLS 归零） | `v4-dimensions` | 1,541 KiB |
| 5 | 路由级代码分割 | `v5-codesplit` | 1,538 KiB |
| 6 | Element Plus 按需引入 | `v6-ondemand` | 1,291.7 KiB |
| 7 | 图片质量收口（按张降质 + 编码 effort） | `v7-imagequality` | 1,142.5 KiB |
| 8 | 登录 SDK 移出首屏包 | `v8-asyncauth` | 1,086.7 KiB |
| 9 | 关键资源 preload + 空闲预取路由 | `v9-preload` | 1,096.7 KiB |
| 10 | 原始 JPG 移出 `public/`（部署体积 69 → 33.8 MB） | `v10-trimpublic` | 不变 |

`git show <tag>` 能看到每一步改了什么，`perf/` 里是每一步的 Lighthouse 原始报告（JSON）。

## 本地运行

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

构建与类型检查：

```bash
pnpm build      # vue-tsc --noEmit + vite build
pnpm preview    # 预览构建产物
```

需要 Node 22+、pnpm 11+。

`.env` 里是两个 Supabase 配置项。**它们是公开的**：`anon`（publishable）key 按设计就会被打进前端 bundle，安全性由数据库的 RLS 策略保证，不是靠藏这个 key。仓库里的 `.env` 指向一个真实的免费项目，所以本地跑起来评论功能是可用的。

## 目录结构

```
src/
  components/   通用组件（图片、卡片、评论、版本切换…）
  composables/  usePostQuery（URL 作为筛选状态）、useTheme
  data/         文章与项目的元数据、图片清单（构建期生成）
  layouts/      顶栏 + 页脚
  lib/          asset()（拼 BASE_URL）、Supabase 客户端、预取、登录态存储
  plugins/      markdown 编译插件（构建期）
  services/     评论接口
  stores/       Pinia
  styles/       设计变量、全局样式、断点
  views/        页面
content/posts/  文章源文件（Markdown + frontmatter）
raw-images/     原始 JPG（不进构建，只作为转 WebP 的输入）
public/         进构建的静态资源（webp、字体、图标）
scripts/        图片处理、版本开关注入
supabase/       数据库 schema（表、RLS 策略、限流触发器）
perf/           Lighthouse 原始报告
```

## 部署

推送到 `main` 就自动部署到 GitHub Pages（`.github/workflows/deploy.yml`）。这个 workflow 会做两件事：

1. 构建当前代码 → 站点的根路径
2. 检出 `v0-naive` tag 到独立 worktree 重新构建 → 放进 `/naive/`，并在产物里注入那条版本开关

所以两个版本**一起**发布，慢版永远是那个 tag 的真实产物，不会被后来的改动污染。

`.github/workflows/keepalive.yml` 每周一、周四给 Supabase 打一次请求 —— 免费项目连续 7 天没有活动会被暂停，暂停后评论区会失效且不会自愈。

## 关于这个项目

- 内容是中文的，因为读者是国内的前端面试官。
- 设计上刻意避开了常见的「卡片 + 阴影 + 圆角」风格，走报纸/出版的排版：细线、衬线字体、大量留白。中文字体用系统自带的衬线栈（0 字节），拉丁字母用自托管的 PT Serif 子集（61.2 KB）。
