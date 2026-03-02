import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

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
          borderRadius: '112px',
          border: '16px solid rgba(103,232,249,0.34)',
          background:
            'radial-gradient(circle at 16% 14%, rgba(56,189,248,0.28), transparent 36%), linear-gradient(130deg, #04101b 0%, #0a2035 100%)',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: 208,
          letterSpacing: '-0.06em',
        }}
      >
        TN
      </div>
    ),
    {
      ...size,
    },
  );
}
