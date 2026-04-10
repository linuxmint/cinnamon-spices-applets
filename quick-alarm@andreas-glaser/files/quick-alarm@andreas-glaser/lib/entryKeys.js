var getEntrySubmitIntent = function ({ keySymbol, modifierState, keyReturn, keyKPEnter, controlMask }) {
  const isEnter = keySymbol === keyReturn || keySymbol === keyKPEnter;
  if (!isEnter) return null;
  const hasCtrl = !!(modifierState & controlMask);
  return { closeMenu: !hasCtrl };
};
