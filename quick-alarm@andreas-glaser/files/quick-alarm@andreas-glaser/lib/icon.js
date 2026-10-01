/**
 * Resolves an icon setting value into an action the applet should take.
 *
 * @param {boolean} useCustom - Whether the custom icon toggle is on
 * @param {string} value - The icon setting value (file path or theme icon name)
 * @param {object} env - Environment functions for file/theme checks:
 *   @param {function} env.isAbsolutePath - (path) => boolean
 *   @param {function} env.themeLookupIcon - (name) => object|null
 * @returns {{ method: string, value: string }}
 *   method is one of: "symbolic_name", "name", "symbolic_path", "path"
 */
function resolveIcon(useCustom, value, env) {
  var DEFAULT = { method: "symbolic_name", value: "alarm-symbolic" };

  if (!useCustom || !value || value === "") return DEFAULT;

  var isSymbolic = value.indexOf("-symbolic") !== -1;

  if (env.isAbsolutePath(value)) {
    return { method: isSymbolic ? "symbolic_path" : "path", value: value };
  }

  if (env.themeLookupIcon(value)) {
    return { method: isSymbolic ? "symbolic_name" : "name", value: value };
  }

  return DEFAULT;
}

var resolveIcon = resolveIcon;
