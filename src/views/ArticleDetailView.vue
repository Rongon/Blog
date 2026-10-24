<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlaceholderPage from '@/components/PlaceholderPage.vue'
import CommentSection from '@/components/CommentSection.vue'
import { getAdjacentPosts, getPostBySlug } from '@/data/posts'

const route = useRoute()

/**
 * slug 直接从路由参数派生。
 * 这里没有「进入组件时请求一次」的逻辑，因为内容是**构建时**就打进产物的——
 * 取一篇文章是同步的、零延迟的，不存在加载状态。
 */
const slug = computed(() => String(route.params.slug ?? ''))
const detail = computed(() => getPostBySlug(slug.value))
const adjacent = computed(() => getAdjacentPosts(slug.value))

const activeId = ref('')

/**
 * 目录高亮用 IntersectionObserver 而不是监听 scroll 事件：
 * scroll 里做计算会频繁触发布局读取，滚动一卡一卡的；
 * IntersectionObserver 由浏览器在合成线程里判断，回调次数少得多。
 */
let observer: IntersectionObserver | null = null

function observeHeadings() {
  observer?.disconnect()
  observer = null

  const body = document.querySelector('.article-body')
  if (!body) return

  const headings = Array.from(body.querySelectorAll<HTMLElement>('h2[id], h3[id]'))
  if (!headings.length) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeId.value = entry.target.id
      }
    },
    // 上边留出顶栏高度，下边收掉 70%，让「进入视口上三分之一」的标题成为当前项
    { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
  )
  for (const h of headings) observer.observe(h)
}

// 切换文章（同一个路由、不同 slug，组件实例会被复用）时要重新挂观察器
watch(
  detail,
  async () => {
    activeId.value = ''
    await nextTick()
    observeHeadings()
  },
  { immediate: true },
)

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div v-if="detail" class="detail">
    <div class="wrap">
      <div class="cols">
        <article class="main">
          <div class="kicker ui">
            {{ detail.meta.category }} · {{ detail.meta.date }}
          </div>
          <h1>{{ detail.meta.title }}</h1>
          <p class="lede">{{ detail.meta.summary }}</p>

          <!--
            用 v-html 插入正文。安全性来自两头：
              ① 内容源是我们仓库里自己的 .md，不是用户提交的
              ② markdown-it 关掉了 html 选项（html: false），正文里写 <script> 只会被当文字
            如果哪天评论也要渲染 Markdown，就必须先过一遍 DOMPurify。
          -->
          <div class="article-body" v-html="detail.html"></div>

          <nav v-if="adjacent.newer || adjacent.older" class="adj">
            <RouterLink
              v-if="adjacent.newer"
              class="adj-item"
              :to="`/articles/${adjacent.newer.slug}`"
            >
              <span class="ui">更新的一篇</span>
              <strong>{{ adjacent.newer.title }}</strong>
            </RouterLink>
            <span v-else class="adj-item empty"></span>

            <RouterLink
              v-if="adjacent.older"
              class="adj-item right"
              :to="`/articles/${adjacent.older.slug}`"
            >
              <span class="ui">更早的一篇</span>
              <strong>{{ adjacent.older.title }}</strong>
            </RouterLink>
          </nav>

          <p class="back">
            <RouterLink to="/articles">← 回到文章列表</RouterLink>
          </p>

          <CommentSection :post-slug="slug" />
        </article>

        <aside v-if="detail.toc.length" class="toc">
          <div class="toc-title ui">目录</div>
          <ul>
            <li
              v-for="item in detail.toc"
              :key="item.id"
              :class="[`lv${item.level}`, { on: activeId === item.id }]"
            >
              <a :href="`#${item.id}`">{{ item.text }}</a>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>

  <PlaceholderPage
    v-else
    title="没有这篇文章"
    note="链接可能拼错了，或者这篇文章还没写。回文章列表看看别的。"
  />
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.detail {
  padding: 52px 0 72px;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 196px;
  gap: 56px;
  align-items: start;
}

.main {
  max-width: var(--measure);

  h1 {
    font-size: clamp(28px, 3.4vw, 38px);
    letter-spacing: -0.02em;
    line-height: 1.32;
    margin-bottom: 18px;
  }
}

.kicker {
  margin-bottom: 18px;
}

.lede {
  margin: 0 0 40px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--rule-soft);
  color: var(--muted);
  font-size: 17px;
  line-height: 1.85;
}

.adj {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin: 56px 0 0;
  padding-top: 26px;
  border-top: 1px solid var(--rule-soft);
}

.adj-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--ink);

  .ui {
    font-size: 12.5px;
    color: var(--faint);
  }

  strong {
    font-weight: 400;
    font-size: 16px;
    line-height: 1.6;
  }

  &:hover strong {
    color: var(--link);
  }

  &.right {
    text-align: right;
  }
}

.back {
  margin: 32px 0 0;
  font-family: var(--font-sans);
  font-size: 13.5px;
}

.toc {
  position: sticky;
  top: 88px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.6;
  border-left: 1px solid var(--rule-soft);
  padding-left: 18px;
}

.toc-title {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 12px;
}

.toc ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc li {
  margin-bottom: 8px;

  a {
    color: var(--muted);
  }

  &.lv3 {
    padding-left: 12px;
    font-size: 12.5px;
  }

  &.on a {
    color: var(--link);
  }

  &:hover a {
    color: var(--ink);
  }
}

@include md-down {
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  // 窄屏上目录不置顶悬浮，直接跟在正文后面
  .toc {
    position: static;
    margin-top: 48px;
    order: 2;
  }
}

@include sm-down {
  .detail {
    padding: 32px 0 48px;
  }

  .main h1 {
    font-size: 25px;
  }

  .adj {
    grid-template-columns: 1fr;
  }

  .adj-item.right {
    text-align: left;
  }
}
</style>
