import { ShieldCheck } from 'lucide-react'

/** 上传音乐的版权提示：说明责任，不承诺“上传任何音乐都没有版权问题” */
export function MusicCopyrightNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`um-copyright${compact ? ' is-compact' : ''}`}>
      <ShieldCheck size={14} aria-hidden="true" />
      <span>
        请仅上传你拥有使用权或已获得授权的音乐。
        {!compact && <> 上传音乐仅用于你自己的旅行视频。请确保你拥有音乐版权或合法使用授权；发布到视频平台时，平台仍可能按自己的规则识别版权。</>}
      </span>
    </p>
  )
}
