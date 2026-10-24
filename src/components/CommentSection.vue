<script setup lang="ts">
/**
 * 评论区 —— 重难点 2 的实现。
 *
 * 这一块真正难的不是「把评论显示出来」，而是四件收尾工作：
 *   1. 乐观更新：点发表立刻上屏，请求在后台跑
 *   2. 失败回滚：请求失败要把那条精确删掉，并把用户打的字还回去
 *   3. 幂等：同一次发表重试时不许产生两条评论
 *   4. 乱序：切换文章时先发的请求后回来，不许覆盖新结果
 *
 * 下面每一处「为什么这么写」的注释都是面试要讲的东西，别删。
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  createComment,
  deleteComment as removeComment,
  listComments,
  type Comment,
} from '@/services/commentService'

const props = defineProps<{ postSlug: string }>()

const auth = useAuthStore()
const route = useRoute()

const comments = ref<Comment[]>([])
const loading = ref(false)
const submitting = ref(false)
const draft = ref('')

/* ---------------------------------------------------------------
 * 取数：可取消 + 序号兜底
 * 和文章列表页一个套路——abort 是真取消，序号是最后一道保险。
 * ------------------------------------------------------------- */
let controller: AbortController | null = null
let seq = 0

function isAborted(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : '出了点问题，稍后再试。'
}

async function load() {
  controller?.abort()
  controller = new AbortController()
  const my = ++seq

  loading.value = true
  try {
    const rows = await listComments(props.postSlug, controller.signal)
    if (my !== seq) return // 已经有更新的请求在路上，这份结果过期了
    comments.value = rows
  } catch (e) {
    if (my === seq && !isAborted(e)) ElMessage.error(messageOf(e))
  } finally {
    if (my === seq) loading.value = false
  }
}

watch(() => props.postSlug, load, { immediate: true })
onBeforeUnmount(() => controller?.abort())

/* ---------------------------------------------------------------
 * 乐观更新
 *
 * 这里有两个长得像、作用完全不同的 id，是这一块最容易讲错的地方：
 *
 *   · 本地临时 id（tmp-xxx）：只活在浏览器内存里，用来在列表里「认出这条」
 *     好在成功时替换、失败时精确删除。它不会发给服务端。
 *
 *   · clientId（幂等键）：会写进数据库。同一次发表重试时它保持不变，
 *     数据库靠 (author_id, client_id) 的唯一约束把重复的那次挡掉。
 *     它解决的是「网络抖动导致客户端重试，结果发了两条」。
 * ------------------------------------------------------------- */

/** 生成一个本地临时 id */
function makeTempId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function onSubmit() {
  // 防重复提交第一层：请求在跑的时候按钮是禁用的，正常点不出第二次
  if (submitting.value) return

  const user = auth.user
  if (!user) {
    ElMessage.warning('登录之后才能留言。')
    return
  }

  const text = draft.value.trim()
  if (!text) return

  submitting.value = true

  const clientId = crypto.randomUUID()
  const optimistic: Comment = {
    id: makeTempId(),
    postSlug: props.postSlug,
    authorId: user.id,
    authorName: auth.displayName,
    body: text,
    createdAt: new Date().toISOString(),
    clientId,
    pending: true,
  }

  // 先上屏。用户在这一刻就看到了自己的评论，不等网络。
  comments.value = [optimistic, ...comments.value]
  draft.value = ''

  try {
    const saved = await createComment({
      postSlug: props.postSlug,
      body: text,
      clientId,
      authorId: user.id,
      authorName: auth.displayName,
    })

    // 用服务端返回的真实数据替换掉本地临时那条。
    // 注意是按 id 找位置再替换，不是直接 pop——
    // 等待期间用户可能又发了别的评论，队列顺序不能假设。
    const index = comments.value.findIndex((c) => c.id === optimistic.id)
    if (index > -1) comments.value[index] = saved
  } catch (e) {
    // 回滚：按 id 精确删除，而不是删最后一条
    comments.value = comments.value.filter((c) => c.id !== optimistic.id)
    // 把用户打的字还回去。这一点最容易被忽略：
    // 失败了只是删掉评论的话，用户刚才打的字就白打了。
    draft.value = text
    ElMessage.error(messageOf(e))
  } finally {
    submitting.value = false
  }
}

/* ---------------------------------------------------------------
 * 删除：同样是乐观的——先从列表拿掉，失败再放回来
 * ------------------------------------------------------------- */
function onDelete(target: Comment) {
  ElMessageBox.confirm('删掉这条评论？删了就找不回来了。', '确认删除', {
    confirmButtonText: '删掉',
    cancelButtonText: '算了',
    type: 'warning',
  })
    .then(async () => {
      const backup = comments.value
      comments.value = comments.value.filter((c) => c.id !== target.id)
      try {
        await removeComment(target.id)
        ElMessage.success('已删除')
      } catch (e) {
        comments.value = backup // 回滚
        ElMessage.error(messageOf(e))
      }
    })
    .catch(() => {
      /* 用户点了「算了」，什么都不做 */
    })
}

