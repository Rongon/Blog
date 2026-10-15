---
title: TypeScript 里我最常用的五个类型工具
summary: 不是为了炫技，是因为这五个真的每天都在用。附上每个的典型使用场景和常见误用。
category: 技术
tags: [TypeScript, 工程实践]
date: 2026-03-09
readingMinutes: 6
cover: /images/photos/coast-13.webp
---

我不太写复杂的类型体操。下面这五个是真正每天都在用的，按使用频率排序。

![正午的海面](/images/photos/coast-04.webp)

*先放一张海，免得满屏都是代码。*

## 一、`Partial<T>`

把对象的所有属性变成可选。最典型的使用场景是「更新」类接口——只传要改的字段。

```ts
function updatePost(slug: string, patch: Partial<Post>) {
  // patch 里可以只有 title，也可以只有 tags
}
```

**常见误用**：拿它当「这个对象可能缺字段」的通用写法。如果一个字段本来就该有值，用 `Partial` 会把类型错误推迟到运行时。

## 二、`Pick<T, K>` 和 `Omit<T, K>`

这两个几乎总是一起出现。`Pick` 是「只要这几个」，`Omit` 是「除了这几个」。

```ts
type PostCard = Pick<Post, 'title' | 'summary' | 'cover'>
type PostInput = Omit<Post, 'id' | 'createdAt'>
```

用它的价值在于：**改了源类型，派生类型自动跟着变**。手抄一份 `interface` 迟早会漂移。

## 三、`Record<K, V>`

字典型数据的标准写法。

```ts
const statusText: Record<Status, string> = {
  pending: '处理中',
  done: '已完成',
}
```

比 `{ [key: string]: string }` 好在：**漏掉一个 key 会直接报错**。用它来做穷举映射特别舒服。

![远处的海岸线](/images/photos/coast-06.webp)

## 四、`ReturnType<typeof fn>`

当你只想要一个函数的返回类型，不想额外导出那个类型时。

```ts
function createClient() {
  return { url, key, request }
}

type Client = ReturnType<typeof createClient>
```

这样 `createClient` 的实现改了，`Client` 自动跟着变。

## 五、`as const`

严格说这不是类型工具，但它解决的问题和上面几个是一类的：**让编译器推断出更窄的类型**。

```ts
const NAV = [
  { to: '/', label: '首页' },
  { to: '/about', label: '关于' },
] as const
```

不加 `as const`，`to` 的类型是 `string`；加了之后是 `'/' | '/about'`。写路由表的时候差别很大。

## 一条底线

**类型是给未来的自己看的。**如果一个类型写出来，三个月后的自己看五分钟才看懂，那它大概率不该存在——哪怕它很"正确"。
