import { ImageResponse } from 'next/og';

export const alt = 'TransNote - Realtime transcript and note workflow';
export const size = {
  width: 1200,
  height: 600,
};
export const contentType = 'image/png';

export default function TwitterImage() {
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
            'radial-gradient(circle at 12% 18%, rgba(56,189,248,0.26), transparent 36%), radial-gradient(circle at 78% 80%, rgba(45,212,191,0.2), transparent 32%), linear-gradient(130deg, #02050c 0%, #081628 58%, #12273f 100%)',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-110px',
            top: '-120px',
            width: '390px',
            height: '390px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(45,212,191,0.22), rgba(45,212,191,0))',
          }}
        />

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '54px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '760px' }}>
            <span style={{ fontSize: '22px', fontWeight: 600, color: '#67e8f9' }}>
              AI Meeting Notes Workspace
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
              <span style={{ fontSize: '60px', fontWeight: 800 }}>Realtime Transcript,</span>
              <span style={{ fontSize: '60px', fontWeight: 800 }}>Note-first Workflow</span>
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
                  border: '1px solid rgba(148,163,184,0.46)',
                  borderRadius: '999px',
                  padding: '7px 20px',
                  fontSize: '20px',
                  color: 'rgba(226,232,240,0.9)',
                  lineHeight: 1.1,
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
