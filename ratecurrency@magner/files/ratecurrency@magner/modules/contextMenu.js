// Add update function in the right click context menu
'use strict';

const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;

function buildContextMenu(updateQuoteText, appletContextMenu, callback) {
  const menuitem = new PopupMenu.PopupIconMenuItem(updateQuoteText, 'view-refresh', St.IconType.SYMBOLIC);

  menuitem.connect('activate', () => {
    callback();
  });

  appletContextMenu.addMenuItem(menuitem);
  appletContextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // Separator
}
