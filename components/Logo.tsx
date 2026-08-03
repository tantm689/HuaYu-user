const SIZE_CLASSES = {
  sm: { box: 'h-9 w-9 rounded-lg', glyph: 'text-lg' },
  md: { box: 'h-14 w-14 rounded-2xl', glyph: 'text-2xl' },
} as const

export default function Logo({ size = 'md' }: { size?: keyof typeof SIZE_CLASSES }) {
  const { box, glyph } = SIZE_CLASSES[size]

  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center bg-gradient-to-br from-brand-red to-brand-red-dark font-han-title font-bold text-brand-cream-text shadow-[0_3px_10px_rgba(193,39,45,0.28)]`}
      aria-hidden="true"
    >
      <span className={glyph}>華</span>
    </div>
  )
}
