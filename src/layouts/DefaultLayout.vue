<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { hasStoredSession } from '@/lib/authStorage'

const { theme, toggleTheme } = useTheme()
const route = useRoute()

/**
 * 优化项 8 的全部内容：把登录态从首屏关键路径上摘下来。
 *
 * 三件事叠在一起才真的省下字节：
 * 1. 登录 UI 拆成独立组件（`AuthMenu.vue`），Supabase 客户端跟着它走。
 * 2. 用 `defineAsyncComponent` 装它 —— 于是它成了一个独立的 chunk，
 *    不再被打进入口包。光做到这一步只是「挪到后面加载」，首页还是会把那 80 KiB 拉下来。
 * 3. 用 `hasStoredSession()` **同步**看一眼 localStorage：没有本地 session 的访客
 *    连挂载都不挂载，那个 chunk 一次都不会被请求。
 *    绝大多数访客（包括 Lighthouse 的匿名访问）走的都是这条路。
 */
const AuthMenu = defineAsyncComponent(() => import('@/components/AuthMenu.vue'))

const hasSession = ref(hasStoredSession())

// 登录 / 注册成功都是以「跳转」收尾的，路由一变就重新看一眼本地 session。
// 没有这一句，登录回来之后顶栏会一直卡在「登录」两个字上。
watch(
  () => route.fullPath,
  () => {
    hasSession.value = hasStoredSession()
  },
)

const nav = [
  { to: '/', label: '首页' },
  { to: '/projects', label: '项目' },
  { to: '/articles', label: '文章' },
  { to: '/about', label: '关于' },
]

/**
 * 慢版的地址。
 *
 * 慢版是 `v0-naive` 这个 tag 的构建产物，由 CI 额外构建一次、放进主站产物的
 * `/naive/` 目录里（见 `.github/workflows/deploy.yml`）。
 * 所以它和主站同源、同一次部署，不需要另外开仓库或另外配 Pages。
 *
 * 用 `import.meta.env.BASE_URL` 拼而不是写死 `/Program2026/naive/`：
 * 本地开发时 base 是 `/`，写死就点不到了。
 */
const naiveHref = `${import.meta.env.BASE_URL}naive/`

/** 窄屏下的折叠菜单。<900px 时桌面导航是隐藏的，没有这个就没法在手机上换页面 */
const menuOpen = ref(false)

// 点了菜单里的链接就自动收起，否则跳完页面菜单还挂着
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
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

      <!-- 快版 / 慢版并排 —— 这是「优化前 vs 优化后」的入口。
           慢版是 v0-naive 那个 tag 的构建产物（CI 额外构建一次、放进 /naive/，
           见 .github/workflows/deploy.yml），内容一样，但一张图没压、没 srcset、
           没代码分割、Element Plus 全量引入。

           为什么现在敢在**同一个标签页**里切（早先是 target="_blank"）：
           慢版那边已经有一条「← 回到快版」浮条了（scripts/add-back-link.mjs
           在部署产物里注入，源码不动），所以进去能出来。
           同页切换的好处是来回点三下也只有一个标签页 —— 不会攒出「两个快一个慢」。
           历史记录的体验也正常：浏览器后退就是回到对面那个版本。 -->
      <div class="ver" title="同一份内容的两个版本：慢版是性能优化之前的样子">
        <span class="on">快版</span>
        <a :href="naiveHref">慢版</a>
      </div>

      <!-- 登录态是异步的：本地有 session 才去装 AuthMenu（异步 chunk），
           否则当场渲染一个静态「登录」链接，Supabase SDK 一次都不下载。
           宽度固定在外层 .auth 上，两种状态互相切换时不会推动右边的按钮。 -->
      <div class="auth">
        <AuthMenu v-if="hasSession" />
        <RouterLink v-else class="in" to="/login">登录</RouterLink>
      </div>

      <button class="tgl" type="button" @click="toggleTheme">
        {{ theme === 'dark' ? '浅色模式' : '深色模式' }}
      </button>

      <button
        class="burger"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="site-menu"
        @click="menuOpen = !menuOpen"
      >
        {{ menuOpen ? '关闭' : '菜单' }}
      </button>
    </div>

    <nav id="site-menu" class="menu" :class="{ open: menuOpen }">
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to">
        {{ item.label }}
      </RouterLink>
      <a :href="naiveHref">慢版（优化前）</a>
    </nav>
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
@use '@/styles/breakpoints' as *;

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

/* 快版 / 慢版：一个小分段控件，紧挨着导航放。
   左边「快版」是当前站（反白 = 你在这里），右边「慢版」同页跳优化前的构建产物。
   对面（慢版）里有一条「← 回到快版」，所以来回切不会多开标签页。 */
.ver {
  display: inline-flex;
  flex: none;
  align-items: center;
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  overflow: hidden;

  .on,
  a {
    padding: 5px 9px;
    white-space: nowrap;
  }

  .on {
    background: var(--ink);
    color: var(--bg);
  }

  a {
    color: var(--muted);

    &:hover {
      color: var(--ink);
      border-bottom-color: transparent;
    }
  }
}

.auth {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  /* 「昵称 + 退出」的宽度上限（96 + 10 + 约 26），先占住。
     占位不动，登录态加载完就不会有横向位移 —— 这是这一项守住 CLS=0 的关键。 */
  min-width: 132px;

  .in {
    color: var(--muted);

    &:hover {
      color: var(--ink);
      border-bottom-color: transparent;
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

/* 汉堡按钮：宽屏不显示 */
.burger {
  display: none;
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

/* 折叠菜单：宽屏不显示，展开时从顶栏下面滑出来 */
.menu {
  display: none;
  flex-direction: column;
  border-top: 1px solid var(--rule-soft);
  background: var(--bg);

  a {
    font-family: var(--font-sans);
    font-size: 15px;
    color: var(--muted);
    padding: 14px 24px;
    border-bottom: 1px solid var(--rule-soft);

    &:hover {
      color: var(--ink);
      border-bottom-color: var(--rule-soft);
    }

    &.router-link-exact-active {
      color: var(--ink);
    }
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

@include md-down {
  .top-in {
    gap: 14px;
    padding: 0 16px;
  }

  .nav {
    display: none;
  }

  /* 顶栏在窄屏放不下这个分段控件，改由折叠菜单里的「慢版（优化前）」承担 */
  .ver {
    display: none;
  }

  .burger {
    display: block;
  }

  .menu.open {
    display: flex;
  }

  .auth {
    margin-left: auto;
  }
}

@include sm-down {
  .brand em {
    display: none;
  }

  .top-in {
    gap: 10px;
    padding: 0 12px;
  }

  .tgl,
  .burger {
    padding: 5px 9px;
    font-size: 12.5px;
  }

  .foot {
    padding: 28px 0 48px;
    margin-top: 48px;
  }
}
</style>
