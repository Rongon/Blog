---
title: 类型救我四次，也放过我两次
summary: 这个项目开了 strict，但真正拦住问题的不是 strict 本身，是几个具体的形状约定。被放过的两处，后来都补上了。
category: 技术
tags: [TypeScript, 工程实践]
date: 2026-03-09
readingMinutes: 7
cover: /images/covers/night-sky.webp
---

这篇讲的是**类型在这个项目里到底拦住了什么**，以及那两个它曾经一声不响放过我的地方 —— 后来是怎么补上的。

![类型能证明的三层：形状、契约、业务](/images/tech/types-three-layers.webp)

## 一、跨层传字段名

数据库用 `snake_case`，前端用 `camelCase`，中间必然有一层映射：

```ts
interface CommentRow {
  id: string
  created_at: string
  post_slug: string
  author_id: string
  author_name: string
  body: string
  client_id: string
}

export interface Comment {
  id: string
  postSlug: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  clientId: string
}

function mapRow(row: CommentRow): Comment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    clientId: row.client_id,
  }
}
```

`mapRow` 的返回类型是 `Comment`，少写一个字段（比如忘了 `clientId`）编译就过不去。这一层看着啰嗦，但它把「数据库字段改名」从「线上某个页面白屏」变成了「构建失败」。

## 二、可选字段逼你处理两个分支

乐观更新那一条评论有个 `pending?: boolean`：

```ts
export interface Comment {
  // ...
  /** 乐观更新用：这条还在路上（本地临时态，不来自服务端） */
  pending?: boolean
}
```

因为它是可选的，任何读它的地方编译器都要求你考虑 `undefined`：

```ts
// 时间显示：还在路上的那条没有可信的 createdAt
<span>{{ c.pending ? '发送中…' : formatTime(c.createdAt) }}</span>

// 能不能删：还在路上的那条不能删（服务端还没有它）
return Boolean(auth.user && auth.user.id === c.authorId && !c.pending)
```

如果 `pending` 是 `boolean` 且有默认值，这两个判断都很容易被漏掉。漏掉的后果不是报错，是**页面上出现 `Invalid Date`，或者删一条还没落库的评论时得到 404** —— 这类 bug 不崩溃、不复现、只在慢网络下出现。

## 三、组件契约

`defineProps<{ postSlug: string }>()` 这种写法，用的时候感觉只是省了个运行时校验，其实它管的是**调用方**：

```vue
<script setup lang="ts">
const props = defineProps<{ postSlug: string }>()
</script>
```

在文章详情页里，这个 `postSlug` 由路由参数传进来。路由参数的原始类型是 `string | string[]`（数组路由的情况）。如果不做一次收窄就直接当 `string` 传，TS 会拦住。

真正值钱的时刻是**重构**：我把评论区从一个页面复用到另一个页面时，忘了传 `postSlug`，编译直接报缺参数。没有它的话，这个错会在运行时表现为「评论存到了 undefined 这篇文章下面」。

## 四、查表返回 undefined

图片清单是一张 `Record<string, ImageEntry>`，用的时候必须先判断：

```ts
const entry = IMAGE_MANIFEST[raw]
if (entry) {
  token.attrSet('width', String(entry.w))
  token.attrSet('height', String(entry.h))
}
```

这里要坦白一句：**写这段代码的时候，拦下它的是我的 `if`，不是类型。**

那会儿 `tsconfig` 里只开了 `strict`，没开 `noUncheckedIndexedAccess`。也就是说 `IMAGE_MANIFEST[raw]` 的类型被推成 `ImageEntry`，编译器认为它一定存在 —— 而实际上任何不在清单里的图片都会返回 `undefined`。

我当初写这个 `if` 是凭经验。如果哪天我删掉它，编译器不会拦，运行时会抛 `Cannot read properties of undefined`。

## 补上的第一次：索引访问

上面那条就是。修法在 `tsconfig.json` 里加一行：

```json
"noUncheckedIndexedAccess": true
```

我一直拖着没加，理由是「它会让所有 `arr[i]`、`obj[key]` 都变成 `T | undefined`，得改一批地方」。

实际打开之后，编译错误只报了**一处**：

```ts
// 正则 exec 的结果里，捕获组 m[1] 在某些分支下确实是 undefined
out.push({ text: m[1] ?? '', bold: true })
```

也就是说，那个「得改一批」的担心是凭印象估的。真正跑一遍的成本是补一个 `?? ''`。

顺手记一句：**担心一件事的成本，和它真实的成本，经常差一个数量级。** 先量再决定顺不顺手，不只是性能优化的道理。

## 补上的第二次：错误码是 string

```ts
export class CommentError extends Error {
  code: string
  // ...
}
```

调用方按 `code` 分支处理：

```ts
if (err.code === 'RATE_LIMITED') { /* ... */ }
```

问题在于 `code` 的类型是 `string`。把 `'RATE_LIMITED'` 拼成 `'RATE_LIMTED'`（少一个 I），编译器一句话都不说，而这个分支永远不会命中 —— 用户看到的是兜底的「请求失败了」，真实原因被吞掉。

现在收成了一个联合类型：

```ts
export type CommentErrorCode =
  | 'EMPTY' | 'TOO_LONG' | 'BANNED'
  | 'RATE_LIMITED' | 'DUPLICATE' | 'INVALID'
  | 'FORBIDDEN' | 'UNAUTHORIZED' | 'UNKNOWN'
```

构造函数收 `CommentErrorCode`，拼错就是编译错误。顺带把一个隐式 bug 也关了：原来 `default` 分支写的是 `error.code ?? 'UNKNOWN'`，会把数据库的原始错误码原样传出去；现在一律归为 `'UNKNOWN'`，页面只需要认识那九个值。

## 类型能证明什么，不能证明什么

三层，一层比一层弱：

| 层 | 类型能不能管 | 例子 |
| --- | --- | --- |
| 形状对 | 能，编译期保证 | 字段名、字段类型、有没有漏 |
| 契约对 | 能，编译期保证 | 组件要什么参数、函数返回什么 |
| 业务对 | 不能 | 「评论该不该在这里显示」这种判断 |

一句实话：写类型最大的收益不是「少写 bug」，是**改代码的时候不用靠记忆**。改一个接口，编译器会把所有受影响的地方列出来给你 —— 这是它替我省下的时间。
