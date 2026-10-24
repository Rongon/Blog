<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePostQuery } from '@/composables/usePostQuery'

const { categories, tags, page, category, tag, keyword, loading, result, updateQuery } =
  usePostQuery()

/* 搜索框：输入 → 防抖 300ms → 用 replace 写回 URL
   （每敲一个字母都 push 的话，浏览器历史会被塞满，后退一次只退掉一个字母）*/
const kwInput = ref(keyword.value ?? '')
let timer: number | undefined

// URL 被外部改变时（点后退、或直接改地址栏），把输入框同步回来
watch(keyword, (v) => {
  const s = v ?? ''
  if (s !== kwInput.value) kwInput.value = s
})

function onKeywordInput(e: Event) {
  kwInput.value = (e.target as HTMLInputElement).value
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    updateQuery({ q: kwInput.value.trim() || undefined }, { replace: true })
  }, 300)
}

function pickCategory(c?: string) {
  updateQuery({ category: c })
}

function pickTag(t?: string) {
  updateQuery({ tag: t })
}

function onPageChange(p: number) {
  updateQuery({ page: p }, { resetPage: false })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function clearKeyword() {
  kwInput.value = ''
  updateQuery({ q: undefined }, { replace: true })
}

function clearAll() {
  kwInput.value = ''
  updateQuery({ category: undefined, tag: undefined, q: undefined })
}

function hasFilter() {
  return Boolean(category.value || tag.value || keyword.value)
}
</script>

<template>
  <section class="page">
    <div class="wrap">
      <header class="head">
        <div class="kicker">共 {{ result.total }} 篇</div>
        <h1>文章</h1>
      </header>

      <div class="toolbar">
        <div class="search">
          <input
            :value="kwInput"
            type="search"
            placeholder="搜标题、摘要或标签…"
            aria-label="搜索文章"
            @input="onKeywordInput"
          />
          <button v-if="kwInput" class="clr ui" type="button" @click="clearKeyword">
            清空
          </button>
        </div>

        <div class="chips ui">
          <button
            class="chip"
            :class="{ on: !category }"
            type="button"
            @click="pickCategory(undefined)"
          >
            全部分类
          </button>
          <button
            v-for="c in categories"
            :key="c"
            class="chip"
            :class="{ on: category === c }"
            type="button"
            @click="pickCategory(category === c ? undefined : c)"
          >
            {{ c }}
          </button>
        </div>

        <div class="chips ui">
          <button
            v-for="t in tags"
            :key="t"
            class="chip tag"
            :class="{ on: tag === t }"
            type="button"
            @click="pickTag(tag === t ? undefined : t)"
          >
            {{ t }}
          </button>
        </div>

        <button v-if="hasFilter()" class="clearall ui" type="button" @click="clearAll">
          清除全部筛选
        </button>
      </div>

      <div class="list" :class="{ busy: loading }">
        <article v-for="post in result.items" :key="post.slug" class="row">
          <div class="kicker">{{ post.category }} · {{ post.date }}</div>
          <h2>
            <RouterLink :to="`/articles/${post.slug}`">{{ post.title }}</RouterLink>
          </h2>
          <p>{{ post.summary }}</p>
          <div class="rowtags ui">
            <button
              v-for="t in post.tags"
              :key="t"
              type="button"
              @click="pickTag(t)"
            >
              {{ t }}
            </button>
          </div>
        </article>

        <p v-if="!loading && result.items.length === 0" class="empty">
          没有匹配的文章。试试
          <button class="linkbtn" type="button" @click="clearAll">清除全部筛选</button>。
        </p>
      </div>

      <div class="pager">
        <el-pagination
          v-if="result.totalPages > 1"
          :current-page="page"
          :page-size="result.pageSize"
          :total="result.total"
          layout="prev, pager, next"
          background
          @current-change="onPageChange"
        />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.page {
  padding: 56px 0 72px;
}

.head {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 26px;

  h1 {
    font-size: clamp(30px, 4vw, 42px);
    letter-spacing: -0.02em;
  }
}

.kicker {
  margin-bottom: 12px;
}

.lede {
  margin: 14px 0 0;
  max-width: 40em;
  color: var(--muted);
  font-size: 16.5px;
}

.toolbar {
  padding: 26px 0 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.search {
  position: relative;
  max-width: 420px;

  input {
    width: 100%;
    font-family: var(--font-sans);
    font-size: 14.5px;
    padding: 10px 62px 10px 14px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);

    &::placeholder {
      color: var(--faint);
    }

    &:focus {
      outline: 2px solid var(--link);
      outline-offset: 1px;
      border-color: var(--link);
    }
  }
}

.clr {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12.5px;
  color: var(--faint);
  background: none;
  border: 0;
  cursor: pointer;
  padding: 4px 6px;

  &:hover {
    color: var(--ink);
  }
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 4px 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: var(--ink);
    color: var(--ink);
  }

  &.on {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }
}

.clearall {
  align-self: flex-start;
  font-size: 13px;
  color: var(--link);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  border-bottom: 1px solid currentColor;
}

.list {
  margin-top: 22px;
  transition: opacity 0.15s ease;

  &.busy {
    opacity: 0.55;
  }
}

.row {
  padding: 28px 0;
  border-bottom: 1px solid var(--rule-soft);

  h2 {
    font-size: 22px;
    line-height: 1.45;
    margin-bottom: 10px;

    a {
      color: var(--ink);

      &:hover {
        color: var(--link);
      }
    }
  }

  p {
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 15.5px;
    line-height: 1.85;
    max-width: 46em;
  }
}

.rowtags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  button {
    font-size: 12.5px;
    font-family: var(--font-sans);
    color: var(--faint);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;

    &::before {
      content: '#';
      margin-right: 1px;
    }

    &:hover {
      color: var(--link);
      border-bottom: 1px solid currentColor;
    }
  }
}

.empty {
  padding: 40px 0;
  color: var(--muted);
}

.linkbtn {
  font: inherit;
  color: var(--link);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  border-bottom: 1px solid currentColor;
}

.pager {
  display: flex;
  justify-content: center;
  padding-top: 36px;
}

@include sm-down {
  .page {
    padding: 36px 0 56px;
  }

  .search {
    max-width: none;
  }
}
</style>
