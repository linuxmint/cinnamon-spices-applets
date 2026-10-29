// lib/core/theme.js
'use strict';

// 面板主题：PanelThemes.cs / .Build / .Derive / .Files / .Matching + PanelThemeFile.cs + ThemeColor.cs + ColorMath.cs
// 的移植（设置页里的主题【编辑器】Draft/Rename/Template 三块不做）。
// 纯逻辑：不读文件（文件列表与文本由调用方给）、不碰 GI，node 与 cjs 都能直接跑。
//
// 与 C# 的一处系统性差异：C# 的 Math.Round(double) 默认是「取偶」（MidpointRounding.ToEven），
// ThemeColor/ColorMath 全部用它（几何模块用的是 AwayFromZero，别搞混）；所以这里用 roundHalfEven()，
// 而不是 Math.round（后者是 .5 向上）。

// ---------------------------------------------------------------- 常量（PanelThemes.cs:34-35）

var SystemThemeId = 'system';
var DarkThemeId = 'dark';
var LightThemeId = 'light';
var DemoThemeId = 'cyberpunk-edgerunners';

// 对比度下限：正文 4.5、强调文字 7、图形 3、指示条 2
var TextContrast = 4.5;
var StrongTextContrast = 7;
var GraphicContrast = 3;
var IndicatorContrast = 2;

// 颜色该对哪些底色达标（PanelThemes.cs:12）
var PanelThemeBackdrop = {
  None: 'none',
  Surface: 'surface',
  SurfaceAndPopup: 'surfaceAndPopup',
  Accent: 'accent',
  Indicator: 'indicator'
};

// 全部颜色键、各自的最低对比度与底色（PanelThemes.cs:37-77，顺序即处理顺序，不能乱：
// onAccent 用到的 accent 必须先被校正过）
var PanelTokens = [
  { key: 'surface', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'textPrimary', minimum: StrongTextContrast, against: PanelThemeBackdrop.SurfaceAndPopup },
  { key: 'textSecondary', minimum: TextContrast, against: PanelThemeBackdrop.SurfaceAndPopup },
  { key: 'textTertiary', minimum: GraphicContrast, against: PanelThemeBackdrop.SurfaceAndPopup },
  { key: 'accent', minimum: GraphicContrast, against: PanelThemeBackdrop.SurfaceAndPopup },
  { key: 'onAccent', minimum: GraphicContrast, against: PanelThemeBackdrop.Accent },
  { key: 'danger', minimum: TextContrast, against: PanelThemeBackdrop.SurfaceAndPopup },
  { key: 'liked', minimum: GraphicContrast, against: PanelThemeBackdrop.Surface },
  { key: 'clock', minimum: TextContrast, against: PanelThemeBackdrop.Surface },
  { key: 'equalizer', minimum: GraphicContrast, against: PanelThemeBackdrop.Surface },
  { key: 'hairline', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'track', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'ringTrack', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'fill', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'fillSelected', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'hover', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'pressed', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'outline', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'popup', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'popupBorder', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'input', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'rangeFill', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'coverPlaceholder', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'coverOutline', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'scrollThumb', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'rim', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'shadow', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'indicator', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'indicatorProgress', minimum: IndicatorContrast, against: PanelThemeBackdrop.Indicator },
  { key: 'switchFill', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'seekRail', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'rowDivider', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'rowHover', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'menuDetail', minimum: GraphicContrast, against: PanelThemeBackdrop.SurfaceAndPopup },
  { key: 'tooltip', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'tooltipBorder', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'bubble', minimum: 0, against: PanelThemeBackdrop.None },
  { key: 'bubbleBorder', minimum: 0, against: PanelThemeBackdrop.None }
];

// "apps" 里认得的键（PanelThemes.cs:79）；手工填的源共用 "manual"
var AppKeys = ['claude', 'codex', 'antigravity', 'cursor', 'zcode', 'dsh', 'grokBot', 'kimi', 'manual', 'other', 'warning', 'critical'];

// 上游 AppPresets（Settings.cs:132-147）：深色主题写全了每个源，其余主题都从它继承。
// zcode 的 #3A538D 是「保存值」，dark.json 里写的是为了在黑底上读得清而调亮的 #4A64A6。
var AppPresets = {
  claude: '#E5A385',
  codex: '#98DBB0',
  antigravity: '#9CB9FF',
  cursor: '#D4D5DF',
  zcode: '#3A538D',
  dsh: '#6081DA',
  grokBot: '#D4D5DF',
  kimi: '#68CDEB',
  manual: '#CC9EED',
  other: '#D4D5DF',
  warning: '#E5C890',
  critical: '#E78284'
};

// 内置主题的展示顺序（PanelThemes.cs:111）：深/浅 → 移植的编辑器主题 → 自定义示例
var BuiltInOrder = [DarkThemeId, LightThemeId, 'one-dark-pro', 'github-dark', 'github-light', 'dracula', 'night-owl', DemoThemeId];

// 时钟的九种样式（Settings.cs:49）与主题文件里能写的颜色名（Matching.cs:194-198）
var ClockStyles = ['minimal', 'stacked', 'digits', 'dots', 'segment', 'neon', 'serif', 'wide', 'condensed'];
var ClockSwatchKeys = ['amber', 'cyan', 'pink', 'lime'];
var ClockColorNames = ['default', 'white', 'amber', 'cyan', 'pink', 'lime', 'custom', 'gradient', 'cover'];

// 数值效果的取值范围与默认值（Build.cs:138-142）
var EffectRanges = {
  rimWidth: { min: 0, max: 3, fallback: 1 },
  shadowBlur: { min: 0, max: 40, fallback: 14 },
  shadowDepth: { min: 0, max: 12, fallback: 4 },
  shadowOpacity: { min: 0, max: 1, fallback: 0.28 },
  scanlines: { min: 0, max: 0.12, fallback: 0 }
};

// 对比度扫描的步数（ThemeColor.cs:92）
var LIGHTNESS_STEPS = 256;

// ---------------------------------------------------------------- 颜色基础

var BLACK = { r: 0, g: 0, b: 0, a: 255 };
var WHITE = { r: 255, g: 255, b: 255, a: 255 };

// WCAG 的 sRGB 线性值，256 个档（ThemeColor.cs:94-98）
var LINEAR = (function () {
  var table = new Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return table;
})();

