/** 智能建议：浅橙色小卡，只在素材规则检查发现问题时出现，不抢主操作。 */

import { ArrowRight, Sparkles } from 'lucide-react'
import type { Suggestion } from '@/utils/video-studio'

export function SmartSuggestion({ suggestion, onApply }: { suggestion: Suggestion | null; onApply: (s: Suggestion) => void }) {
  if (!suggestion) return null
  return (
    <section className="vs-suggest" role="note">
      <p className="vs-suggest-title"><Sparkles size={13} /> 智能建议 · {suggestion.title}</p>
      <p>{suggestion.text}</p>
      {suggestion.action && (
        <button type="button" className="vs-text-btn is-brand" onClick={() => onApply(suggestion)}>
          {suggestion.action.label} <ArrowRight size={12} />
        </button>
      )}
    </section>
  )
}
