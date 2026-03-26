const Gettext = imports.gettext; // for the translations

let localUuid

function initTranslation({uuid, homeDir}) {
  localUuid = uuid
  Gettext.bindtextdomain(uuid, homeDir + "/.local/share/locale");
}

function _(str) {
  return Gettext.dgettext(localUuid, str);
}

module.exports = {_, initTranslation}