// C# Math.Round(double) 的默认行为：.5 取偶（2.5→2、3.5→4）。负数用 floor 也成立（-2.5→-2、-3.5→-4）。
function roundHalfEven(x) {
  var floor = Math.floor(x);
  var diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

// (byte)Math.Round(Clamp(v,0,1) * 255)
function byte(value) {
  var v = value < 0 ? 0 : value > 1 ? 1 : value;
  var scaled = roundHalfEven(v * 255);
  return scaled < 0 ? 0 : scaled > 255 ? 255 : scaled;
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

var HEX_ONLY = /^[0-9a-fA-F]+$/;

// ThemeColor.TryParse：'#RRGGBB' 或 '#AARRGGBB'（# 可省），不合格返回 null。
// 返回 {r,g,b,a}，a 缺省 255。
function parseColor(value) {
  var text = value === null || value === undefined ? '' : String(value).trim();
  if (text.charAt(0) === '#') text = text.slice(1);
  if (text.length !== 6 && text.length !== 8) return null;
  if (!HEX_ONLY.test(text)) return null;
  var number = parseInt(text, 16);
  if (text.length === 6) number = number + 0xff000000; // 用 + 而不是 |=：JS 的位运算会先转成 int32
  return {
    r: (number >>> 16) & 0xff,
    g: (number >>> 8) & 0xff,
    b: number & 0xff,
    a: (number >>> 24) & 0xff
  };
}

function hexPair(value) {
  var text = value.toString(16).toUpperCase();
  return text.length === 1 ? '0' + text : text;
}

// ThemeColor.ToString：不透明的用短写法，手写的调色板读回来一样
function formatColor(color) {
  if (!color) return '';
  var alpha = color.a === undefined ? 255 : color.a;
  var rgb = '#' + hexPair(color.r) + hexPair(color.g) + hexPair(color.b);
  return alpha === 255 ? rgb : '#' + hexPair(alpha) + rgb.slice(1);
}

function withAlpha(color, alpha) {
  return { r: color.r, g: color.g, b: color.b, a: alpha };
}

// ThemeColor.Opaque：变成不透明，仍是字符串
function opaqueColor(value) {
  var color = typeof value === 'string' ? parseColor(value) : value;
  return color ? formatColor(withAlpha(color, 255)) : '';
}

function cloneColor(color) {
  return { r: color.r, g: color.g, b: color.b, a: color.a === undefined ? 255 : color.a };
}

// 吃字符串（#RRGGBB / #AARRGGBB）或 {r,g,b,a}，认不出来给 null。
// 调色板与主题文件两种形态都能进 toPalette / enforceContrast，就是靠它。
function asColor(value) {
  if (!value) return null;
  if (typeof value === 'string') return parseColor(value);
  if (typeof value === 'object' && typeof value.r === 'number' && typeof value.g === 'number' && typeof value.b === 'number') {
    return cloneColor(value);
  }
  return null;
}

// Clutter/St 的 CSS 不认 #AARRGGBB（它的 8 位写法是 #RRGGBBAA，而且 St 主题里更稳的是 rgba()）。
// deck 层要往 set_style 里塞颜色时用这个，别把 formatColor 的结果直接塞进 CSS。
function cssColor(value) {
  var color = asColor(value);
  if (!color) return '';
  var alpha = color.a === undefined ? 255 : color.a;
  return 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + roundHalfEven(alpha / 255 * 1000) / 1000 + ')';
}

function sameColor(first, second) {
  if (!first || !second) return first === second;
  return first.r === second.r && first.g === second.g && first.b === second.b &&
    (first.a === undefined ? 255 : first.a) === (second.a === undefined ? 255 : second.a);
}

// ThemeColor.Over：叠在不透明底色上（ThemeColor.cs:120-126）
function over(top, bottom) {
  if (!top) return cloneColor(bottom || BLACK);
  var base = bottom || BLACK;
  if ((top.a === undefined ? 255 : top.a) === 255) return cloneColor(top);
  var alpha = top.a / 255;
  function blend(t, b) {
    return roundHalfEven(t * alpha + b * (1 - alpha));
  }
  return { r: blend(top.r, base.r), g: blend(top.g, base.g), b: blend(top.b, base.b), a: 255 };
}

function luminance(color) {
  return 0.2126 * LINEAR[color.r] + 0.7152 * LINEAR[color.g] + 0.0722 * LINEAR[color.b];
}

// ThemeColor.Contrast：前景先叠到底色上，再把底色叠到黑上（两处都不透明），取两个相对亮度的比
function contrast(foreground, background) {
  var bottom = over(background || BLACK, BLACK);
  var front = luminance(over(foreground, bottom));
  var back = luminance(bottom);
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

function minimumContrast(color, backgrounds) {
  if (!backgrounds || backgrounds.length === 0) return 21;
  var lowest = Infinity;
  for (var i = 0; i < backgrounds.length; i++) lowest = Math.min(lowest, contrast(color, backgrounds[i]));
  return lowest;
}

// needs: [{background, minimum}]；返回「最差一项的相对余量」，≥1 表示全部达标（ThemeColor.cs:152-157）
function contrastScore(color, needs) {
  var lowest = Infinity;
  var list = needs || [];
  for (var i = 0; i < list.length; i++) lowest = Math.min(lowest, contrast(color, list[i].background) / list[i].minimum);
  return lowest;
}

// ThemeColor.ToHsl（ThemeColor.cs:204-212）
function toHsl(color) {
  var r = color.r / 255;
  var g = color.g / 255;
  var b = color.b / 255;
  var max = Math.max(r, Math.max(g, b));
  var min = Math.min(r, Math.min(g, b));
  var d = max - min;
  var l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: l };
  var s = d / (1 - Math.abs(2 * l - 1));
  var h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: clamp01(s), l: l };
}

// ThemeColor.FromHsl（ThemeColor.cs:213-220）
function fromHsl(h, s, l, alpha) {
  var light = clamp01(l);
  var sat = clamp01(s);
  var hue = (h % 360 + 360) % 360;
  var c = (1 - Math.abs(2 * light - 1)) * sat;
  var x = c * (1 - Math.abs(hue / 60 % 2 - 1));
  var m = light - c / 2;
  var rgb;
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: byte(rgb[0] + m), g: byte(rgb[1] + m), b: byte(rgb[2] + m), a: alpha === undefined ? 255 : alpha };
}

