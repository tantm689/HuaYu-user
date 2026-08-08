import type { DialogueKind } from './types'

// dialogues.title_zh/title_vi don't exist (dropped in Admin migration
// 0017_drop_dialogue_titles.sql) - they were always a purely mechanical
// "對話一"/"Hội thoại I" label derived from kind+position, never genuine
// content. Display name is computed at render time from `kind` plus a
// per-kind 1-based counter, mirroring Admin's lib/dialogueDisplayName.ts.
//
// The counter is independent per kind: two dialogues both kind='dialogue'
// are "Hội thoại 1"/"Hội thoại 2"; a kind='dialogue' followed by a
// kind='passage' are "Hội thoại 1"/"Đoạn văn 1" (not "...2").
export function dialogueDisplayNames(dialogues: { kind: DialogueKind }[]): string[] {
  const countByKind: Record<DialogueKind, number> = { dialogue: 0, passage: 0 }

  return dialogues.map((d) => {
    countByKind[d.kind] += 1
    const label = d.kind === 'passage' ? 'Đoạn văn' : 'Hội thoại'
    return `${label} ${countByKind[d.kind]}`
  })
}
