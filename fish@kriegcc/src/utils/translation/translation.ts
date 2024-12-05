import { UUID } from "consts"

const Gettext = imports.gettext

// translation function
// see: https://www.gnu.org/software/gettext/manual/gettext.html
export function _(text: string): string {
  // look in translation domain first
  const translated = Gettext.dgettext(UUID, text)

  // if it looks translated, return the translation of the domain
  if (translated !== text) {
    return translated
  }

  // else, use the default Cinnamon domain
  return Gettext.gettext(text)
}