function canDelete(c: Comment): boolean {
  return Boolean(auth.user && auth.user.id === c.authorId && !c.pending)
}

/**
 * 点「去登录」直接开始 GitHub 授权，不经过中间的登录页。
 * 只有一种情况会退回登录页：OAuth 没配好，原地提示比跳走更有用。
 */
async function onSignIn() {
  try {
    await auth.signInWithGitHub(route.fullPath)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'GitHub 登录没能开始')
  }
}

/** 相对时间。只做展示，不参与任何逻辑 */
function formatTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (Number.isNaN(then)) return ''
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <section class="comments">
    <h2 class="title">
      评论
      <span v-if="comments.length" class="count ui">{{ comments.length }}</span>
    </h2>

    <!-- 发评论：登录了给输入框，没登录给入口 -->
    <div v-if="auth.isLoggedIn" class="editor">
      <div class="who ui">
        以 <strong>{{ auth.displayName }}</strong> 的身份发言
      </div>
      <textarea
        v-model="draft"
        rows="4"
        maxlength="1000"
        placeholder="说点什么…（最多 1000 字）"
        :disabled="submitting"
      ></textarea>
      <div class="actions">
        <span class="ui hint">同一个人 30 秒内只能发一条</span>
        <el-button type="primary" :loading="submitting" :disabled="!draft.trim()" @click="onSubmit">
          发表
        </el-button>
      </div>
    </div>

    <div v-else class="needlogin">
      <p>评论需要先登录。</p>
      <el-button type="primary" plain @click="onSignIn">用 GitHub 登录</el-button>
    </div>

    <!-- 列表 -->
    <div class="list" :class="{ busy: loading }">
      <p v-if="loading && !comments.length" class="empty ui">加载中…</p>
      <p v-else-if="!comments.length" class="empty ui">还没有评论。第一条留给谁？</p>

      <article
        v-for="c in comments"
        :key="c.id"
        class="item"
        :class="{ pending: c.pending }"
      >
        <div class="meta ui">
          <strong>{{ c.authorName }}</strong>
          <span class="dot">·</span>
          <span>{{ c.pending ? '发送中…' : formatTime(c.createdAt) }}</span>
        </div>
        <p class="body">{{ c.body }}</p>
        <button v-if="canDelete(c)" class="del ui" type="button" @click="onDelete(c)">删除</button>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.comments {
  margin-top: 64px;
  padding-top: 34px;
  border-top: 1px solid var(--rule);
}

.title {
  font-size: 22px;
  margin-bottom: 22px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.count {
  font-size: 13px;
  color: var(--faint);
}

.editor {
  margin-bottom: 34px;

  textarea {
    width: 100%;
    font-family: var(--font-serif);
    font-size: 16px;
    line-height: 1.8;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 12px 14px;
    resize: vertical;

    &:focus {
      outline: 2px solid var(--link);
      outline-offset: 1px;
      border-color: var(--link);
    }

    &:disabled {
      opacity: 0.6;
    }
  }
}

.who {
  font-size: 12.5px;
  color: var(--faint);
  margin-bottom: 8px;

  strong {
    color: var(--ink);
  }
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
}

.hint {
  font-size: 12.5px;
  color: var(--faint);
}

.needlogin {
  margin-bottom: 34px;
  padding: 20px 22px;
  border: 1px solid var(--rule-soft);
  background: var(--surface);

  p {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.8;
  }
}

.list {
  transition: opacity 0.15s ease;

  &.busy {
    opacity: 0.6;
  }
}

.empty {
  color: var(--faint);
  font-size: 14px;
  padding: 12px 0 20px;
}

.item {
  position: relative;
  padding: 20px 0 22px;
  border-top: 1px solid var(--rule-soft);

  &.pending {
    opacity: 0.55;
  }
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
  color: var(--faint);
  margin-bottom: 8px;

  strong {
    color: var(--ink);
    font-weight: 400;
    font-family: var(--font-serif);
    font-size: 14.5px;
  }
}

.body {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.85;
}

.del {
  position: absolute;
  right: 0;
  top: 20px;
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

@include sm-down {
  .comments {
    margin-top: 48px;
    padding-top: 26px;
  }

  // 窄屏上「30 秒一条」的提示和按钮挤在一行会换行，干脆改成上下排、按钮占满
  .actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;

    .hint {
      order: 2;
      text-align: center;
    }
  }

  .needlogin {
    padding: 16px 16px 18px;
  }
}
</style>
