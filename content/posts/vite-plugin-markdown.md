---
title: 让 Markdown 在构建的时候变成 HTML，别让浏览器去做
summary: 一个 220 行的 Vite 插件，把 .md 编译成 JS 模块。收益不只是省流量，还有「Markdown 里写的东西改不了线上行为」。
category: 技术
tags: [Vite, Markdown, 工程实践]
date: 2026-02-10
readingMinutes: 8
cover: /images/covers/forest-sun.webp
---

这个站的每篇文章都写在 `content/posts/*.md` 里。构建的时候，它们会被编译成普通的 JS 模块，产物里只有 HTML 字符串。

换句话说：**访客的浏览器从头到尾没有见过 Markdown，也没有下载过任何 Markdown 解析器。**

先说清楚这不是唯一做法。常见的三选一：

| 做法 | 谁在解析 | 代价 |
| --- | --- | --- |
| 客户端解析 | 每个访客的浏览器 | 要下载解析器 + 高亮器，首屏多等一截 |
| 构建时解析 | 构建机器，跑一次 | 改文章要重新构建部署 |
| 服务端渲染 | 服务器 | 需要后端或 SSR 部署，个人站不划算 |

我选了第二个。理由不是「最快」，是**它符合博客的实际情况**：文章一两个月才改一次，而首屏每次都要重新加载。

![两条链路：浏览器解析 vs 构建时解析](/images/tech/markdown-pipeline.webp)

## 一个 Vite 插件最少需要什么

非常少。核心就是一个 `transform`：

```ts
export default function markdownPlugin(): Plugin {
  return {
    name: 'blog:markdown',
    enforce: 'pre', // 见下一节，这行是必须的

    async transform(src, id) {
      const [file] = id.split('?')
      if (!file.endsWith('.md')) return

      const { data, body } = parseFrontmatter(src)
      const md = new MarkdownIt({ html: false })
      const html = md.render(body)

      // 返回给 Vite 的不是 HTML，而是一段 JS 源码
      return {
        code: [
          `export const meta = ${JSON.stringify(data)}`,
          `export const toc = ${JSON.stringify(toc)}`,
          `export const html = ${JSON.stringify(html)}`,
        ].join('\n'),
        map: null,
      }
    },
  }
}
```

三个细节值得单独说：

**一、返回的必须是 JS 源码，不是 HTML。** Vite 的插件管线和 Rollup 一样，`transform` 的返回值会被当成一个模块继续参与后续处理。所以要把 HTML 转义后塞进 `export const html = "..."`。用 `JSON.stringify` 而不是手拼引号，是因为文章里有反引号、换行、中文标点，手拼必然出错。

**二、`enforce: 'pre'` 不是可选项。** Vite 核心插件默认会处理 `.md` —— 它不认识这个扩展名，于是当成 JS 去解析，直接报语法错。`enforce: 'pre'` 让这个插件排在核心插件之前，`.md` 在我们的 `transform` 里已经被替换成 JS，后面就不会再撞上。

**三、`html: false` 是安全设置。** 它让 Markdown 正文里的裸 HTML 标签不被渲染。博客作者是我自己，但这条开关能保证「以后如果开了把评论正文渲染成 Markdown」之类的功能，不会有人往里面塞 `<script>`。

## 两个 renderer 钩子

解析本身用现成的 `markdown-it`。真正需要自己写的是两处渲染逻辑，都是覆盖 `renderer.rules`。

### 标题：顺手把目录也收集了

每篇文章右侧那个目录（TOC），不是在浏览器里扫 DOM 生成的，而是在构建时从 token 里收集的：

```ts
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const level = Number(token.tag.slice(1))
  if (level === 2 || level === 3) {
    const anchor = makeSlug(textOf(tokens[idx + 1]), usedIds)
    token.attrSet('id', anchor)   // 给标题一个 id，锚点链接才有落点
    toc.push({ id: anchor, text, level })
  }
  return self.renderToken(tokens, idx, options)
}
```

为什么不在 HTML 生成之后用正则去补 id？因为**正则不认识 Markdown 的结构**。`## 标题` 里的行内代码、链接、加粗都会变成嵌套标签，正则要么漏要么错。token 是结构化的，从结构里取文本和层级才可靠。

`makeSlug` 里还要处理重名：同一篇文章里两个「为什么」不能都变成 `#为什么`，第二个得是 `为什么-1`。

### 图片：三件事一起做

正文里的图片都在这个钩子里处理，一次做完三件事：

```ts
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const entry = IMAGE_MANIFEST[raw]      // 由图片脚本生成的清单

  if (entry) {
    token.attrSet('srcset', candidates.join(', '))  // 1. 响应式：给出每一档宽度
    token.attrSet('sizes', ARTICLE_IMAGE_SIZES)     //    并告诉浏览器它会被显示多宽
    token.attrSet('width', String(entry.w))         // 2. 预留位置，防 CLS
    token.attrSet('height', String(entry.h))
  }

  token.attrs[srcIndex][1] = withBase(raw)          // 3. 补 base 前缀
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')

  return renderImage(tokens, idx, options, env, self)
}
```

第 3 条是这个站特有的坑：GitHub Pages 是子路径部署（`/Blog/`），Markdown 里写 `/images/x.webp` 到线上就少一层前缀，直接 404。所以在构建时把 `config.base` 拿到手，统一补上。

第 1、2 条就是性能优化那两项在正文里的落地 —— 图片优化不只是首页，正文里的图同样是大头。

## 高亮怎么办

用 Shiki，在构建时把代码块渲染成带 `style` 的 HTML，同时输出浅色和深色两套主题（靠 CSS 变量切换）。

它跑在 Node 里，所以语法文件、主题文件、正则引擎全都不会进客户端产物。代价是构建慢一点：加载语法和主题要一两秒，一次性开销。

我一开始想用 `highlight.js`，它更轻。换掉的原因是 Shiki 的高亮和 VS Code 一眼一致 —— 技术文章里代码块是主角，这个差别值得多花一点构建时间。

## 代价是什么

三条，都很实在：

1. **改文章必须重新构建部署。** 没有「后台改完立刻生效」。
2. **构建时间随文章数量线性增长。** 现在 10 篇无所谓，200 篇就要考虑缓存了。
3. **不能有「运行时才知道的内容」。** 比如按读者时区显示日期，这种事在构建时就定死了，只能放到客户端补。

对一个个人技术博客来说，这三条都可以接受。但如果这是个有编辑后台的内容站，这个方案就不合适 —— 那种场景该用服务端渲染。

## 一句话

这个插件的真正收益不是「省了几百 KB」，而是**把工作从「每个访客的浏览器」挪到了「一次构建」**。前者乘以所有访问次数，后者只乘一次。
