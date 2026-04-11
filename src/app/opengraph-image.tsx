import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'PathForge — AI Placement Prep for CSE Students'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0818 0%, #1a0a3e 50%, #0f172a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -100, left: -100,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, right: -80,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />

        {/* Logo */}
        <div style={{
          width: 80, height: 80,
          background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)',
          borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, marginBottom: 24,
          boxShadow: '0 0 60px rgba(124,58,237,0.5)',
        }}>
          🧭
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72, fontWeight: 800, color: 'white',
          marginBottom: 16, textAlign: 'center', lineHeight: 1.1,
        }}>
          PathForge
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 28, color: 'rgba(255,255,255,0.6)',
          textAlign: 'center', maxWidth: 700, marginBottom: 32,
        }}>
          AI Placement Prep for CSE Students
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['AI Roadmap', 'DSA Tracker', 'Readiness Score', 'Daily Tasks'].map((tag) => (
            <div key={tag} style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 100,
              padding: '8px 18px',
              fontSize: 18, color: 'rgba(255,255,255,0.7)',
            }}>
              {tag}
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{
          position: 'absolute', bottom: 32,
          fontSize: 20, color: 'rgba(255,255,255,0.3)',
        }}>
          pathforge.online · Founded by Abhinav
        </div>
      </div>
    ),
    { ...size }
  )
}