// ColorMath.ToHsv / FromHsv（ColorMath.cs:41-60），给设置里的取色器用
function toHsv(color) {
  var r = color.r / 255;
  var g = color.g / 255;
  var b = color.b / 255;
  var max = Math.max(r, Math.max(g, b));
  var min = Math.min(r, Math.min(g, b));
  var d = max - min;
  var h = d === 0 ? 0 : max === r ? 60 * ((g - b) / d % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: h < 0 ? h + 360 : h, s: max === 0 ? 0 : d / max, v: max };
}

function fromHsv(h, s, v) {
  var hue = (h % 360 + 360) % 360;
  var sat = clamp01(s);
  var val = clamp01(v);
  var c = val * sat;
  var x = c * (1 - Math.abs(hue / 60 % 2 - 1));
  var m = val - c;
  var rgb;
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: byte(rgb[0] + m), g: byte(rgb[1] + m), b: byte(rgb[2] + m), a: 255 };
}

// ColorMath.Distance：两个 #RRGGBB 在 RGB 里的直线距离（0..约 441）
function distance(first, second) {
  var a = typeof first === 'string' ? parseColor(first) : first;
  var b = typeof second === 'string' ? parseColor(second) : second;
  if (!a || !b) return 0;
  var sum = Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2);
  return Math.sqrt(sum);
}

// ColorMath.Mix：逐通道按份额取色，返回 #RRGGBB（不含 alpha），取整是 C# 的默认「取偶」
function mix(from, to, share) {
  var a = typeof from === 'string' ? parseColor(from) : from;
  var b = typeof to === 'string' ? parseColor(to) : to;
  if (!a || !b) return '';
  var t = clamp01(Number.isFinite(share) ? share : 0);
  function at(x, y) {
    return roundHalfEven(x + (y - x) * t);
  }
  return '#' + hexPair(at(a.r, b.r)) + hexPair(at(a.g, b.g)) + hexPair(at(a.b, b.b));
}

// ThemeColor.Mix：四个通道（含 alpha）一起插值（ThemeColor.cs:128-133）
function mixColors(from, to, amount) {
  var t = clamp01(amount);
  function at(x, y) {
    return roundHalfEven(x + (y - x) * t);
  }
  return {
    r: at(from.r, to.r),
    g: at(from.g, to.g),
    b: at(from.b, to.b),
    a: at(from.a === undefined ? 255 : from.a, to.a === undefined ? 255 : to.a)
  };
}

// ThemeColor.EnsureContrast（ThemeColor.cs:164-198）：同色相、同饱和度里离原色最近且满足全部要求的颜色。
// 已经达标的原样返回，所以「本来就好读」的主题完全按设计稿显示。
function ensureContrast(color, needs) {
  var list = needs || [];
  if (list.length === 0 || contrastScore(color, list) >= 1) return color;
  var base = toHsl(over(color, over(list[0].background, BLACK)));
  function passes(lightness) {
    return contrastScore(fromHsl(base.h, base.s, lightness), list) >= 1;
  }
  var best = null;
  var directions = [1, -1];
  for (var d = 0; d < directions.length; d++) {
    var direction = directions[d];
    for (var i = 1; i <= LIGHTNESS_STEPS; i++) {
      var at = clamp01(base.l + direction * i / LIGHTNESS_STEPS);
      if (passes(at)) {
        // 在上一个失败点和这个点之间再二分 12 次
        var fail = base.l + direction * (i - 1) / LIGHTNESS_STEPS;
        var pass = at;
        for (var k = 0; k < 12; k++) {
          var mid = (fail + pass) / 2;
          if (passes(mid)) pass = mid;
          else fail = mid;
        }
        if (best === null || Math.abs(pass - base.l) < Math.abs(best - base.l)) best = pass;
        break;
      }
      if (at === 0 || at === 1) break;
    }
  }
  if (best !== null) return fromHsl(base.h, base.s, best);
  // 没有明度能同时满足（底色既有亮又有暗）：取最差项表现最好的明度，但不会比原色更差
  var top = contrastScore(color, list);
  var lightness = NaN;
  for (var j = 0; j <= LIGHTNESS_STEPS; j++) {
    var score = contrastScore(fromHsl(base.h, base.s, j / LIGHTNESS_STEPS), list);
    if (score > top) {
      top = score;
      lightness = j / LIGHTNESS_STEPS;
    }
  }
  return Number.isNaN(lightness) ? color : fromHsl(base.h, base.s, lightness);
}

// ---------------------------------------------------------------- JSON 宽容解析

function has(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

// 剥掉 // 与 /* */ 注释。必须跳过字符串内部：主题的 "homepage" 里就有 https://…（见 dracula.json）。
function stripComments(source) {
  var out = '';
  var index = 0;
  var length = source.length;
  var quote = null;
  while (index < length) {
    var ch = source.charAt(index);
    if (quote) {
      out += ch;
      if (ch === '\\' && index + 1 < length) {
        out += source.charAt(index + 1);
        index += 2;
        continue;
      }
      if (ch === quote) quote = null;
      index += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      index += 1;
      continue;
    }
    if (ch === '/' && source.charAt(index + 1) === '/') {
      while (index < length && source.charAt(index) !== '\n') index += 1;
      continue;
    }
    if (ch === '/' && source.charAt(index + 1) === '*') {
      index += 2;
      while (index < length && !(source.charAt(index) === '*' && source.charAt(index + 1) === '/')) index += 1;
      index += 2;
      continue;
    }
    out += ch;
    index += 1;
  }
  return out;
}

// 去掉 ] 与 } 前面的逗号（同样跳过字符串内部）
function stripTrailingCommas(source) {
  var out = '';
  var index = 0;
  var length = source.length;
  var quote = null;
  while (index < length) {
    var ch = source.charAt(index);
    if (quote) {
      out += ch;
      if (ch === '\\' && index + 1 < length) {
        out += source.charAt(index + 1);
        index += 2;
        continue;
      }
      if (ch === quote) quote = null;
      index += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      index += 1;
      continue;
    }
    if (ch === ',') {
      var look = index + 1;
      while (look < length && /\s/.test(source.charAt(look))) look += 1;
      var next = source.charAt(look);
      if (next === '}' || next === ']') {
        index += 1; // 丢掉这个逗号
        continue;
      }
    }
    out += ch;
    index += 1;
  }
  return out;
}

// 属性名大小写不敏感（上游 PropertyNameCaseInsensitive = true），未知属性直接忽略
function lowerKeys(raw) {
  var map = {};
  if (!raw || typeof raw !== 'object') return map;
  for (var key in raw) {
    if (has(raw, key)) map[key.toLowerCase()] = raw[key];
  }
  return map;
}

function stringOr(value) {
  return typeof value === 'string' ? value : '';
}

function wholeNumberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringListOrNull(value) {
  if (!Array.isArray(value)) return null;
  return value.map(stringOr);
}

// 颜色字典。strict（解析主题文件时）要求值必须是字符串：上游反序列化 Dictionary<string,string>，
// null 与数字都会炸。宽松模式（合并 resove 的输入）允许直接吃 {r,g,b,a}，省得调用方自己转。
function colorMapOf(raw, strict) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  var map = {};
  for (var key in raw) {
    if (!has(raw, key)) continue;
    var value = raw[key];
    if (value === null) {
      if (strict !== false) throw new Error('颜色值不能为 null（颜色项“' + key + '”）');
      continue;
    }
    if (typeof value === 'string') {
      map[key] = value;
      continue;
    }
    if (strict !== false) throw new Error('颜色项“' + key + '”的值必须是字符串');
    var color = asColor(value);
    if (color) map[key] = formatColor(color);
  }
  return map;
}

