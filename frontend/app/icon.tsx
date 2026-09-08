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
            '#111a4a',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
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
