<script setup lang="ts">
import type { PostMeta } from '@/data/posts'

defineProps<{ post: PostMeta }>()
</script>

<template>
  <article class="card">
    <RouterLink class="cover" :to="`/articles/${post.slug}`" tabindex="-1" aria-hidden="true">
      <!-- 优化前：原图大 JPG，没有 WebP、没有 srcset、没有懒加载 -->
      <img :src="post.cover" :alt="post.title" />
    </RouterLink>

    <div class="body">
      <h3>
        <RouterLink :to="`/articles/${post.slug}`">{{ post.title }}</RouterLink>
      </h3>
      <p class="sum">{{ post.summary }}</p>
      <div class="meta ui">
        <span class="tag">{{ post.category }}</span>
        <span>{{ post.date }}</span>
        <span>{{ post.readingMinutes }} 分钟</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.card {
  border: 1px solid var(--rule-soft);
  background: var(--surface);
  display: flex;
  flex-direction: column;
}

.cover {
  display: block;
  border-bottom: 1px solid var(--rule-soft);

  &:hover {
    border-bottom-color: var(--rule-soft);
  }

  img {
    width: 100%;
    height: auto;
  }
}

.body {
  padding: 18px 20px 22px;

  h3 {
    font-size: 18px;
    line-height: 1.5;
    margin-bottom: 10px;

    a {
      color: var(--ink);

      &:hover {
        color: var(--link);
      }
    }
  }
}

.sum {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--faint);
}

.tag {
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 1px 8px;
  color: var(--muted);
}
</style>
