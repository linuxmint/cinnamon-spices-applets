var syncHotkey = function ({ keybindingManager, name, accel, onActivate, onError }) {
  if (!keybindingManager || !name) return { added: false };

  try {
    keybindingManager.removeHotKey(name);
  } catch (e) {
    // ignore
  }

  const normalized = (accel || "").trim();
  if (!normalized) return { added: false };

  try {
    keybindingManager.addHotKey(name, normalized, onActivate);
    return { added: true };
  } catch (e) {
    if (onError) onError(e);
    return { added: false, error: e };
  }
};

