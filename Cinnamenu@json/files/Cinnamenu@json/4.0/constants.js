// l10n
const Gettext = imports.gettext;

function _(str) {
    let cinnamonTranslation = Gettext.gettext(str);
    if (cinnamonTranslation !== str) {
        return cinnamonTranslation;
    }
    return Gettext.dgettext('Cinnamenu@json', str);
}

const ApplicationType = {
    _applications: 0,
    _places: 1,
    _recent: 2,
    _windows: 3,
    _providers: 4,
    _completions: 5,
};
const AppTypes = Object.keys(ApplicationType);

const stripMarkupRegex = /(<([^>]+)>)/ig;

module.exports = {_, ApplicationType, AppTypes, stripMarkupRegex};

