export type FontCategory = 'Hebrew' | 'Display' | 'Sans' | 'Rounded' | 'Script' | 'Serif'

export interface FontDef {
  /** family name — used for CSS @font-face, the picker, and ASS FontName */
  name: string
  /** file in resources/fonts */
  file: string
  /** path under expo/google-fonts/font-packages (for scripts/fetch-binaries) */
  remote: string
  /** rough average glyph advance ÷ font size — used to wrap ASS lines to the box */
  widthRatio: number
  category: FontCategory
  /** true if the family includes Hebrew glyphs */
  hebrew?: boolean
}

export const FONTS: FontDef[] = [
  // Hebrew-capable
  { name: 'Heebo', file: 'Heebo.ttf', remote: 'heebo/700Bold/Heebo_700Bold.ttf', widthRatio: 0.56, category: 'Hebrew', hebrew: true },
  { name: 'Assistant', file: 'Assistant.ttf', remote: 'assistant/700Bold/Assistant_700Bold.ttf', widthRatio: 0.54, category: 'Hebrew', hebrew: true },
  { name: 'Secular One', file: 'SecularOne.ttf', remote: 'secular-one/400Regular/SecularOne_400Regular.ttf', widthRatio: 0.55, category: 'Hebrew', hebrew: true },
  { name: 'Suez One', file: 'SuezOne.ttf', remote: 'suez-one/400Regular/SuezOne_400Regular.ttf', widthRatio: 0.6, category: 'Hebrew', hebrew: true },
  { name: 'Karantina', file: 'Karantina.ttf', remote: 'karantina/700Bold/Karantina_700Bold.ttf', widthRatio: 0.42, category: 'Hebrew', hebrew: true },
  { name: 'Alef', file: 'Alef.ttf', remote: 'alef/700Bold/Alef_700Bold.ttf', widthRatio: 0.54, category: 'Hebrew', hebrew: true },
  { name: 'Frank Ruhl Libre', file: 'FrankRuhlLibre.ttf', remote: 'frank-ruhl-libre/700Bold/FrankRuhlLibre_700Bold.ttf', widthRatio: 0.5, category: 'Hebrew', hebrew: true },
  { name: 'Noto Sans Hebrew', file: 'NotoSansHebrew.ttf', remote: 'noto-sans-hebrew/700Bold/NotoSansHebrew_700Bold.ttf', widthRatio: 0.55, category: 'Hebrew', hebrew: true },
  { name: 'Rubik', file: 'Rubik.ttf', remote: 'rubik/700Bold/Rubik_700Bold.ttf', widthRatio: 0.56, category: 'Hebrew', hebrew: true },

  { name: 'Anton', file: 'Anton.ttf', remote: 'anton/400Regular/Anton_400Regular.ttf', widthRatio: 0.42, category: 'Display' },
  { name: 'Bebas Neue', file: 'BebasNeue.ttf', remote: 'bebas-neue/400Regular/BebasNeue_400Regular.ttf', widthRatio: 0.4, category: 'Display' },
  { name: 'Teko', file: 'Teko.ttf', remote: 'teko/700Bold/Teko_700Bold.ttf', widthRatio: 0.4, category: 'Display' },
  { name: 'Oswald', file: 'Oswald.ttf', remote: 'oswald/600SemiBold/Oswald_600SemiBold.ttf', widthRatio: 0.46, category: 'Display' },
  { name: 'Archivo Black', file: 'ArchivoBlack.ttf', remote: 'archivo-black/400Regular/ArchivoBlack_400Regular.ttf', widthRatio: 0.62, category: 'Display' },
  { name: 'Passion One', file: 'PassionOne.ttf', remote: 'passion-one/700Bold/PassionOne_700Bold.ttf', widthRatio: 0.5, category: 'Display' },
  { name: 'Russo One', file: 'RussoOne.ttf', remote: 'russo-one/400Regular/RussoOne_400Regular.ttf', widthRatio: 0.56, category: 'Display' },
  { name: 'Bangers', file: 'Bangers.ttf', remote: 'bangers/400Regular/Bangers_400Regular.ttf', widthRatio: 0.44, category: 'Display' },
  { name: 'Luckiest Guy', file: 'LuckiestGuy.ttf', remote: 'luckiest-guy/400Regular/LuckiestGuy_400Regular.ttf', widthRatio: 0.56, category: 'Display' },
  { name: 'Montserrat', file: 'Montserrat.ttf', remote: 'montserrat/700Bold/Montserrat_700Bold.ttf', widthRatio: 0.6, category: 'Sans' },
  { name: 'Poppins', file: 'Poppins.ttf', remote: 'poppins/700Bold/Poppins_700Bold.ttf', widthRatio: 0.6, category: 'Sans' },
  { name: 'Inter', file: 'Inter.ttf', remote: 'inter/600SemiBold/Inter_600SemiBold.ttf', widthRatio: 0.55, category: 'Sans' },
  { name: 'Roboto', file: 'Roboto.ttf', remote: 'roboto/700Bold/Roboto_700Bold.ttf', widthRatio: 0.54, category: 'Sans' },
  { name: 'Nunito', file: 'Nunito.ttf', remote: 'nunito/800ExtraBold/Nunito_800ExtraBold.ttf', widthRatio: 0.56, category: 'Rounded' },
  { name: 'Baloo 2', file: 'Baloo2.ttf', remote: 'baloo-2/700Bold/Baloo2_700Bold.ttf', widthRatio: 0.55, category: 'Rounded' },
  { name: 'Fredoka', file: 'Fredoka.ttf', remote: 'fredoka/600SemiBold/Fredoka_600SemiBold.ttf', widthRatio: 0.55, category: 'Rounded' },
  { name: 'Caveat', file: 'Caveat.ttf', remote: 'caveat/700Bold/Caveat_700Bold.ttf', widthRatio: 0.4, category: 'Script' },
  { name: 'Permanent Marker', file: 'PermanentMarker.ttf', remote: 'permanent-marker/400Regular/PermanentMarker_400Regular.ttf', widthRatio: 0.5, category: 'Script' },
  { name: 'Shrikhand', file: 'Shrikhand.ttf', remote: 'shrikhand/400Regular/Shrikhand_400Regular.ttf', widthRatio: 0.62, category: 'Script' },
  { name: 'Lobster', file: 'Lobster.ttf', remote: 'lobster/400Regular/Lobster_400Regular.ttf', widthRatio: 0.46, category: 'Script' },
  { name: 'Playfair Display', file: 'PlayfairDisplay.ttf', remote: 'playfair-display/800ExtraBold/PlayfairDisplay_800ExtraBold.ttf', widthRatio: 0.52, category: 'Serif' },
]

/** picker options: the bundled families plus "System" (uses the OS font) */
export const FONT_OPTIONS: string[] = [...FONTS.map((f) => f.name), 'System']

/** average glyph-advance ratio for wrapping; falls back for custom/system fonts */
export function fontWidthRatio(name: string, customRatio = 0.52): number {
  return FONTS.find((f) => f.name === name)?.widthRatio ?? customRatio
}

export const isHebrewFont = (name: string): boolean =>
  !!FONTS.find((f) => f.name === name)?.hebrew
