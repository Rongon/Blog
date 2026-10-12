/**
 * 评论的数据层（适配器）。
 *
 * 【为什么单独一层】页面只认这里的三个函数：list / create / remove。
 * 它们背后是 Supabase，但页面不需要知道。哪天换成自建后端、或者换成 CloudBase，
 * 只改这个文件，组件一行都不用动。
 *
 * 【这一层负责的四件事】
 *   1. 数据形状转换：数据库用 snake_case，前端用 camelCase
 *   2. 错误翻译：把 Postgres 的错误码变成用户看得懂的中文
 *   3. 幂等：重复提交时把「唯一约束冲突」当成成功，而不是报错
 *   4. 可取消：把 AbortSignal 传给底层请求
 */

import { supabase } from '@/lib/supabase'
import { checkBannedWords, MAX_COMMENT_LENGTH } from '@/data/bannedWords'

const TABLE = 'comments'
const COLUMNS = 'id, created_at, post_slug, author_id, author_name, body, client_id'

/** 数据库里的行 */
interface CommentRow {
  id: string
  created_at: string
  post_slug: string
  author_id: string
  author_name: string
  body: string
  client_id: string
}

/** 页面上用的评论 */
export interface Comment {
  id: string
  postSlug: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
  /** 客户端生成的幂等键 */
  clientId: string
  /** 乐观更新用：这条还在路上（本地临时态，不来自服务端） */
  pending?: boolean
}

export interface CreateCommentInput {
  postSlug: string
  body: string
  /** 幂等键。同一条评论重试时必须传同一个值 */
  clientId: string
  authorId: string
  authorName: string
}

/** 带错误码的评论异常，页面靠 code 决定怎么提示 */
export class CommentError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CommentError'
    this.code = code
  }
}

function mapRow(row: CommentRow): Comment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    clientId: row.client_id,
  }
}

/**
 * 把 Supabase / Postgres 的错误翻译成人话。
 * 数据库抛的是错误码，用户要的是「我该怎么办」。
 */
function translateError(error: { code?: string; message?: string }): CommentError {
  const raw = error.message ?? ''

  // 频率限制是我们自己在触发器里 raise 的，消息就是 'RATE_LIMITED'
  if (raw.includes('RATE_LIMITED')) {
    return new CommentError('RATE_LIMITED', '发得太快了，等 30 秒再发下一条。')
  }

  switch (error.code) {
    case '23505':
      return new CommentError('DUPLICATE', '这条评论已经发出去了。')
    case '23514':
      return new CommentError('INVALID', `内容长度不对（1–${MAX_COMMENT_LENGTH} 字）。`)
    // 42501 = insufficient_privilege，通常是 RLS 策略挡下来的
    case '42501':
      return new CommentError('FORBIDDEN', '没有权限做这件事。')
    case 'PGRST301':
      return new CommentError('UNAUTHORIZED', '登录状态过期了，重新登录一下。')
    default:
      return new CommentError(error.code ?? 'UNKNOWN', '请求失败了，稍后重试。')
  }
}

/** 取某篇文章的评论，按时间倒序 */
export async function listComments(postSlug: string, signal?: AbortSignal): Promise<Comment[]> {
  let query = supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq('post_slug', postSlug)
    .order('created_at', { ascending: false })
    .limit(200)

  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query
  if (error) throw translateError(error)
  return ((data ?? []) as CommentRow[]).map(mapRow)
}

/**
 * 发一条评论。
 *
 * 【幂等是怎么做到的】clientId 由调用方生成，同一次「发表」重试时保持不变。
 * 数据库上 (author_id, client_id) 有唯一约束，所以第二次插入必然冲突（错误码 23505）。
 * 这里把冲突当成成功，把已经存在的那条读回来返回——用户看到的结果一样，也
 * 不会出现两条一模一样的评论。这就是「请求幂等」在代码里的样子。
 */
export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const text = input.body.trim()

  if (!text) throw new CommentError('EMPTY', '评论不能是空的。')
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new CommentError('TOO_LONG', `最多 ${MAX_COMMENT_LENGTH} 个字。`)
  }

  const banned = checkBannedWords(text)
  if (!banned.ok) {
    throw new CommentError('BANNED', `内容里有不允许出现的词（${banned.word}），改一下再发。`)
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      post_slug: input.postSlug,
      body: text,
      client_id: input.clientId,
      author_id: input.authorId,
      author_name: input.authorName,
    })
    .select(COLUMNS)
    .single()

  if (error) {
    // 【幂等兜底】不管服务端回的是什么错，都先查一下这个 client_id 是不是已经写进去了。
    //
    // 为什么不能只判 23505（唯一约束冲突）：
    //   数据库上的频率限制触发器是 BEFORE INSERT，它比唯一约束先执行。
    //   所以「同一条评论重试」拿到的很可能不是 23505，而是 RATE_LIMITED。
    //   只判 23505 的话，用户会看到一句「发得太快了」，但那条评论其实已经发出去了——
    //   他会以为失败，然后再发一条不同的，结果评论区多了一条他以为没发出去的留言。
    //
    // 只要这个 client_id 已经在库里，就说明我们之前那次其实成功了。
    const { data: existing } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('author_id', input.authorId)
      .eq('client_id', input.clientId)
      .maybeSingle()

    if (existing) return mapRow(existing as CommentRow)

    throw translateError(error)
  }

  return mapRow(data as CommentRow)
}

/** 删自己的评论。删别人的会被 RLS 挡下来（返回 0 行，不报错） */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw translateError(error)
}
