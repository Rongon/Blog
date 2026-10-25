---
title: 一次部署，发布两个站
summary: 推一次代码，线上同时更新「优化前」和「优化后」两个站点。做法是同一份源码构建两次，一次发布。
category: 技术
tags: [部署, GitHub Actions, 工程实践]
date: 2026-04-02
readingMinutes: 7
cover: /images/covers/waterfall.webp
---

这个仓库推一次代码，线上会更新两个站点：

| 路径 | 是什么 |
| --- | --- |
| `/Blog/naive/` | 优化前，也就是动手优化之前的样子 |
| `/Blog/` | 优化后，现在线上这一版 |

两个版本在同一个域名下、同一个产物里，所以同源、同一份 404 回退、同一次发布。

麻烦的地方不是「怎么构建两次」，而是**让两个版本之间只剩性能这一个变量**。

## 一、基线先留下来，优化在一项一项往上加

优化的顺序本来就是：先有优化前的版本，然后一项一项加优化。这里唯一多做的一件事，是**把两项都留在源码里**。

所以仓库里并排放着两套实现：

| 优化项 | 优化前的写法（基线） | 优化后的写法 |
| --- | --- | --- |
| 一、图片格式 | `.jpg`，原图直出 | `.webp`，`sharp` 转码 |
| 二、响应式图片 | `<img>` 一个标签 | `ResponsiveImage.vue`：`srcset` + `sizes` |
| 三、懒加载 | 立即加载 | `loading="lazy"` |
| 四、宽高属性 | 不带 `width` / `height` | 从清单里读真实尺寸写进标签 |
| 五、路由代码分割 | 所有页面静态导入 | `() => import()` 按路由拆包 |
| 六、Element Plus | 整包 `app.use(ElementPlus)` | 只注册用到的 5 个组件 |
| 八、登录态位置 | 启动时同步 `init()`，SDK 进入口包 | 顶栏异步挂载，SDK 出首屏包 |
| 九、预加载 | 没有 `<link rel="preload">` | 题图和字体各一条 |

第七项（图片质量）和第十项（原图不进产物）没有两套写法 —— 它们是构建配置和素材管理，跟着构建模式一起变。

两套实现长什么样、放在哪儿：

```bash
src/components/ResponsiveImage.naive.vue   # 基线：一个 img + 原图
src/components/ResponsiveImage.vue         # 优化后：srcset / sizes / 懒加载 / 宽高
src/router/index.naive.ts                  # 基线：静态导入所有页面
src/router/index.ts                        # 优化后：按路由拆包
src/plugins/element.naive.ts               # 基线：整包注册
src/plugins/element.ts                     # 优化后：按需注册
src/main.naive.ts / index.naive.html       # 基线入口：同步 init、不带 preload
src/main.ts / index.html                   # 优化后入口
```

构建时二选一，由 `vite.config.ts` 里的一个 `naive` 分支决定走哪一套：

```bash
pnpm build --mode ghpages          # 优化后 → dist/       base = /Blog/
pnpm exec vite build --mode naive  # 优化前 → dist-naive/ base = /Blog/naive/
```

分支只做三件事：用 alias 把上面那几个文件换成基线版、给 markdown 插件传 `naive: true`（图片不生成 `srcset`、指回原图）、换 `base` 和入口 HTML。

页面上的每个字、每个间距、版本开关的位置，都是同一份源码渲染出来的 —— 因为基线和优化后共用同一套组件树、同一份样式、同一份内容。两版之间剩下的唯一差别就是「优化加没加」。

## 二、产物怎么合到一个站里

优化前那版落在 `/Blog/naive/` 这个子路径下，三件事必须做对：

1. **`base` 换掉**。否则它引用资源时还去找 `/assets/xxx.js`，整页白屏。
2. **入口改名**。优化前用的是另一个 HTML 入口（`index.naive.html`），放进目录前要改名成 `index.html`。
3. **各留一份 `404.html`**。GitHub Pages 是纯静态服务器，直接访问 `/articles/xxx` 磁盘上没这个文件，靠 `404.html` 兜底，再由前端路由接管。

## 三、CI 里的完整步骤

一个 job、一个产物、一次上传：

1. `pnpm build --mode ghpages` —— 构建优化后
2. `cp dist/index.html dist/404.html` —— 优化后的 SPA 回退
3. `pnpm exec vite build --mode naive` —— 构建优化前，产物进 `dist-naive/`
4. `node scripts/copy-naive-images.mjs` —— 把原始 JPG 拷进优化前产物（它们不在 `public/` 下，否则会跟着优化后一起发布）
5. 改入口名、复制优化前自己的 `404.html`
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

GitHub Pages 只有**根目录**那份 `404.html` 会被用来兜底。所以手输 `/Blog/naive/articles/xxx` 这种深链接时，落地的是优化后那一版，由前端代码把地址送回 `/Blog/naive/`。

结果：从优化前首页点进文章正常，但在文章页按 F5 会回到优化前首页。

要修就得让优化前改成 hash 路由（`/Blog/naive/#/articles/x`），那两版的路由形态就不一样了 —— 又回到「差异不只是性能」。这条选择留着，写明在文档里。

## 一句话

一次 push、两次构建、一个产物、两个入口。难点从来不是「构建两次」，是**让两个版本之间只剩一个变量**，并且用一条自动检查把这件事钉死。
