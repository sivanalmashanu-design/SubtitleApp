import type { CSSProperties } from 'react'
import type { TextRun, WordStyle } from '@shared/types'
import { textWordLayout, wordFrags } from '@shared/runs'
import { bidiGroups } from '../lib/bidiGroups'

interface Props {
  text: string
  runs?: TextRun[]
  /** per-fragment CSS for a run's overrides (colour, font, size, …) */
  fragStyle: (o: WordStyle | undefined) => CSSProperties
  rtl: boolean
  /** flex alignment of the wrapped words */
  align?: CSSProperties['justifyContent']
}

/** renders a plain text (a card) as wrap-friendly words, each split into
 *  constant-style fragments where `runs` cover part of it */
export function StyledText({ text, runs = [], fragStyle, rtl, align = 'center' }: Props) {
  const words = textWordLayout(text)
  // Hebrew + English: keep consecutive English words together, left-to-right
  const groups = bidiGroups(
    words,
    (w) => w.word,
    (w) => w.br,
    rtl,
  )

  const renderWord = (w: (typeof words)[number], ltr: boolean) => {
    const frags = runs.length ? wordFrags(w.from, w.word, runs) : [{ text: w.word }]
    return (
      <span
        key={w.from}
        style={{
          display: 'inline-block',
          whiteSpace: 'pre',
          ...(ltr ? { direction: 'ltr' as const, unicodeBidi: 'isolate' as const } : {}),
        }}
      >
        {frags.map((f, fi) => (
          <span key={fi} style={{ display: 'inline-block', ...fragStyle(f.s) }}>
            {f.text}
          </span>
        ))}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: align,
        columnGap: '0.28em',
        rowGap: '0.06em',
        direction: rtl ? 'rtl' : 'ltr',
      }}
    >
      {groups.map((g, gi) => (
        <span key={gi} style={{ display: 'contents' }}>
          {g.items[0].br && <span style={{ flexBasis: '100%', height: 0 }} />}
          {g.ltr ? (
            <span
              style={{
                display: 'inline-flex',
                direction: 'ltr',
                unicodeBidi: 'isolate',
                columnGap: '0.28em',
              }}
            >
              {g.items.map((w) => renderWord(w, true))}
            </span>
          ) : (
            renderWord(g.items[0], false)
          )}
        </span>
      ))}
    </span>
  )
}
