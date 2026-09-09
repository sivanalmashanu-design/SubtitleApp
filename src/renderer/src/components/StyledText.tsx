import type { CSSProperties } from 'react'
import type { TextRun, WordStyle } from '@shared/types'
import { textWordLayout, wordFrags } from '@shared/runs'

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
      {words.map((w, i) => {
        const frags = runs.length ? wordFrags(w.from, w.word, runs) : [{ text: w.word }]
        return (
          <span key={i} style={{ display: 'contents' }}>
            {w.br && <span style={{ flexBasis: '100%', height: 0 }} />}
            <span style={{ display: 'inline-block', whiteSpace: 'pre' }}>
              {frags.map((f, fi) => (
                <span key={fi} style={{ display: 'inline-block', ...fragStyle(f.s) }}>
                  {f.text}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
