<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { hasOAuthCallback, hasStoredSession } from '@/lib/authStorage'
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

// 两种情况要装登录组件：本地已有 session，或者这一页是 OAuth 回调（token 还在 URL 里，
// 必须让 SDK 跑起来把它解析掉）。后者不加的话，登录回来会永远停在「登录」两个字上。
const hasSession = ref(hasStoredSession() || hasOAuthCallback())

// 登录成功是以「跳转」收尾的，路由一变就重新看一眼本地 session。
// 没有这一句，登录回来之后顶栏会一直卡在「登录」两个字上。
watch(
  () => route.fullPath,
  () => {
    hasSession.value = hasStoredSession() || hasOAuthCallback()
  },
)

// 四个入口。项目只放站点自己那一个（见 src/data/projects.ts 的说明）。
const nav = [
  { to: '/', label: '首页' },
  { to: '/projects', label: '项目' },
  { to: '/articles', label: '文章' },
  { to: '/about', label: '关于' },
]

/**
 * 窄屏的三条杠菜单（<900px 时栏目条藏起来，靠它进页面）。
 *
 * 【为什么是折叠菜单而不是把栏目条摆出来】
 * 试过两行报头的写法（第一行报名、第二行栏目条），功能上没问题，但手机上的老习惯
 * 就是右上角三条杠 —— 通用约定比「更显眼」更重要，读者不需要重新学。
 * 代价是「关于」被藏起来一次点击，所以菜单里四项必须全在，且点完自动收起。
 */
const menuOpen = ref(false)

// 展开时给 body 挂个记号：那个固定定位的「优化后/优化前」开关会浮在菜单上，
// 看起来像个 bug（它 z-index 比顶栏高）。用 body 上的类让样式去隐藏它，
// 而不是在这里直接摸 DOM 元素 —— 两版共用这份组件，所以行为天然一致。
watch(
  menuOpen,
  (open) => {
    document.body.classList.toggle('menu-open', open)
  },
  { flush: 'sync' },
)

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

/**
 * 菜单打开后，除了点菜单项和三条杠本身，点哪儿都该收回去。
 *
 * 【为什么用 pointerdown 而不是 click】click 要等手指抬起来，而且如果用户是想点
 * 菜单底下露出来的东西（比如首屏那个「读文章」），pointerdown 先收起菜单、
 * 紧接着 click 照常落到那个链接上 —— 一次点击既要「关菜单」又要「进页面」，
 * 不会变成连点两次。用 click 的话这一下会被菜单吃掉。
 *
 * 【不能 preventDefault】那样就把下面那个点击也拦掉了。
 *
 * Esc 一起挂在同一个函数里：桌面窄窗口调过宽度之后也会用这个菜单，
 * 键盘用户按 Esc 收起来是通用预期。
 */
const burgerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

function onDocPointerDown(event: PointerEvent) {
  if (!menuOpen.value) return
  const target = event.target as Node | null
  if (!target) return
  if (burgerRef.value?.contains(target) || menuRef.value?.contains(target)) return
  menuOpen.value = false
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
})
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

      <!-- 窄屏的三条杠。用图标而不是「菜单」两个字：三条杠是通用约定，
           而「菜单」两个汉字在小按钮里既挤又不像按钮。 -->
      <button
        ref="burgerRef"
        class="burger"
        type="button"
        :class="{ open: menuOpen }"
        :aria-expanded="menuOpen"
        aria-controls="site-menu"
        :aria-label="menuOpen ? '收起导航' : '打开导航'"
        @click="menuOpen = !menuOpen"
      >
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
          <rect class="b1" x="0" y="0" width="18" height="1.6" fill="currentColor" />
          <rect class="b2" x="0" y="5.2" width="18" height="1.6" fill="currentColor" />
          <rect class="b3" x="0" y="10.4" width="18" height="1.6" fill="currentColor" />
        </svg>
      </button>
    </div>

    <nav id="site-menu" ref="menuRef" class="menu" :class="{ open: menuOpen }">
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

/* 三条杠按钮：宽屏不显示 */
.burger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 32px;
  padding: 0;
  color: var(--muted);
  background: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  cursor: pointer;

  &:hover {
    color: var(--ink);
    border-color: var(--ink);
  }

  svg {
    display: block;
  }

  /* 展开时三条杠收成叉：位置靠 transform 过渡，不换图标就不会有跳动 */
  rect {
    transform-origin: 9px 6px;
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }

  &.open {
    .b1 {
      transform: translateY(5.2px) rotate(45deg);
    }

    .b2 {
      opacity: 0;
    }

    .b3 {
      transform: translateY(-5.2px) rotate(-45deg);
    }
  }
}

/* 折叠菜单：宽屏不显示。窄屏下是一个浮在右上角的小面板 ——
   绝对定位，不参与文档流，所以不会把下面的内容往下推，只是盖住右上角一小块。 */
.menu {
  display: none;
  position: absolute;
  top: 100%;
  right: 16px;
  z-index: 30;
  flex-direction: column;
  width: 168px;
  margin-top: -6px;
  padding: 4px 0;
  background: var(--bg);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);

  a {
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--muted);
    padding: 10px 14px;
    border-bottom: 0;

    &:hover {
      color: var(--ink);
      background: var(--rule-soft);
    }

    &.router-link-exact-active {
      color: var(--ink);
    }
  }
}

/* 窄屏：栏目条收起，右上角三条杠。</900px 一行就放得下「报名 + 登录 + 主题 + 三条杠」。 */
@include md-down {
  .top-in {
    gap: 16px;
    padding: 0 16px;
  }

  .nav {
    display: none;
  }

  .burger {
    display: flex;
  }

  .menu.open {
    display: flex;
  }

  .auth {
    margin-left: auto;
  }
}

@include sm-down {
  .top-in {
    gap: 10px;
    padding: 0 12px;
  }

  .tgl {
    padding: 5px 9px;
    font-size: 12.5px;
  }

  .menu {
    right: 12px;
    width: 156px;
  }
}
</style>
