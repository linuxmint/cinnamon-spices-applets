const Time = imports.lib.time;

function getStoredLabel(label) {
  return label ? String(label).trim() : "";
}

function getAlarmNotificationBody(alarm) {
  const label = getStoredLabel(alarm && alarm.label);
  return label || Time.formatTime(alarm.due, alarm.showSeconds);
}

var getStoredLabel = getStoredLabel;
var getAlarmNotificationBody = getAlarmNotificationBody;
