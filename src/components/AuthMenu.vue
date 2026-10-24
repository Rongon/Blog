<script setup lang="ts">
/**
 * 顶栏右上角的登录态。
 *
 * 【它为什么被单独拆出来】
 * 这是全站唯一「渲染前必须先知道用户是谁」的地方。把这段 UI 单独放一个组件，
 * 再在 DefaultLayout 里用 defineAsyncComponent 去装它，Supabase 客户端
 * （压缩后约 80 KiB）就不再是首页的静态依赖，而是一个独立的 chunk。
 *
 * 【store 的初始化也搬到这里了】
 * 原来在 main.ts 里全局调 `useAuthStore(pinia).init()`。那句话的意思是
 * 「不管当前页面用不用得上登录态，启动时都要问一次服务器」。首页显然用不上。
 * 现在改成「谁渲染这个组件，谁负责初始化」，登录态真正被需要的时候才发生。
 */
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// 挂载即初始化（内部有 started 标志，重复调用不会重复请求）
void auth.init()

/**
 * GitHub 授权回来时是**整页刷新**，Vue 里存的东西全没了。
 * 所以「登录前想去哪一页」记在 sessionStorage 里，等登录态就绪后再送回去。
 * 放在这个组件里而不是 App.vue：这个文件本来就是登录态专属的 chunk，
 * 放进 App.vue 会把 Supabase 又拽回首页的入口包（优化项 8 刚把它摘出去）。
 */
watch(
  () => auth.ready && auth.isLoggedIn,
  (ok) => {
    if (!ok) return
    const next = sessionStorage.getItem('p2026:after-login')
    if (!next) return
    sessionStorage.removeItem('p2026:after-login')
    void router.replace(next)
  },
  { immediate: true },
)

async function onSignOut() {
  await auth.signOut()
  ElMessage.success('已退出登录')
}

/**
 * 顶栏的「登录」直接开始 GitHub 授权，没有中间页。
 * 顺带把当前路径交出去，授权回来 AuthMenu 会把人送回原地。
 */
async function onSignIn() {
  try {
    await auth.signInWithGitHub(route.fullPath)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'GitHub 登录没能开始')
  }
}
</script>

<template>
  <template v-if="auth.isLoggedIn">
    <span class="who">{{ auth.displayName }}</span>
    <button class="out" type="button" @click="onSignOut">退出</button>
  </template>
  <button v-else class="in" type="button" @click="onSignIn">登录</button>
</template>

<style scoped lang="scss">
.who {
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--muted);
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.in {
  appearance: none;
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--muted);
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  line-height: inherit;
  cursor: pointer;

  &:hover {
    color: var(--ink);
    border-bottom-color: transparent;
  }
}

.out {
  font-family: var(--font-sans);
  font-size: 12.5px;
  color: var(--faint);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;

  &:hover {
    color: var(--danger);
  }
}
</style>
