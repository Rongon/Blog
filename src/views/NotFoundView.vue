<script setup lang="ts">
import PlaceholderPage from '@/components/PlaceholderPage.vue'
</script>

<template>
  <PlaceholderPage title="404" note="这个地址不存在。">
    <RouterLink class="back" to="/">回首页</RouterLink>
  </PlaceholderPage>
</template>

<style scoped lang="scss">
.back {
  display: inline-block;
  margin-top: 8px;
  font-family: var(--font-sans);
  font-size: 14px;
}
</style>
