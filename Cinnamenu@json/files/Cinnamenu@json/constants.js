// l10n
const Gettext = imports.gettext;

function _(str) {
  let cinnamonTranslation = Gettext.gettext(str);
  if (cinnamonTranslation !== str) {
    return cinnamonTranslation;
  }
  return Gettext.dgettext('Cinnamenu@json', str);
}

const REMEMBER_RECENT_KEY = 'remember-recent-files';

const ApplicationType = {
  _applications: 0,
  _places: 1,
  _recent: 2,
  _windows: 3,
  _providers: 4
};
const AppTypes = Object.keys(ApplicationType);

const ApplicationsViewMode = {
  LIST: 0,
  GRID: 1
};

const fuzzyOptions = {
  before: '<b><u>',
  after: '</u></b>'
}

const gridWidths = [0, 240, 340, 498, 644, 725, 840, 980];

const searchThresholds = {
  id: 0.2,
  name: 0.1,
  description: 0.1,
  keywords: 0.2,
  title: 0.2
};

const markdownProps = ['name', 'description'];