'use strict';

const Main = imports.ui.main;
const St = imports.gi.St;
const MessageTray = imports.ui.messageTray;

const notificationSource = new MessageTray.SystemNotificationSource();
Main.messageTray.add(notificationSource);

function notify(name, above, below, price, formatPrice, percent, formatPercent, type) {
  const MaxValue = parseFloat(above.replace(',', '.'));
  const MinValue = parseFloat(below.replace(',', '.'));

  if (type === 'money') {
    if (MaxValue && price >= MaxValue) {
      notifyMessage(name, formatPrice, 'go-top');
    }

    if (MinValue && price <= MinValue) {
      notifyMessage(name, formatPrice, 'go-bottom');
    }
  }
  else if (type === 'percentage') {
    if (MaxValue && percent >= MaxValue) {
      notifyMessage(name, formatPercent, 'go-top');
    }

    if (MinValue && percent <= MinValue) {
      notifyMessage(name, formatPercent, 'go-bottom');
    }
  }
}

function notifyMessage(name, message, iconName) {
  const icon = new St.Icon({
    icon_name: iconName,
    icon_type: St.IconType.SYMBOLIC,
  });

  const notification = new MessageTray.Notification(notificationSource, name, message, { icon });

  notification.setTransient(true);
  notificationSource.notify(notification);
}
