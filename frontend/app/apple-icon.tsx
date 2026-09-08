import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 42,
          border: '6px solid rgba(103,232,249,0.36)',
          background:
            'linear-gradient(30deg, rgb(253,137,37), rgb(255,12,0))',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
          fontSize: 70,
          letterSpacing: '-0.05em',
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
