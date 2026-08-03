import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #C1272D, #A21E23)',
          color: '#FFF3DC',
          fontSize: 40,
          fontWeight: 700,
        }}
      >
        華
      </div>
    ),
    { ...size }
  )
}
