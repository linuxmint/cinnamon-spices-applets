const Gettext = imports.gettext;
module.exports = function t (str) {
  var resultConf = Gettext.dgettext('IcingTaskManager@json', str)
  if (resultConf != str) {
    return resultConf
  }
  return Gettext.gettext(str)
};