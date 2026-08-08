import type { Dialogue } from '@/lib/db/types'

export default function ShadowingScreen({ dialogue }: { dialogue: Dialogue }) {
  return <div>Shadowing screen placeholder for {dialogue.id}</div>
}
