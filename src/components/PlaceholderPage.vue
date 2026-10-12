<script setup lang="ts">
defineProps<{
  title: string
  note?: string
}>()
</script>

<template>
  <section class="pg">
    <div class="wrap">
      <div class="kicker">模块待搭建</div>
      <h1>{{ title }}</h1>
      <p v-if="note" class="note">{{ note }}</p>
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.pg {
  padding: 72px 0;
}

h1 {
  font-size: 34px;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}

.kicker {
  margin-bottom: 18px;
}

.note {
  color: var(--muted);
  max-width: 38em;
}
</style>
