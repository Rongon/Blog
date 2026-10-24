<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { hasStoredSession } from '@/lib/authStorage'
import VersionSwitch from '@/components/VersionSwitch.vue'

const { theme, toggleTheme } = useTheme()
const route = useRoute()
const router = useRouter()

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

/**
 * 未登录时那个「登录」按钮：点下去直接开始 GitHub 授权，不经过登录页。
 *
 * 【为什么不用静态 import】这里如果 `import { useAuthStore }`，Supabase SDK 就会被
 * 拽回入口包 —— 优化项 8 白做。所以用动态 import：只有真的点了登录，
 * 那一份 chunk 才被下载。未登录访客的常用路径（读文章）一次都不会触发它。
 */
const signInBusy = ref(false)
async function onSignIn() {
  if (signInBusy.value) return
  signInBusy.value = true
  try {
    const { useAuthStore } = await import('@/stores/auth')
    await useAuthStore().signInWithGitHub(route.fullPath)
  } catch {
    // 授权没能开始（最可能是 provider 没配好）。送去登录页，那里有一句人话解释。
    // 注意这里不能 import element-plus 弹 toast：那会把它的 chunk 拉进首屏依赖图，
    // 入口包立刻从 126 kB 涨回 300 kB 级别（实测过）。
    void router.push('/login')
  } finally {
    signInBusy.value = false
  }
}

const hasSession = ref(hasStoredSession())

// 登录 / 注册成功都是以「跳转」收尾的，路由一变就重新看一眼本地 session。
// 没有这一句，登录回来之后顶栏会一直卡在「登录」两个字上。
watch(
  () => route.fullPath,
  () => {
    hasSession.value = hasStoredSession()
  },
)

// 四个入口。项目只放站点自己那一个（见 src/data/projects.ts 的说明）。
const nav = [
  { to: '/', label: '首页' },
  { to: '/projects', label: '项目' },
  { to: '/articles', label: '文章' },
  { to: '/about', label: '关于' },
]

/** 窄屏下的折叠菜单。<900px 时桌面导航是隐藏的，没有这个就没法换页面 */
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
      <RouterLink to="/" class="brand"> 曾泽龙<em>AI 前端工程师</em> </RouterLink>

      <nav class="nav">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>

      <!-- 优化后 / 优化前开关不在导航栏里 —— 它固定在导航栏下方的右上角，
           见模板末尾的 <VersionSwitch /> 与 src/styles/version-switch.css。
           放进导航栏会挤掉 首页/文章 这些真链接，观感也差。 -->

      <!-- 登录态是异步的：本地有 session 才去装 AuthMenu（异步 chunk），
           否则当场渲染一个静态「登录」链接，Supabase SDK 一次都不下载。
           宽度固定在外层 .auth 上，两种状态互相切换时不会推动右边的按钮。 -->
      <div class="auth">
        <AuthMenu v-if="hasSession" />
        <button v-else class="in" type="button" :disabled="signInBusy" @click="onSignIn">登录</button>
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
    </nav>
  </header>

  <!-- 优化后 / 优化前开关。fixed 定位在导航栏下方右上角，所以放在文档哪个位置都不影响视觉 ——
       放这儿是为了让它只出现一次，且语义上属于「站点外壳」而不是某个页面。 -->
  <VersionSwitch />

  <main>
    <slot />
  </main>
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

/* 开关样式不在这里 —— 它在 src/styles/version-switch.css。
   两版共用同一份 CSS（快版 VersionSwitch.vue / 慢版 VersionSwitch.naive.vue），
   因为它们是对照实验里的同一个控件，长得不一样就等于引入了新变量。 */

.auth {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  /* 这里原来写的是 min-width: 132px（给「昵称 + 退出」预留宽度，防登录态切换时顶栏跳动）。
     现在改成不预留：预留在未登录时会在「登录」和「浅色模式」之间留一大块空白，
     和顶部导航挤在右边的手感对不上。未登录访客本来就不会挂载 AuthMenu
     （见上面 hasStoredSession 的同步判断），所以他们看到的顶栏永远是稳定的，CLS 不受影响。 */
  min-width: 0;

  /* 「登录」原来是 RouterLink（一个 <a>），现在是 <button>（因为点击要直接开始
     GitHub 授权，不能走路由）。按钮自带浏览器样式：灰底、边框、内边距，
     深色模式下会露出一块白 —— 所以必须把外观彻底还原成纯文字，
     否则顶栏和慢版对不上，而且难看。 */
  .in {
    appearance: none;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    font: inherit;
    color: var(--muted);
    line-height: inherit;
    cursor: pointer;

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

@include md-down {
  .top-in {
    gap: 14px;
    padding: 0 16px;
  }

  .nav {
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
}
</style>
