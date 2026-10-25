---
title: 一次部署，发布两个站
summary: 推一次代码，线上同时更新「优化后」和「优化前」两个站点。做法是同一份源码构建两次，一次发布。
category: 技术
tags: [部署, GitHub Actions, 工程实践]
date: 2026-04-02
readingMinutes: 7
cover: /images/covers/waterfall.webp
---

这个仓库推一次代码，线上会更新两个站点：

| 路径 | 是什么 |
| --- | --- |
| `/Blog/` | 优化后的当前版本 |
| `/Blog/naive/` | 优化前，同一份源码关掉那十项优化 |

两个版本在同一个域名下、同一个产物里，所以同源、同一份 404 回退、同一次发布。

麻烦的地方不是「怎么构建两次」，而是**让两个版本之间只剩性能这一个变量**。

## 一、两个版本从哪来

不是两份代码，也不是两份仓库。是**同一份源码构建两次**，用构建模式区分：

```bash
pnpm build --mode ghpages          # 优化后 → dist/       base = /Blog/
pnpm exec vite build --mode naive  # 优化前 → dist-naive/ base = /Blog/naive/
```

`vite.config.ts` 里只有一个 `naive` 分支，它负责把十项优化逐项关掉：

| 关掉什么 | 怎么关 | 对应优化项 |
| --- | --- | --- |
| 路由级代码分割 | 换 `router/index.naive.ts`，所有页面静态导入 | 五 |
| Element Plus 按需引入 | 换 `plugins/element.naive.ts`，整包 `app.use(ElementPlus)` | 六 |
| 登录态异步加载 | `main.naive.ts` 启动时同步 `init()`，SDK 直接进入口包 | 八 |
| 响应式图片 / WebP | 用 alias 把 `ResponsiveImage.vue` 换成 `ResponsiveImage.naive.vue`：一个 `<img>`，`.webp` 换回 `.jpg`，指回原图 | 一、二、三、四 |
| preload | 走另一个 HTML 入口，里面没有那两条 `<link>` | 九 |

页面上的每个字、每个间距、版本开关的位置，都是同一份源码渲染出来的。两版之间剩下的唯一差别就是「优化加没加」。

## 二、产物怎么合到一个站里

优化前的产物要落在 `/Blog/naive/` 这个子路径下，三件事必须做对：

1. **`base` 换掉**。否则它引用资源时还去找 `/assets/xxx.js`，整页白屏。
2. **入口改名**。优化前用另一个 HTML 入口（`index.naive.html`，里面没有 preload），放进目录前要改名成 `index.html`。
3. **各留一份 `404.html`**。GitHub Pages 是纯静态服务器，直接访问 `/articles/xxx` 磁盘上没这个文件，靠 `404.html` 兜底，再由前端路由接管。

## 三、CI 里的完整步骤

一个 job、一个产物、一次上传：

1. `pnpm build --mode ghpages` —— 构建优化后
2. `cp dist/index.html dist/404.html` —— 优化后的 SPA 回退
3. `pnpm exec vite build --mode naive` —— 构建优化前，产物进 `dist-naive/`
4. `node scripts/copy-naive-images.mjs` —— 把原始 JPG 拷进慢版产物（它们不在 `public/` 下，否则会跟着主站发布）
5. 改入口名、复制慢版自己的 `404.html`
6. `mkdir -p dist/naive && cp -r dist-naive/. dist/naive/` —— 合进同一个产物
7. `pnpm check:parity` —— 两版一致性检查
8. 上传产物，发布

为什么在 CI 里构建而不是本地构建好提交上去：产物进仓库会让仓库越来越胖（这里还带着 35.7 MB 原图），而且产物和源码容易对不上 —— 改了源码忘了重新构建，线上就是旧的，没人会发现。

## 四、第 7 步是这条流水线真正的护栏

两个版本摆在页面上给人对比，前提是它们**真的只差性能**。这件事靠自觉不行，得让流程挡住。

`scripts/check-parity.mjs` 做的事：用 runner 自带的 Chrome 打开两个版本的同一条路由，去掉评论区（它读线上真实数据，谁先留言谁就不一样），**逐字符比较正文文字**，再比标题、导航、按钮这些结构签名；然后在 390px 的手机视口下把该点的都点一遍 —— 导航、卡片、主题开关、版本开关、登录、筛选。

22 条「路由 × 视口」全过才允许发布。有一条不一致，这次部署就失败。

宁可不发，也不发一个「差异不只是性能」的对照版。

## 五、一个已知限制

GitHub Pages 只有**根目录**那份 `404.html` 会被用来兜底。所以手输 `/Blog/naive/articles/xxx` 这种深链接时，落地的是主站，由前端代码把地址送回 `/Blog/naive/`。

结果：从优化前首页点进文章正常，但在文章页按 F5 会回到优化前首页。

要修就得让优化前改成 hash 路由（`/Blog/naive/#/articles/x`），那两版的路由形态就不一样了 —— 又回到「差异不只是性能」。这条选择留着，写明在文档里。

## 一句话

一次 push、一次构建两次、一个产物、两个入口。难点从来不是「构建两次」，是**让两个版本之间只剩一个变量**，并且用一条自动检查把这件事钉死。
