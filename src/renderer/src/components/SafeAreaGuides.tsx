import type { CSSProperties } from 'react'

export type GuidePlatform = 'none' | 'tiktok' | 'instagram'

// A realistic mock of the platform's on-screen UI, drawn over the preview so
// captions can be positioned clear of it. Never exported. Positions are % of the
// video frame; sizes use container units so it scales with the stage.

const shadow = 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))'

function Svg({ d, size, fill = '#fff', stroke }: { d: string; size: number; fill?: string; stroke?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={`${size}cqh`}
      height={`${size}cqh`}
      style={{ filter: shadow, display: 'block' }}
      fill={stroke ? 'none' : fill}
      stroke={stroke}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d.startsWith('<') ? (
        <g dangerouslySetInnerHTML={{ __html: d }} />
      ) : (
        <path d={d} />
      )}
    </svg>
  )
}

const ICON: Record<string, string> = {
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  comment:
    'M21 6h-2v9H7l-4 4V4c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v2zm-2-4H5v12.17L6.17 13H19V2z',
  bubble: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  repost:
    '<path d="M17 1l4 4-4 4V6H7v6H5V4h12V1zM7 23l-4-4 4-4v3h10v-6h2v8H7v3z"/>',
  bookmark: 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z',
  moreV: '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>',
  music: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  search:
    'M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
  clip: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 6l2 3M13 6l2 3" stroke="#fff"/>',
  chevron: 'M7 10l5 5 5-5z',
  sliders:
    '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 18h2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  verified:
    'M12 1l2.4 2.1 3.2-.3.9 3 3 .9-.3 3.2L23 12l-2.1 2.4.3 3.2-3 .9-.9 3-3.2-.3L12 23l-2.4-2.1-3.2.3-.9-3-3-.9.3-3.2L1 12l2.1-2.4-.3-3.2 3-.9.9-3 3.2.3z',
}

const wrap: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }
const at = (l: number, t: number, extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  left: `${l}%`,
  top: `${t}%`,
  ...extra,
})
const railCol: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6cqh' }
const cnt: CSSProperties = {
  fontSize: '1.7cqh',
  fontWeight: 600,
  color: '#fff',
  filter: shadow,
  letterSpacing: '0.02em',
}
const uname: CSSProperties = { fontSize: '2.1cqh', fontWeight: 700, color: '#fff', filter: shadow }
const subtxt: CSSProperties = { fontSize: '1.9cqh', color: 'rgba(255,255,255,0.92)', filter: shadow }

function RailBtn({ y, icon, n, size = 4.2 }: { y: number; icon: keyof typeof ICON; n?: string; size?: number }) {
  return (
    <div style={at(90, y, { transform: 'translateX(-50%)', ...railCol })}>
      <Svg d={ICON[icon]} size={size} />
      {n && <span style={cnt}>{n}</span>}
    </div>
  )
}

function NavBar({ items }: { items: (keyof typeof ICON)[] }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '6.5%',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 6%',
      }}
    >
      {items.map((k, i) => (
        <Svg key={i} d={ICON[k]} size={3.4} fill="rgba(255,255,255,0.9)" />
      ))}
    </div>
  )
}

