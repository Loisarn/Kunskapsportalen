import flagArgentina from 'flag-icons/flags/4x3/ar.svg'
import flagAustralia from 'flag-icons/flags/4x3/au.svg'
import flagBrazil from 'flag-icons/flags/4x3/br.svg'
import flagCanada from 'flag-icons/flags/4x3/ca.svg'
import flagChina from 'flag-icons/flags/4x3/cn.svg'
import flagDenmark from 'flag-icons/flags/4x3/dk.svg'
import flagFinland from 'flag-icons/flags/4x3/fi.svg'
import flagFrance from 'flag-icons/flags/4x3/fr.svg'
import flagGermany from 'flag-icons/flags/4x3/de.svg'
import flagGreece from 'flag-icons/flags/4x3/gr.svg'
import flagIndia from 'flag-icons/flags/4x3/in.svg'
import flagIndonesia from 'flag-icons/flags/4x3/id.svg'
import flagIreland from 'flag-icons/flags/4x3/ie.svg'
import flagIceland from 'flag-icons/flags/4x3/is.svg'
import flagItaly from 'flag-icons/flags/4x3/it.svg'
import flagJapan from 'flag-icons/flags/4x3/jp.svg'
import flagKenya from 'flag-icons/flags/4x3/ke.svg'
import flagMexico from 'flag-icons/flags/4x3/mx.svg'
import flagMonaco from 'flag-icons/flags/4x3/mc.svg'
import flagNetherlands from 'flag-icons/flags/4x3/nl.svg'
import flagNewZealand from 'flag-icons/flags/4x3/nz.svg'
import flagNigeria from 'flag-icons/flags/4x3/ng.svg'
import flagNorway from 'flag-icons/flags/4x3/no.svg'
import flagPoland from 'flag-icons/flags/4x3/pl.svg'
import flagPortugal from 'flag-icons/flags/4x3/pt.svg'
import flagSouthAfrica from 'flag-icons/flags/4x3/za.svg'
import flagSpain from 'flag-icons/flags/4x3/es.svg'
import flagSweden from 'flag-icons/flags/4x3/se.svg'
import flagUnitedKingdom from 'flag-icons/flags/4x3/gb.svg'
import flagUnitedStates from 'flag-icons/flags/4x3/us.svg'
import flagUruguay from 'flag-icons/flags/4x3/uy.svg'

const countryFlags: Record<string, string> = {
  '🇸🇪': flagSweden, '🇳🇴': flagNorway, '🇩🇰': flagDenmark, '🇫🇮': flagFinland, '🇮🇸': flagIceland,
  '🇫🇷': flagFrance, '🇮🇹': flagItaly, '🇩🇪': flagGermany, '🇪🇸': flagSpain, '🇵🇹': flagPortugal,
  '🇯🇵': flagJapan, '🇨🇦': flagCanada, '🇺🇸': flagUnitedStates, '🇬🇧': flagUnitedKingdom,
  '🇬🇷': flagGreece, '🇵🇱': flagPoland, '🇮🇳': flagIndia, '🇿🇦': flagSouthAfrica,
  '🇦🇷': flagArgentina, '🇧🇷': flagBrazil, '🇲🇽': flagMexico, '🇮🇪': flagIreland, '🇦🇺': flagAustralia,
  '🇳🇿': flagNewZealand, '🇺🇾': flagUruguay, '🇨🇳': flagChina, '🇮🇩': flagIndonesia,
  '🇲🇨': flagMonaco, '🇰🇪': flagKenya, '🇳🇬': flagNigeria, '🇳🇱': flagNetherlands,
}
const countryFlagEmojisByName: Record<string, string> = {
  sverige: '🇸🇪', norge: '🇳🇴', danmark: '🇩🇰', finland: '🇫🇮', island: '🇮🇸',
  frankrike: '🇫🇷', italien: '🇮🇹', tyskland: '🇩🇪', spanien: '🇪🇸', portugal: '🇵🇹',
  japan: '🇯🇵', kanada: '🇨🇦', usa: '🇺🇸', storbritannien: '🇬🇧', grekland: '🇬🇷',
  polen: '🇵🇱', indien: '🇮🇳', sydafrika: '🇿🇦', argentina: '🇦🇷', brasilien: '🇧🇷',
  mexiko: '🇲🇽', irland: '🇮🇪', australien: '🇦🇺', 'nya zeeland': '🇳🇿', uruguay: '🇺🇾',
  kina: '🇨🇳', indonesien: '🇮🇩', monaco: '🇲🇨', kenya: '🇰🇪', nigeria: '🇳🇬',
  nederländerna: '🇳🇱', schweiz: '🇨🇭',
}
const flagSequencePattern = /[\u{1F1E6}-\u{1F1FF}]{2}/gu

export function renderFlagText(text: string, showFlags = true, flagsOnly = false) {
  if (!showFlags) return text.replace(flagSequencePattern, '').trim()
  const countryFlag = countryFlagEmojisByName[text.trim().toLocaleLowerCase('sv-SE')]
  const displayText = /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(text) || !countryFlag ? text : `${countryFlag} ${text}`
  const chunks = displayText.split(flagSequencePattern)
  const flags = [...displayText.matchAll(flagSequencePattern)].map(([flag]) => flag)
  if (flagsOnly) {
    const countryName = text.replace(flagSequencePattern, '').trim()
    return flags.flatMap((flag, index) => {
      const flagImage = countryFlags[flag]
      return flagImage
        ? [<img key={`${flag}-${index}`} className="inline-country-flag" src={flagImage} alt={`${countryName} flagga`} />]
        : []
    })
  }
  return chunks.flatMap((chunk, index) => {
    const flag = flags[index]
    const flagImage = flag ? countryFlags[flag] : undefined
    return [
      chunk,
      ...(flag ? [flagImage
        ? <img key={`${flag}-${index}`} className="inline-country-flag" src={flagImage} alt="" aria-hidden="true" />
        : flag] : []),
    ]
  })
}