function effectsOf(raw) {
  var map = lowerKeys(raw);
  var surfaceGradient = stringListOrNull(map.surfacegradient);
  var rimGradient = stringListOrNull(map.rimgradient);
  if (hasNull(surfaceGradient) || hasNull(rimGradient)) throw new Error('颜色值不能为 null（效果里的渐变）');
  return {
    surfaceGradient: surfaceGradient,
    rimGradient: rimGradient,
    rimWidth: numberOrNull(map.rimwidth),
    shadowBlur: numberOrNull(map.shadowblur),
    shadowDepth: numberOrNull(map.shadowdepth),
    shadowOpacity: numberOrNull(map.shadowopacity),
    scanlines: numberOrNull(map.scanlines)
  };
}

function hasNull(list) {
  if (!list) return false;
  for (var i = 0; i < list.length; i++) if (list[i] === null) return true;
  return false;
}

function clockOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  var map = lowerKeys(raw);
  var gradient = stringListOrNull(map.gradient);
  var gradients = null;
  if (Array.isArray(map.gradients)) {
    gradients = map.gradients.map(function (entry) {
      var item = lowerKeys(entry);
      return { name: stringOr(item.name), nameEn: stringOr(item.nameen), stops: stringListOrNull(item.stops) || [] };
    });
  }
  return {
    style: stringOr(map.style),
    color: stringOr(map.color),
    custom: stringOr(map.custom),
    gradient: gradient,
    palette: colorMapOf(map.palette),
    gradients: gradients
  };
}

// PanelThemeFile 的默认值（PanelThemeFile.cs:160-181）：缺的字段按上游默认填
function fileOf(raw, strict) {
  var map = lowerKeys(raw);
  return {
    formatVersion: wholeNumberOr(map.formatversion, 1),
    id: stringOr(map.id),
    name: stringOr(map.name),
    nameEn: stringOr(map.nameen),
    description: stringOr(map.description),
    descriptionEn: stringOr(map.descriptionen),
    author: stringOr(map.author),
    license: stringOr(map.license),
    homepage: stringOr(map.homepage),
    base: stringOr(map.base),
    colors: colorMapOf(map.colors, strict),
    apps: colorMapOf(map.apps, strict),
    effects: effectsOf(map.effects),
    clock: clockOf(map.clock),
    swatches: stringListOrNull(map.swatches)
  };
}

function blankFile() {
  return fileOf({});
}

// resolve/toPalette 的输入可能是主题文件、合并结果，或 lib/deck/store.js 那边的原始 JSON
// （键没归一、缺字段、颜色已经是 {r,g,b,a}）。fileOf 对这些形态是幂等的，统一先过一遍；
// strict = false 才允许非字符串颜色（解析真正的外部文件时仍然严格）。
function asFile(value) {
  return value && typeof value === 'object' ? fileOf(value, false) : blankFile();
}

