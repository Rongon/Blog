<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme } = useTheme()

const nav = [
  { to: '/', label: '首页' },
  { to: '/projects', label: '项目' },
  { to: '/articles', label: '文章' },
  { to: '/about', label: '关于' },
]
</script>

<template>
  <header class="top">
    <div class="top-in">
      <RouterLink to="/" class="brand"> 曾泽龙<em>前端 · 广州</em> </RouterLink>

      <nav class="nav">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>

      <button class="tgl" type="button" @click="toggleTheme">
        {{ theme === 'dark' ? '浅色模式' : '深色模式' }}
      </button>
    </div>
  </header>

  <main>
    <slot />
  </main>

  <footer class="foot">
    <div class="wrap">
      曾泽龙 · 前端工程师 · 本站为个人作品集与技术博客，源码公开
    </div>
  </footer>
</template>

<style scoped lang="scss">
.top {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--bg);
  border-bottom: 1px solid var(--rule);
}

.top-in {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 64px;
  max-width: var(--wide);
  margin: 0 auto;
  padding: 0 24px;
}

.brand {
  font-size: 19px;
  letter-spacing: -0.01em;
  color: var(--ink);
  white-space: nowrap;

  &:hover {
    color: var(--ink);
    border-bottom-color: transparent;
  }

  em {
    font-style: normal;
    font-size: 13px;
    color: var(--faint);
    margin-left: 8px;
  }
}

.nav {
  display: flex;
  gap: 22px;
  margin-left: auto;

  a {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--muted);

    &:hover {
      color: var(--ink);
      border-bottom-color: transparent;
    }

    &.router-link-exact-active {
      color: var(--ink);
      border-bottom: 1px solid var(--ink);
    }
  }
}

.tgl {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: 6px 12px;
  cursor: pointer;

  &:hover {
    color: var(--ink);
    border-color: var(--ink);
  }
}

.foot {
  border-top: 1px solid var(--rule);
  padding: 36px 0 64px;
  margin-top: 64px;
  color: var(--faint);
  font-family: var(--font-sans);
  font-size: 13px;
}

@media (max-width: 900px) {
  .nav {
    display: none;
  }
}
</style>
