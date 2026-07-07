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
            'radial-gradient(circle at 20% 16%, rgba(56,189,248,0.26), transparent 36%), linear-gradient(130deg, #061220 0%, #0f2a45 100%)',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
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