// PanelThemes.Parse（PanelThemes.cs:95-105）：允许 // 注释与尾逗号，不许颜色为 null。
// 先用「只剥注释」的文本试，失败再收紧（再删尾逗号）；两轮都失败才算真的坏文件 —— 不用 eval。
function parseTheme(text) {
  var source = plainText(text);
  var raw;
  try {
    raw = JSON.parse(stripComments(source));
  } catch (first) {
    try {
      raw = JSON.parse(stripTrailingCommas(stripComments(source)));
    } catch (second) {
      throw new Error('主题文件不是合法 JSON（已跳过注释与尾逗号）：' + second.message);
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('主题文件不是 JSON 对象');
  return fileOf(raw);
}

// 上游的 .Trim() 也会去掉 BOM 之外的空白；顺带去 BOM，免得分不清「文件坏了」和「编辑器加了 BOM」
function plainText(value) {
  var text = value === null || value === undefined ? '' : String(value);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeId(id) {
  var text = String(id === null || id === undefined ? '' : id).trim().toLowerCase();
  text = text.replace(/[^a-z0-9._-]+/g, '-');
  // C# 的 Trim('-', '.')：两端都去掉这两类字符
  var start = 0;
  var end = text.length;
  while (start < end && (text.charAt(start) === '-' || text.charAt(start) === '.')) start += 1;
  while (end > start && (text.charAt(end - 1) === '-' || text.charAt(end - 1) === '.')) end -= 1;
  text = text.slice(start, end);
  return text.length > 64 ? text.slice(0, 64) : text;
}

// ---------------------------------------------------------------- 合并（base 继承）

function sameText(first, second) {
  return String(first).toLowerCase() === String(second).toLowerCase();
}

function containsText(list, value) {
  for (var i = 0; i < list.length; i++) if (sameText(list[i], value)) return true;
  return false;
}

function canonicalColorKey(key) {
  for (var i = 0; i < PanelTokens.length; i++) if (sameText(PanelTokens[i].key, key)) return PanelTokens[i].key;
  return key;
}

function canonicalAppKey(key) {
  for (var i = 0; i < AppKeys.length; i++) if (sameText(AppKeys[i], key)) return AppKeys[i];
  return key;
}

function mergeKeys(lower, upper, canonical) {
  var out = {};
  var key;
  var low = lower || {};
  var up = upper || {};
  for (key in low) if (has(low, key)) out[canonical(key)] = low[key];
  for (key in up) if (has(up, key)) out[canonical(key)] = up[key];
  return out;
}

function mergeEffects(lower, upper) {
  var lo = lower || effectsOf(null);
  var up = upper || effectsOf(null);
  return {
    surfaceGradient: up.surfaceGradient ? up.surfaceGradient.slice() : lo.surfaceGradient ? lo.surfaceGradient.slice() : null,
    rimGradient: up.rimGradient ? up.rimGradient.slice() : lo.rimGradient ? lo.rimGradient.slice() : null,
    rimWidth: up.rimWidth !== null ? up.rimWidth : lo.rimWidth,
    shadowBlur: up.shadowBlur !== null ? up.shadowBlur : lo.shadowBlur,
    shadowDepth: up.shadowDepth !== null ? up.shadowDepth : lo.shadowDepth,
    shadowOpacity: up.shadowOpacity !== null ? up.shadowOpacity : lo.shadowOpacity,
    scanlines: up.scanlines !== null ? up.scanlines : lo.scanlines
  };
}

function emptyClock() {
  return { style: '', color: '', custom: '', gradient: null, palette: null, gradients: null };
}

function mergeClockPalette(lower, upper) {
  if (!upper) return lower || null;
  var out = {};
  var key;
  var low = lower || {};
  for (key in low) if (has(low, key)) out[key.toLowerCase()] = low[key];
  for (key in upper) if (has(upper, key)) out[key.toLowerCase()] = opaqueColor(upper[key]);
  return out;
}

// Build.cs:104-113：字段逐个合并，颜色统一存成不透明的 #RRGGBB
function mergeClock(lower, upper) {
  var base = lower || emptyClock();
  var own = upper || emptyClock();
  var gradients = null;
  if (own.gradients) {
    gradients = own.gradients.map(function (gradient) {
      return {
        name: gradient.name,
        nameEn: gradient.nameEn,
        stops: (gradient.stops || []).map(opaqueColor)
      };
    });
  } else if (base.gradients) {
    gradients = base.gradients;
  }
  return {
    style: own.style.length > 0 ? own.style : base.style,
    color: own.color.length > 0 ? own.color : base.color,
    custom: own.custom.length > 0 ? opaqueColor(own.custom) : base.custom,
    gradient: own.gradient ? own.gradient.map(opaqueColor) : base.gradient ? base.gradient : null,
    palette: mergeClockPalette(base.palette, own.palette),
    gradients: gradients
  };
}

// 时钟层的合法性（Files.cs:171-186）。不合法的一层整个跳过（Build.cs:32），所以这里要有。
function clockProblem(clock) {
  if (!clock) return null;
  if (clock.style.length > 0 && !containsText(ClockStyles, clock.style)) return '未知的时间样式“' + clock.style + '”';
  if (clock.color.length > 0 && !containsText(ClockColorNames, clock.color)) return '未知的时间颜色“' + clock.color + '”';
  if (clock.custom.length > 0 && !parseColor(clock.custom)) return '时间自定义颜色“' + clock.custom + '”无效';
  if (clock.gradient) {
    if (clock.gradient.length !== 3) return '时间渐变必须正好是三个有效颜色';
    for (var i = 0; i < clock.gradient.length; i++) if (!parseColor(clock.gradient[i])) return '时间渐变必须正好是三个有效颜色';
  }
  if (clock.palette) {
    for (var key in clock.palette) {
      if (!has(clock.palette, key)) continue;
      if (!containsText(ClockSwatchKeys, key)) return '未知的时间预设色“' + key + '”';
      if (!parseColor(clock.palette[key])) return '时间预设色“' + key + '”的值无效';
    }
  }
  if (clock.gradients) {
    if (clock.gradients.length === 0 || clock.gradients.length > 8) return '预设渐变需要一到八组';
    for (var g = 0; g < clock.gradients.length; g++) {
      var stops = clock.gradients[g].stops || [];
      if (stops.length !== 3) return '每组渐变正好三个有效颜色';
      for (var s = 0; s < stops.length; s++) if (!parseColor(stops[s])) return '每组渐变正好三个有效颜色';
    }
  }
  return null;
}

// 把一层的主题叠到 base 上：缺的键从 base 取（上游 Build 的合并顺序）。
// swatches 是唯一的例外：上游明说不继承（PanelThemeFile.cs:178-180），没写就用调色板自己派生。
function resolve(base, override) {
  var lowerFile = asFile(base);
  var upperFile = asFile(override);
  var clock = lowerFile.clock;
  if (upperFile.clock && clockProblem(upperFile.clock) === null) clock = mergeClock(clock, upperFile.clock);
  return {
    formatVersion: upperFile.formatVersion !== 1 ? upperFile.formatVersion : lowerFile.formatVersion,
    id: upperFile.id,
    name: upperFile.name,
    nameEn: upperFile.nameEn,
    description: upperFile.description,
    descriptionEn: upperFile.descriptionEn,
    author: upperFile.author,
    license: upperFile.license,
    homepage: upperFile.homepage,
    base: upperFile.base,
    colors: mergeKeys(lowerFile.colors, upperFile.colors, canonicalColorKey),
    apps: mergeKeys(lowerFile.apps, upperFile.apps, canonicalAppKey),
    effects: mergeEffects(lowerFile.effects, upperFile.effects),
    clock: clock,
    swatches: upperFile.swatches ? upperFile.swatches.slice() : null
  };
}

// ---------------------------------------------------------------- 内置主题集合

function idFromName(value) {
  var name = String(value === null || value === undefined ? '' : value);
  var slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  if (slash >= 0) name = name.slice(slash + 1);
  if (/\.json$/i.test(name)) name = name.slice(0, -5);
  return normalizeId(name);
}

// 调用方给的「文件列表」可能是 [{id, text}]、[[id, text]]、[text] 或 {id: text}，都收
function themeEntries(entries) {
  var list = [];
  if (!entries) return list;
  if (Array.isArray(entries)) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (typeof entry === 'string') {
        list.push({ id: '', text: entry });
      } else if (Array.isArray(entry)) {
        list.push({ id: stringOr(entry[0]), text: stringOr(entry[1]) });
      } else if (entry && typeof entry === 'object') {
        list.push({
          id: stringOr(entry.id !== undefined ? entry.id : entry.name !== undefined ? entry.name : entry.path),
          text: stringOr(entry.text !== undefined ? entry.text : entry.json !== undefined ? entry.json : entry.content)
        });
      }
    }
    return list;
  }
  if (typeof entries === 'object') {
    for (var key in entries) if (has(entries, key)) list.push({ id: key, text: stringOr(entries[key]) });
  }
  return list;
}

function builtInOrderIndex(id) {
  for (var i = 0; i < BuiltInOrder.length; i++) if (BuiltInOrder[i] === id) return i;
  return Infinity;
}

function compareIds(first, second) {
  var a = builtInOrderIndex(first);
  var b = builtInOrderIndex(second);
  if (a !== b) return a < b ? -1 : 1;
  return first < second ? -1 : first > second ? 1 : 0;
}

// Build.cs:86-100：从深色主题一路到文件本身的链，长度上限挡循环继承
function baseChain(files, id) {
  var chain = [files[id]];
  var baseId = files[id] ? normalizeId(files[id].base) : DarkThemeId;
  var guard = 0;
  while (chain.length <= 8 && guard < 32) {
    guard += 1;
    if (!baseId) baseId = DarkThemeId;
    var parent = files[baseId];
    if (!parent) break;
    if (chain.indexOf(parent) >= 0) break;
    chain.push(parent);
    if (baseId === DarkThemeId) break;
    baseId = normalizeId(parent.base);
  }
  chain.reverse();
  return chain;
}

function resolveChain(files, id) {
  var chain = baseChain(files, id);
  var merged = null;
  for (var i = 0; i < chain.length; i++) merged = resolve(merged, chain[i]);
  return merged;
}

// 内置主题：解析 + base 继承合并。这里不做对比度校正（那是 enforceContrast 的事），
// 所以「一个主题最终长什么样」要看 toPalette + enforceContrast 两段。
// id 取文件里写的 id（Files.cs:103 对用户文件就是这么做的），文件没写才用调用方给的名字；
// 八套内置主题的 id 与文件名本来就相等（PanelThemes.cs:107-108 用测试钉住这一点），两种取法结果相同。
// 返回 { order: [id…], themes: {id: 合并好的主题文件}, files: {id: 原始文件}, errors: [{id, message}] }
function builtinThemes(entries) {
  var list = themeEntries(entries);
  var files = {};
  var errors = [];
  var index = [];
  for (var i = 0; i < list.length; i++) {
    var id = normalizeId(list[i].id);
    var file;
    try {
      file = parseTheme(list[i].text);
    } catch (error) {
      errors.push({ id: id, message: error.message });
      continue;
    }
    if (normalizeId(file.id)) id = normalizeId(file.id);
    if (!id) {
      errors.push({ id: '', message: '缺少主题 ID' });
      continue;
    }
    if (!file.id) file.id = id;
    files[id] = file;
    index.push(id);
  }
  index.sort(compareIds);
  var themes = {};
  var order = [];
  for (var j = 0; j < index.length; j++) {
    order.push(index[j]);
    themes[index[j]] = resolveChain(files, index[j]);
  }
  return { order: order, themes: themes, files: files, errors: errors };
}

// ---------------------------------------------------------------- 调色板

function fillTokens(colors) {
  for (var i = 0; i < PanelTokens.length; i++) {
    var key = PanelTokens[i].key;
    if (!has(colors, key)) colors[key] = cloneColor(key === 'surface' ? BLACK : WHITE);
  }
  return colors;
}

// 效果里的渐变：解析、丢掉坏值、最多八段；少于两段当没有（Build.cs:126-134、:165）
function gradientStops(values) {
  var list = [];
  if (!values) return list;
  for (var i = 0; i < values.length && list.length < 8; i++) {
    var color = parseColor(values[i]);
    if (color) list.push(color);
  }
  return list;
}

function fitEffect(value, range) {
  return value !== null && Number.isFinite(value)
    ? (value < range.min ? range.min : value > range.max ? range.max : value)
    : range.fallback;
}

function effectValues(effects) {
  var source = effects || effectsOf(null);
  var surfaceGradient = gradientStops(source.surfaceGradient);
  var rimGradient = gradientStops(source.rimGradient);
  var values = {
    surfaceGradient: surfaceGradient.length >= 2 ? surfaceGradient : [],
    rimGradient: rimGradient.length >= 2 ? rimGradient : []
  };
  for (var key in EffectRanges) {
    if (has(EffectRanges, key)) values[key] = fitEffect(source[key], EffectRanges[key]);
  }
  return values;
}

function averageLuminance(stops) {
  var sum = 0;
  for (var i = 0; i < stops.length; i++) sum += luminance(stops[i]);
  return stops.length === 0 ? 0 : sum / stops.length;
}

// 合并好的主题文件 → 可直接绘制的调色板（Build.cs:20-46 的前半段）：
// 颜色转成 {r,g,b,a}、补全缺项、把半透明的表面压到不透明、效果夹进范围。
// 对比度校正不在这里，见 enforceContrast。
function toPalette(file) {
  var theme = file || blankFile();
  var colors = {};
  var key;
  var raw = theme.colors || {};
  for (key in raw) if (has(raw, key)) {
    var color = asColor(raw[key]);
    if (color) colors[canonicalColorKey(key)] = color;
  }
  fillTokens(colors);
  var writtenColors = {};
  for (key in colors) if (has(colors, key)) writtenColors[key] = cloneColor(colors[key]);
  // 表面按不透明画：半透明的表面会让桌面透到文字后面。
  // tooltip 是独立窗口、seek 气泡浮在歌词和时间上，所以两者按「叠在表面上」的结果画（Build.cs:39-43）
  var surface = over(colors.surface, BLACK);
  colors.surface = surface;
  colors.tooltip = over(colors.tooltip, surface);
  colors.bubble = over(colors.bubble, surface);
  var effects = effectValues(theme.effects);
  var stops = [surface];
  for (var i = 0; i < effects.surfaceGradient.length; i++) stops.push(over(effects.surfaceGradient[i], surface));
  var apps = {};
  var rawApps = theme.apps || {};
  for (key in rawApps) if (has(rawApps, key)) {
    var appColor = asColor(rawApps[key]);
    if (appColor) apps[canonicalAppKey(key)] = appColor;
  }
  var writtenApps = {};
  for (key in apps) if (has(apps, key)) writtenApps[key] = cloneColor(apps[key]);
  return {
    id: theme.id || '',
    file: theme,
    colors: colors,
    apps: apps,
    writtenColors: writtenColors,
    writtenApps: writtenApps,
    effects: effects,
    surface: surface,
    surfaceStops: stops,
    isDark: averageLuminance(stops) < 0.18,
    hasOverlay: effects.surfaceGradient.length > 0 || effects.scanlines > 0,
    swatches: [],
    adjustments: [],
    clock: theme.clock || null
  };
}

function needsOf(backgrounds, minimum) {
  var needs = [];
  for (var i = 0; i < backgrounds.length; i++) needs.push({ background: backgrounds[i], minimum: minimum });
  return needs;
}

// 一个颜色没达标时的处理 + 记录（Build.cs:169-177）
function ensureColor(map, key, needs, adjustments) {
  var before = map[key];
  if (!before || needs.length === 0) return;
  var after = ensureContrast(before, needs);
  if (sameColor(after, before)) return;
  var worst = needs[0];
  var worstScore = contrast(before, worst.background) / worst.minimum;
  for (var i = 1; i < needs.length; i++) {
    var score = contrast(before, needs[i].background) / needs[i].minimum;
    if (score < worstScore) {
      worstScore = score;
      worst = needs[i];
    }
  }
  adjustments.push({
    key: key,
    before: formatColor(before),
    after: formatColor(after),
    ratio: contrast(before, worst.background),
    minimum: worst.minimum,
    reached: contrastScore(after, needs) >= 1
  });
  map[key] = after;
}

// 对比度强制（Build.cs:44-82）：文字沿自己的色相提亮/压暗，刚够达标就停。
// 阈值：主要文字 7:1、正文 4.5:1、图形 3:1、指示条进度 2:1。
function enforceContrast(palette) {
  var p = palette || toPalette(blankFile());
  var colors = {};
  var apps = {};
  var key;
  var rawColors = p.colors || {};
  for (key in rawColors) if (has(rawColors, key) && asColor(rawColors[key])) colors[key] = asColor(rawColors[key]);
  fillTokens(colors);
  var rawApps = p.apps || {};
  for (key in rawApps) if (has(rawApps, key) && asColor(rawApps[key])) apps[key] = asColor(rawApps[key]);
  // 表面不透明、tooltip/bubble 按叠在表面上的结果画，和 toPalette 一致（Build.cs:39-43）
  var surface = over(colors.surface, BLACK);
  colors.surface = surface;
  colors.tooltip = over(colors.tooltip, surface);
  colors.bubble = over(colors.bubble, surface);
  var effects = p.effects || effectValues(null);
  var surfaces = [surface];
  var ownGradient = effects.surfaceGradient || [];
  for (var g = 0; g < ownGradient.length; g++) {
    var stop = asColor(ownGradient[g]);
    if (stop) surfaces.push(over(stop, surface));
  }
  var popup = over(colors.popup, surface);
  var adjustments = [];
  for (var t = 0; t < PanelTokens.length; t++) {
    var token = PanelTokens[t];
    if (token.minimum <= 0) continue;
    var against = [];
    if (token.against === PanelThemeBackdrop.Surface) {
      against = surfaces.slice();
    } else if (token.against === PanelThemeBackdrop.SurfaceAndPopup) {
      against = surfaces.concat([popup]);
    } else if (token.against === PanelThemeBackdrop.Accent) {
      against = [over(colors.accent, popup)];
    } else if (token.against === PanelThemeBackdrop.Indicator) {
      against = [over(colors.indicator, BLACK)];
    }
    var needs = needsOf(against, token.minimum);
    // 文字还站在各种填充上：主要文字在选中段、按下、输入框、日期范围、提示框、时间气泡上；
    // 次要文字在分段底与悬停上。这些按正文的最低值算（Build.cs:62-69）
    var fills = [];
    if (token.key === 'textPrimary') {
      fills = [
        over(colors.fillSelected, surface), over(colors.pressed, surface), over(colors.input, popup),
        over(colors.rangeFill, popup), colors.tooltip, colors.bubble
      ];
    } else if (token.key === 'textSecondary') {
      fills = [over(colors.fill, surface), over(colors.hover, surface)];
    }
    if (fills.length > 0) needs = needs.concat(needsOf(fills, TextContrast));
    ensureColor(colors, token.key, needs, adjustments);
  }
  // 应用色不透明（取色器与设置里就这么存），且要对每一档表面底色都达标（Build.cs:72-78）
  var graphic = needsOf(surfaces, GraphicContrast);
  for (key in apps) {
    if (!has(apps, key)) continue;
    apps[key] = over(apps[key], surface);
    ensureColor(apps, key, graphic, adjustments);
  }
  // 主题自己的取色器预设色，按画出来的样子给（Build.cs:80-81）
  var own = p.file && p.file.swatches ? p.file.swatches : null;
  var swatches = [];
  if (own) {
    for (var s = 0; s < own.length && swatches.length < 12; s++) {
      var swatch = asColor(own[s]);
      if (swatch) swatches.push(ensureContrast(over(swatch, surface), graphic));
    }
  }
  var result = {};
  for (key in p) if (has(p, key)) result[key] = p[key];
  result.colors = colors;
  result.apps = apps;
  result.surface = surface;
  result.surfaceStops = surfaces;
  result.isDark = averageLuminance(surfaces) < 0.18;
  result.swatches = swatches;
  result.adjustments = adjustments;
  return result;
}

// 应用列的默认色（PanelPalette.AppColor 的取色部分）：主题写了就用主题的，否则回落到 AppPresets。
// theme 可以是合并好的主题文件（颜色是字符串）或调色板（颜色是 {r,g,b,a}）。
function appColors(theme) {
  var ownApps = (theme && theme.apps) || {};
  var out = {};
  for (var i = 0; i < AppKeys.length; i++) {
    var key = AppKeys[i];
    var value = null;
    for (var k in ownApps) {
      if (has(ownApps, k) && sameText(k, key)) {
        value = ownApps[k];
        break;
      }
    }
    var hex = '';
    if (value !== null && value !== undefined) {
      hex = formatColor(asColor(value));
    }
    out[key] = hex || AppPresets[key] || AppPresets.other;
  }
  return out;
}

// ---------------------------------------------------------------- 三色衍生（PanelThemes.Derive.cs）

var SeedKeys = ['surface', 'textPrimary', 'accent'];
var DarkForeground = '#F5F5F7';
var LightForeground = '#1D1D1F';

// 前景在深色/浅色底上各用的不透明度（Derive.cs:13-20）。浅色主题的文字是黑的，
// 非黑前景要同样的对比度就得再厚一点，所以次要/辅助文字比深色那边高一档。
var ForegroundShades = [
  ['textSecondary', 0x9e, 0xb8], ['textTertiary', 0x61, 0x88], ['equalizer', 0x9e, 0x8c], ['menuDetail', 0x80, 0x8c],
  ['hairline', 0x17, 0x14], ['track', 0x1f, 0x17], ['ringTrack', 0x29, 0x21], ['fill', 0x12, 0x0d],
  ['fillSelected', 0x24, 0x1a], ['hover', 0x18, 0x12], ['pressed', 0x24, 0x1f], ['outline', 0x24, 0x26],
  ['popupBorder', 0x24, 0x24], ['coverPlaceholder', 0x0f, 0x0d], ['coverOutline', 0x14, 0x1a], ['rim', 0x12, 0x1f],
  ['switchFill', 0x0f, 0x0a], ['seekRail', 0x2e, 0x24], ['rowDivider', 0x0d, 0x0f], ['rowHover', 0x0a, 0x0a],
  ['tooltipBorder', 0x38, 0x29], ['bubbleBorder', 0x1a, 0x24]
];

// 不透明色：背景（0）与前景（1）之间；浅色主题的弹出层更亮，所以给负数（朝白走）（Derive.cs:21-27）
var BackgroundShades = [
  ['popup', 0.1, -0.8], ['input', 0.06, 0.045], ['tooltip', 0.12, -0.8], ['bubble', 0.17, -0.8],
  ['scrollThumb', 0.33, 0.3], ['indicator', 0.58, 0.34], ['indicatorProgress', 0.35, 0.85]
];

function isDarkSurface(surface) {
  return luminance(over(surface, BLACK)) < 0.18;
}

// PanelThemes.Derive（Derive.cs:35-65）：设置页只改三色之一时，该连带改哪些颜色（含改的那个本身）。
// 新底色或新前景带来新的文字、线条、填充、弹出层；新强调色带来它上面的文字与日期范围底色。
// 底色由深转浅（或反过来）时，如果写好的前景配不上，就一并换成读得清的那个。
// 返回 {颜色键: {r,g,b,a}}，没列到的颜色不动。
function derive(palette, seed, value) {
  var p = palette || {};
  if (SeedKeys.indexOf(seed) < 0) throw new Error('不是三色之一: ' + seed);
  var given = asColor(value);
  if (!given) throw new Error('颜色无效: ' + value);
  var target = withAlpha(given, 255);
  var written = p.writtenColors || {};
  var background = over(asColor(written.surface) || BLACK, BLACK);
  var foreground = over(asColor(written.textPrimary) || WHITE, background);
  var accent = over(asColor(written.accent) || WHITE, background);
  var wasDark = isDarkSurface(background);
  if (seed === 'surface') background = target;
  else if (seed === 'textPrimary') foreground = target;
  else accent = target;
  var dark = isDarkSurface(background);
  var flipped = dark !== wasDark;

  var colors = {};
  colors[seed] = target;
  if (seed === 'surface' && flipped && contrast(foreground, background) < TextContrast) {
    foreground = dark ? asColor(DarkForeground) : asColor(LightForeground);
    colors.textPrimary = foreground;
  }
  if (seed !== 'accent') {
    colors.clock = foreground;
    for (var i = 0; i < ForegroundShades.length; i++) {
      var shade = ForegroundShades[i];
      colors[shade[0]] = withAlpha(foreground, dark ? shade[1] : shade[2]);
    }
    for (var j = 0; j < BackgroundShades.length; j++) {
      var fill = BackgroundShades[j];
      var amount = dark ? fill[1] : fill[2];
      colors[fill[0]] = amount >= 0
        ? mixColors(background, foreground, amount)
        : mixColors(background, WHITE, -amount);
    }
  }
  if (seed === 'accent' || flipped) {
    colors.onAccent = contrast(WHITE, accent) >= contrast(BLACK, accent) ? cloneColor(WHITE) : cloneColor(BLACK);
    colors.rangeFill = withAlpha(accent, dark ? 0x38 : 0x2e);
  }
  return colors;
}

// PanelPalette.Readable：别处挑的颜色（应用色、时钟色、封面取色）按这个表面画出来的样子
// —— 在这个表面上读得清就不动，否则沿色相挪到刚好达标。
function readable(palette, color, minimum) {
  var p = palette || {};
  var stops = p.surfaceStops && p.surfaceStops.length > 0 ? p.surfaceStops : [over(asColor(p.surface) || BLACK, BLACK)];
  var min = minimum === undefined ? GraphicContrast : minimum;
  var target = asColor(color);
  if (!target) return null;
  return ensureContrast(target, needsOf(stops, min));
}

if (typeof module !== 'undefined') {
  module.exports = {
    SystemThemeId: SystemThemeId,
    DarkThemeId: DarkThemeId,
    LightThemeId: LightThemeId,
    DemoThemeId: DemoThemeId,
    TextContrast: TextContrast,
    StrongTextContrast: StrongTextContrast,
    GraphicContrast: GraphicContrast,
    IndicatorContrast: IndicatorContrast,
    PanelThemeBackdrop: PanelThemeBackdrop,
    PanelTokens: PanelTokens,
    AppKeys: AppKeys,
    AppPresets: AppPresets,
    BuiltInOrder: BuiltInOrder,
    EffectRanges: EffectRanges,
    ClockStyles: ClockStyles,
    ClockSwatchKeys: ClockSwatchKeys,
    parseColor: parseColor,
    formatColor: formatColor,
    asColor: asColor,
    cssColor: cssColor,
    opaqueColor: opaqueColor,
    withAlpha: withAlpha,
    over: over,
    luminance: luminance,
    contrast: contrast,
    minimumContrast: minimumContrast,
    contrastScore: contrastScore,
    ensureContrast: ensureContrast,
    toHsl: toHsl,
    fromHsl: fromHsl,
    toHsv: toHsv,
    fromHsv: fromHsv,
    mix: mix,
    mixColors: mixColors,
    distance: distance,
    roundHalfEven: roundHalfEven,
    normalizeId: normalizeId,
    parseTheme: parseTheme,
    resolve: resolve,
    builtinThemes: builtinThemes,
    toPalette: toPalette,
    enforceContrast: enforceContrast,
    appColors: appColors,
    isDarkSurface: isDarkSurface,
    derive: derive,
    SeedKeys: SeedKeys,
    ForegroundShades: ForegroundShades,
    BackgroundShades: BackgroundShades,
    readable: readable,
    clockProblem: clockProblem
  };
}