export function SafeAreaGuides({ platform }: { platform: GuidePlatform }) {
  if (platform === 'none') return null

  if (platform === 'tiktok') {
    return (
      <div style={wrap} aria-hidden>
        {/* top tabs */}
        <div
          style={at(50, 5, {
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '3cqw',
            alignItems: 'center',
          })}
        >
          <span style={{ ...subtxt, opacity: 0.65 }}>Following</span>
          <span style={{ width: '1px', height: '2.2cqh', background: 'rgba(255,255,255,0.5)' }} />
          <span style={{ ...uname, fontSize: '2.2cqh' }}>For You</span>
        </div>

        {/* right rail */}
        <div style={at(90, 40, { transform: 'translateX(-50%)', ...railCol, gap: '2.6cqh' })}>
          <div
            style={{
              width: '6.4cqh',
              height: '6.4cqh',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              border: '2px solid #fff',
              filter: shadow,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                bottom: '-1.4cqh',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '2.8cqh',
                height: '2.8cqh',
                borderRadius: '50%',
                background: '#fe2c55',
                color: '#fff',
                fontSize: '2cqh',
                lineHeight: '2.6cqh',
                textAlign: 'center',
              }}
            >
              +
            </span>
          </div>
        </div>
        <RailBtn y={52} icon="heart" n="5.1M" size={4} />
        <RailBtn y={61} icon="bubble" n="17.9K" size={3.8} />
        <RailBtn y={70} icon="send" n="Share" size={3.8} />
        <div style={at(90, 80, { transform: 'translateX(-50%)' })}>
          <div
            style={{
              width: '6cqh',
              height: '6cqh',
              borderRadius: '50%',
              background: '#1c1c1c',
              border: '0.7cqh solid #2b2b2b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: shadow,
            }}
          >
            <Svg d={ICON.music} size={2.6} />
          </div>
        </div>

        {/* bottom-left author + caption */}
        <div style={at(3.5, 79, { display: 'flex', flexDirection: 'column', gap: '1.2cqh', maxWidth: '72%' })}>
          <span style={{ ...uname, display: 'flex', alignItems: 'center', gap: '1.2cqw' }}>
            @username
            <Svg d={ICON.verified} size={2.2} fill="#20d5ec" />
          </span>
          <span style={subtxt}>Caption text goes here…</span>
          <span style={{ ...subtxt, display: 'flex', alignItems: 'center', gap: '1cqw' }}>
            <Svg d={ICON.music} size={1.9} /> original sound — artist
          </span>
        </div>

        <NavBar items={['home', 'search', 'plus', 'bubble', 'moreV']} />
      </div>
    )
  }

  // ---- instagram reels ----
  return (
    <div style={wrap} aria-hidden>
      {/* top bar */}
      <div
        style={at(0, 4.5, {
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4cqw',
        })}
      >
        <Svg d={ICON.plus} size={3.4} />
        <span style={{ ...uname, display: 'flex', alignItems: 'center', gap: '1cqw' }}>
          Reels <Svg d={ICON.chevron} size={2.2} />
        </span>
        <span style={{ ...subtxt, opacity: 0.7 }}>Friends</span>
        <Svg d={ICON.sliders} size={3} stroke="#fff" />
      </div>

      {/* right rail */}
      <RailBtn y={45} icon="heart" n="260K" size={3.8} />
      <RailBtn y={53} icon="bubble" n="3,174" size={3.6} />
      <RailBtn y={61} icon="repost" n="12.2K" size={3.6} />
      <RailBtn y={69} icon="send" n="147K" size={3.6} />
      <RailBtn y={77} icon="bookmark" n="15.1K" size={3.6} />
      <RailBtn y={84} icon="moreV" size={3.2} />
      <div style={at(90, 90, { transform: 'translateX(-50%)' })}>
        <div
          style={{
            width: '5cqh',
            height: '5cqh',
            borderRadius: '5px',
            background: 'rgba(255,255,255,0.85)',
            filter: shadow,
          }}
        />
      </div>

      {/* bottom-left author row + caption */}
      <div style={at(3.5, 82, { display: 'flex', alignItems: 'center', gap: '2cqw', maxWidth: '74%' })}>
        <div
          style={{
            width: '5.2cqh',
            height: '5.2cqh',
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid #fe2c8b',
            filter: shadow,
            flexShrink: 0,
          }}
        />
        <span style={{ ...uname, display: 'flex', alignItems: 'center', gap: '1cqw' }}>
          username
          <Svg d={ICON.verified} size={2} fill="#3897f0" />
        </span>
        <span
          style={{
            ...subtxt,
            border: '1px solid rgba(255,255,255,0.85)',
            borderRadius: '7px',
            padding: '0.3cqh 2cqw',
            fontWeight: 600,
          }}
        >
          Follow
        </span>
      </div>
      <div style={at(3.5, 89, { ...subtxt })}>Caption text goes here…</div>

      <NavBar items={['home', 'clip', 'send', 'search', 'heart']} />
    </div>
  )
}
