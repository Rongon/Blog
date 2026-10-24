---
title: 一次部署，发布两个站
summary: 同一个仓库、同一次 Actions 运行，产出主站和「优化前」的优化前。难的不是构建两次，是两个版本的依赖和路径都不一样。
category: 技术
tags: [部署, GitHub Actions, 工程实践]
date: 2026-04-02
readingMinutes: 8
cover: /images/covers/waterfall.webp
---

这个仓库推一次代码，线上会更新两个站点：

| 路径 | 是什么 |
| --- | --- |
| `/Blog/` | 主站，当前代码 |
| `/Blog/naive/` | `v0-naive` 那个 tag 的构建产物，也就是性能优化之前的版本 |

为什么要留着优化前：性能优化的结论是「从 A 变成 B」，只给你看 B 是没有说服力的。两个版本摆在同一个域名下，点开就能自己跑一遍。

下面是这条流水线里真正麻烦的地方 —— 都不是「怎么构建两次」这种问题。

## 不在本地构建，全部在 CI 里做

最直觉的做法是：本地把优化前 build 一次，把 `dist` 塞进仓库，主站构建时复制过去。

没这么做，两个原因：

1. **仓库会变胖，而且不可逆。** 一次 `dist` 进来，历史里就永远有它。
2. **产物和源码会对不上。** 改了优化前相关的东西忘了重新构建，线上就是旧的，而且没人会发现。

所以优化前是在 CI 里现场构建的。代价是每次部署多花一分钟。

## 三个坑

### 一、tag 不在 checkout 里

```yaml
- uses: actions/checkout@v4
- run: git fetch --depth 1 origin tag v0-naive
- run: git worktree add --detach naive-tree v0-naive
```

`actions/checkout` 默认只拉一个 commit（`--depth 1`），历史 tag 根本不在本地。所以要先单独把那个 tag 取回来，再用 `worktree` 检出到一个单独目录。

用 `worktree` 而不是再 checkout 一次，是因为两个版本要在同一个 runner 上共存：主站已经装好依赖、构建好了，这时候不能动工作区。

### 二、两个版本的 lockfile 不是一份

`v0-naive` 那个时间点，项目里还没有 `sharp`、`markdown-it`、`shiki`。它的 `pnpm-lock.yaml` 和现在完全不一样。

所以优化前必须在 `naive-tree` 里**单独** `pnpm install --frozen-lockfile`。共用主站的 `node_modules` 会装出错的版本 —— 而且这种错不会报错，只会在运行时以一种莫名其妙的方式表现出来。

代价是 CI 里装两次依赖。这就是「保留一个历史版本」的真实成本。

### 三、字体目录不存在

字体是后来才加进项目的，`v0-naive` 里没有 `public/fonts`，但它的样式里已经写了 `@font-face { src: url('/fonts/...') }`。

不补的话，浏览器会去站点根找 `/fonts/*.woff2` → 404 → 优化前掉回系统字体。那就不是「同一份内容」了，对照实验的前提被破坏。

```bash
mkdir -p naive-tree/dist/fonts
cp public/fonts/*.woff2 naive-tree/dist/fonts/
sed -i 's|url(/fonts/|url(../fonts/|g' naive-tree/dist/assets/*.css
```

`sed` 那一行是把 CSS 里的绝对路径改成相对路径：CSS 文件在 `/naive/assets/` 下，`../fonts/` 正好落在 `/naive/fonts/`，不用再写死一次前缀。

## base 只改一个参数就够

优化前的 `base` 是 `/Blog/naive/`，因为它的路由、图片、静态资源都挂在这个前缀下。

能只改一个参数，是因为 `v0-naive` 里的图片地址走了一个小函数：

```ts
export const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`
```

它读 `BASE_URL`，所以 `vite build --base=...` 一改，图片路径自己就跟着变了，源码一行都不用动。

这也是为什么这个函数值得单独抽出来 —— 如果不抽，图片会写死成 `/images/x.jpg`，换 base 之后全站图片 404，而构建过程一声不响。

另一个细节：优化前用 `pnpm exec vite build` 而不是 `pnpm build`。因为 `build` 脚本里带 `vue-tsc` 类型检查，而历史 tag 在新版 TypeScript 下可能通不过检查 —— 我们要的是产物，不是「历史代码也符合今天的类型规则」。

## 开关是注入的，不是改源码

优化前进去之后得有路回来。但那个 tag 的源码一个字符都不能改 —— 改了它就不是「优化前的代码」了。

所以开关是在**部署产物**里注入的：

```bash
node scripts/inject-version-switch.mjs naive-tree/dist /Blog/
```

它读 `src/styles/version-switch.css`（和主站用的是**同一个文件**），把样式内联进 `</body>` 前，再插入一段和主站结构一致的 HTML。优化前的源码目录里没有这个文件。

## SPA 的 404 回退

GitHub Pages 是纯静态服务器，直接访问 `/articles/xxx` 会 404（磁盘上没有这个文件）。做法是构建完把 `index.html` 复制一份叫 `404.html`：

```bash
cp dist/index.html dist/404.html
```

Pages 找不到文件时返回它，页面加载后前端路由接管，深链接和刷新都能用。

## 一个已知限制

优化前的路由 base 是 `/naive/`，所以 `/naive/articles/xxx` 这种深链接被刷新时，返回的是**根目录的** `404.html`（主站的 SPA）。结果就是：从优化前首页点进一篇文章正常，但在文章页按 F5 会跳回主站。

修法有两种：给优化前单独准备一份 `naive/404.html`，或者在 CI 里把优化前的 `index.html` 也复制一份到 `dist/naive/404.html`。我没做，因为优化前的用途是「点开跑一次 Lighthouse」，深链接刷新不在使用路径上。

写在这里是因为：**知道一个限制存在但选择不修，和不知道它存在，是两件事。**

## 结果

一次运行大概两分半，产出两个站、一个 404 回退、一份注入后的开关。构建产物现在三十几 MB —— 其中大头是优化前那 36 MB 的原图，那是它的「原罪」，不能动。
