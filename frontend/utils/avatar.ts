/**
 * 头像图片：上传时生成两张正方形 JPEG —— 原图（最大 512）和小图（160）。
 * 导航栏、侧栏等小尺寸位置用小图，2 倍 / 3 倍屏需要更大时浏览器按 srcset 自动换原图。
 * 旧头像没有小图时直接用原图。
 */

export const AVATAR_SIZE = 512
export const AVATAR_SMALL_SIZE = 160

export type AvatarSource = { avatarUrl?: string | null; avatarSmallUrl?: string | null }

/** <img> 的 src / srcSet；没有头像时返回 null（显示首字） */
export function avatarImage(user?: AvatarSource | null) {
  const full = user?.avatarUrl || undefined
  if (!full) return null
  const small = user?.avatarSmallUrl || undefined
  return small ? { src: small, srcSet: `${small} ${AVATAR_SMALL_SIZE}w, ${full} ${AVATAR_SIZE}w` } : { src: full, srcSet: undefined }
}
