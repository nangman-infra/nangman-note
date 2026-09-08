import { ImageResponse } from 'next/og';

export const alt = 'TransNote AI Meeting Notes Workspace';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 85% 20%, rgba(253,137,37,0.35), transparent 40%), radial-gradient(circle at 10% 90%, rgba(7,122,199,0.3), transparent 45%), #0e0918',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-80px',
            top: '40px',
            width: '360px',
            height: '360px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(103,232,249,0.16), rgba(103,232,249,0))',
          }}
        />

        <div
          style={{
            position: 'absolute',
            right: '56px',
            top: '52px',
            width: '250px',
            height: '526px',
            borderRadius: '36px',
            border: '1px solid rgba(103,232,249,0.34)',
            background:
              'repeating-linear-gradient(138deg, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.14) 2px, transparent 2px, transparent 20px)',
            opacity: 0.84,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '56px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '999px',
                border: '2px solid rgba(103,232,249,0.66)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              TN
            </div>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'rgba(226,232,240,0.94)',
              }}
            >
              TRANSNOTE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '760px' }}>
            <span style={{ fontSize: '24px', fontWeight: 300, color: '#fd8925' }}>
              AI Meeting Notes Workspace
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontSize: '64px', fontWeight: 300 }}>Realtime Transcript,</span>
              <span style={{ fontSize: '64px', fontWeight: 300 }}>Note-first Workflow</span>
            </div>
            <span style={{ fontSize: '24px', color: 'rgba(226,232,240,0.82)' }}>
              Capture meetings. Refine notes. Regenerate outcomes.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {['Realtime', 'Prompt-based', 'Markdown Ready'].map((item) => (
              <div
                key={item}
                style={{
                  border: '1px solid rgba(148,163,184,0.4)',
                  borderRadius: '999px',
                  padding: '8px 18px',
                  fontSize: '20px',
                  color: 'rgba(226,232,240,0.9)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
