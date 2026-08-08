import type { Dialogue } from '@/lib/db/types'

export default function ListenTab({ dialogue }: { dialogue: Dialogue }) {
  return <div>Listen tab placeholder for {dialogue.id}</div>
}
