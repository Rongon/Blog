/**
 * 敏感词过滤（占位版）。
 *
 * 【它是什么】一个最朴素的「命中就拒绝」的词表。提交前在客户端过一遍，
 * 命中了就直接给出提示，不浪费一次请求。
 *
 * 【它不是什么】这不是内容审核。客户端过滤可以被绕过（改前端、或者直接调 API），
 * 要做真的审核得接腾讯云「内容安全」这类服务，那是按量计费、单独开通的。
 * 我在答辩手册里会如实写：个人项目用词表代替审核服务。
 *
 * 【真正挡得住东西的是这三层】
 *   1. 必须登录才能发（每条评论有主人）
 *   2. 数据库层的 30 秒频率限制（见 supabase/schema.sql 里的触发器）
 *   3. RLS 策略：只能写自己的、只能删自己的
 * 词表只是让正常用户少发一条废评论，不是安全边界。
 *
 * 想扩充就在下面加词，一行一个，别客气。
 */

const BANNED_WORDS = [
  '代开发票',
  '加微信',
  '博彩',
  '刷单',
  '办证',
  '贷款',
  '色情',
  '赌博',
]

export interface BannedResult {
  ok: boolean
  /** 命中的词，用来给用户一句明确的提示 */
  word?: string
}

export function checkBannedWords(text: string): BannedResult {
  const normalized = text.replace(/\s+/g, '')
  const hit = BANNED_WORDS.find((w) => normalized.includes(w))
  return hit ? { ok: false, word: hit } : { ok: true }
}

export const MAX_COMMENT_LENGTH = 1000
