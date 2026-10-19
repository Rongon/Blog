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
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// 挂载即初始化（内部有 started 标志，重复调用不会重复请求）
void auth.init()

async function onSignOut() {
  await auth.signOut()
  ElMessage.success('已退出登录')
}
</script>

<template>
  <template v-if="auth.isLoggedIn">
    <span class="who">{{ auth.displayName }}</span>
    <button class="out" type="button" @click="onSignOut">退出</button>
  </template>
  <RouterLink v-else class="in" to="/login">登录</RouterLink>
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
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--muted);

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
