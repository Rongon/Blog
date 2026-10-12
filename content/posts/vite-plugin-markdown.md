---
title: 一个 Vite 插件，是怎么把 Markdown 变成页面的
summary: 不装现成的插件，自己写二十行：从 transform 钩子讲起，说清「构建时」和「运行时」到底差在哪。
category: 技术
tags: [Vite, Markdown]
date: 2026-01-18
readingMinutes: 7
cover: /images/covers/forest-sun.jpg
---

这个站点里的每一篇文章，都是一个躺在仓库里的 `.md` 文件。它们不是被浏览器解析的，而是在 `pnpm build` 的时候就被编译成了 HTML。

## 构建时和运行时，差在哪

- **运行时解析**：`.md` 的原文被打进产物，用户打开页面后由浏览器现场解析。代价是要先下载一个 markdown 解析库，再等它执行。
- **构建时解析**：构建时由 Node 把 `.md` 转成 HTML 写进产物。用户拿到的就是 HTML，浏览器不做任何解析。

后者明显更快，但它有一个代价：**改文章要重新构建**。这对博客来说完全可以接受——VitePress、Astro 都是这么做的。

## 实现方式：一个只有三个概念的插件

Vite 官方并不提供 Markdown 插件。自己写一个需要知道的事其实只有三件：

1. 插件就是一个普通对象，唯一的必填项是 `name`
2. 钩子（hook）就是「在某个时机被 Vite 调用一次的函数」，常用的只有四五个
3. `transform` 的本质：把文件内容换成另一段内容还回去

```ts
export default function markdownPlugin() {
  return {
    name: 'my-markdown',
    enforce: 'pre', // 抢在 Vite 核心插件之前处理
    transform(src, id) {
      if (!id.endsWith('.md')) return
      const html = md.render(src)
      return {
        code: `export default ${JSON.stringify(html)}`,
        map: null,
      }
    },
  }
}
```

`.md` 本来不是 JS，是插件**把它变成了 JS 模块**。这就是「让 Vite 支持一种新文件类型」的通用套路。

`enforce: 'pre'` 不是可选项：如果不抢在前面，Vite 会尝试按 JS 解析 `.md`，直接报错。

## 顺带说一个容易混的东西

很多人这样读 Markdown：

```ts
import raw from './a.md?raw'
```

`?raw` 是 Vite 内置的，作用是**「不要编译，把文件的原始文本给我」**。它给你的是 Markdown 原文，你还得在浏览器里解析——**那是运行时渲染，又绕回了慢的那条路**。

看到 `?raw` 要立刻反应过来：它是「原样给我」，不是「帮我编译」。

## 代码高亮放在哪一层

我用的是 Shiki。它基于 TextMate 语法，输出的是带行内样式的 HTML，准确度很高。它的体积确实不小——完整包 6.4 MB（min），但**这一份体积完全不进浏览器**：

因为它在 Node 里跑，跑完只留下 HTML 字符串。客户端拿到的是已经高亮好的静态 HTML，等于零额外 JS。这是「构建时」这个选择带来的附带好处。
