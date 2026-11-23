// lib/core/geometry.js
'use strict';

// 收起态几何：CollapsedGeometry.cs（212 行）与 CollapsedHover.cs 的逐函数移植，常数与分支一一对应。
// 纯计算：不碰 GI（St/Clutter）、不读文件、不碰时钟，所以 node 与 cjs 都能直接跑。
//
// 与 C# 的两处系统性写法差异（其余逐行对应，行号标在各函数上）：
// - double.IsFinite → Number.isFinite。上游的 Finite()/Value() 把 NaN 与 ±Infinity 都当「没有值」，
//   Number.isFinite 对这三者都是 false，判断结果一致。
// - Math.Clamp → clamp()。C# 的 Math.Clamp 在 min>max 时抛异常，这里不抛；所有调用点都保证 min<=max。
// - Math.Round(x, MidpointRounding.AwayFromZero) → roundAway()：JS 的 Math.round 对正数是「.5 进位」，
//   因此对绝对值取整再补符号，才是「远离零」而不是「向上」。这是最容易移植错的一处，见 CollapsedGeometry.cs:169、:177。

// 三种收起形态的名字。上游是 enum CompactStyle，JS 里用字符串（大小写不敏感，未知值落到 notch，
// 与上游 switch 的 default 分支一致）。
var Styles = { Notch: 'notch', Capsule: 'capsule', Line: 'line' };

// CollapsedGeometry.cs:6-40 的全部常量，键名 camelCase。数值一个都不许改（docs/CONVENTIONS.md §3）。
var CollapsedLimits = {
  // 紧凑内容按设计尺寸绘制的高度；Scale = 表面高度 / 这个值（:8）
  baseHeight: 32,
  // 刘海与胶囊可以宽到显示器（胶囊是工作区）；*WidthMax 只是「保存值」的上限，
  // 每台显示器在 Resolve 里再收窄（WidthRange）（:11、:13）
  notchWidthDefault: 238,
  notchWidthMin: 180,
  notchWidthMax: 8000,
  notchHeightDefault: 32,
  notchHeightMin: 24,
  notchHeightMax: 64,
  capsuleWidthDefault: 196,
  capsuleWidthMin: 140,
  capsuleWidthMax: 8000,
  capsuleHeightDefault: 32,
  capsuleHeightMin: 24,
  capsuleHeightMax: 64,
  // CapsuleTopMax 同样只是保存值的上限；在显示器上胶囊可以一直下到工作区底边（CapsuleTopRange）（:15-17）
  capsuleTopDefault: 5,
  capsuleTopMin: 0,
  capsuleTopMax: 4000,
  lineLengthDefault: 56,
  lineLengthMin: 24,
  lineLengthMax: 600,
  // 厚度按半步进选择（:19-20）
  lineThicknessDefault: 4,
  lineThicknessMin: 2,
  lineThicknessMax: 8,
  lineThicknessStep: 0.5,
  lineTopDefault: 4,
  lineTopMin: 0,
  lineTopMax: 16,
  // 保存的水平偏移在这个范围内；每台显示器在 Resolve 里再收窄（:22-23）
  offsetDefault: 0,
  offsetLimit: 4000,
  // 高度范围容许的最小内容缩放（24 / 32）；最大是 64 / 32 = 2，没有额外上限（:24-25）
  contentMinScale: 24 / 32,
  // 缩放为 1 时内容两端各留的空隙，随缩放大（:26-27）
  notchInset: 30,
  capsuleInset: 16,
  // 刘海的下圆角与把它接到屏幕边的肩，任何宽高都不变（:28-30）
  notchCorner: 12,
  notchShoulder: 16,
  // 浮在降低后的胶囊下面的面板，比它的页面高这么多；空间加在 header 上方（:31-34）
  floatingHeaderExtra: 6,
  // 浮层面板的顶边在胶囊竖直中心以上这么远 = FloatingHeaderExtra + 半个 32 DIP 的 header 行（:35-39）
  capsulePanelReach: 22
};

// ---------------------------------------------------------------- 尺寸档位
//
// 收起态对外只有「自动 + 三档」（小 / 标准 / 大），不再让用户逐个微调像素。
// 自动档见下面的 AutoLimits：档位不再是用户选的一个数，而是按内容现算。
// 固定档位同时驱动两件事：
//   · 表面几何（下面这张表的 7 个值，标准档与上游默认逐值一致）
//   · 内容缩放 contentScale = 高 / baseHeight（指示条按厚度 / 默认厚度）
// 数值范围仍在 CollapsedLimits 之内，不改上游常量（docs/CONVENTIONS.md §3）。
var SizePresets = {
  // 高 26 → 内容缩放 0.8125：字体 11.5→9.5，封面 20→16，环 18→15
  compact: {
    notchWidth: 200, notchHeight: 26,
    capsuleWidth: 172, capsuleHeight: 26, capsuleTop: 4,
    lineLength: 44, lineThickness: 3
  },
  // 标准档 = 上游 CollapsedGeometry 的默认值，一个数都不改
  standard: {
    notchWidth: 238, notchHeight: 32,
    capsuleWidth: 196, capsuleHeight: 32, capsuleTop: 5,
    lineLength: 56, lineThickness: 4
  },
  // 高 40 → 内容缩放 1.25：字体 11.5→14.5，封面 20→25，环 18→22.5
  large: {
    notchWidth: 282, notchHeight: 40,
    capsuleWidth: 232, capsuleHeight: 40, capsuleTop: 6,
    lineLength: 72, lineThickness: 5
  }
};

// ---------------------------------------------------------------- 自动档
//
// 第四个「档位」auto：不按用户选的固定高度，而是按当前真的画出来的段数决定岛的尺寸 ——
// 只有时钟时是一枚小刘海，封面 + 配额环 + 标题 + 律动 + 时钟齐了才长到最大。
// 段数 → 高度是线性的：24 / 28 / 32 / 36 / 40，正好落在 CollapsedLimits 的 24..64 里，
// 并且 3 段 = 标准档（32）、5 段 = 大档（40），所以三档仍能一一对应上。
// fitContent 让宽度贴着内容走：不再按 shoulder+corner=28 留一大块死白，
// 内容只有两个配额环加时钟时，岛就是真的那么宽（「两边都空着」的根因）。
var AutoLimits = {
  minHeight: 24,          // = CollapsedLimits.notchHeightMin，内容缩放 0.75
  maxHeight: 40,          // 内容缩放 1.25，与大档一致
  heightPerUnit: 4,       // 每多一段内容加这么高
  minUnits: 1,
  maxUnits: 5,            // 五段（封面 / 环 / 文字 / 律动 / 时钟）就到顶
  sidePad: 10,            // 自动宽度时的内容留白 = shoulder + sidePad * scale
  capsuleSidePad: 10,     // 胶囊同上（标准档胶囊原本是 16）
  minNotchWidth: 40,      // 再窄肩膀就叠在一起了（shoulder 16 × 2 + 8）
  minCapsuleWidth: 48
};

// 段数：只夹到 1..5。小数照原样保留（渲染时高度取整），调用方想按内容加权也不必改这里
function autoUnits(units) {
  var n = Number.isFinite(units) ? units : 0;
  return clamp(n, AutoLimits.minUnits, AutoLimits.maxUnits);
}

// 段数 → 表面高度（整数，24..40）
function autoHeight(units) {
  return roundAway(clamp(AutoLimits.minHeight + (autoUnits(units) - AutoLimits.minUnits) * AutoLimits.heightPerUnit,
    AutoLimits.minHeight, AutoLimits.maxHeight));
}

// 段数 → 指示条长度：表里三档是 44 / 56 / 72（厚 3 / 4 / 5），不是等比，
// 所以按厚度做分段线性插值，这样 auto 在 1/3/5 段上正好等于小/标准/大三档。
function autoLineLength(thickness) {
  if (thickness <= CollapsedLimits.lineThicknessDefault) {
    return roundAway(CollapsedLimits.lineLengthDefault
      + (thickness - CollapsedLimits.lineThicknessDefault) * 12);
  }
  return roundAway(CollapsedLimits.lineLengthDefault
    + (thickness - CollapsedLimits.lineThicknessDefault) * 16);
}

// 段数 → resolve() 认识的那组设置值（含 fitContent）。返回副本，调用方随便改。
function autoSettings(units) {
  var u = autoUnits(units);
  var h = autoHeight(u);
  var scale = h / CollapsedLimits.baseHeight;
  var thickness = clamp(roundAway(CollapsedLimits.lineThicknessDefault * scale / CollapsedLimits.lineThicknessStep)
    * CollapsedLimits.lineThicknessStep,
    CollapsedLimits.lineThicknessMin, CollapsedLimits.lineThicknessMax);
  return {
    notchWidth: Math.max(CollapsedLimits.notchWidthMin, roundAway(CollapsedLimits.notchWidthDefault * scale)),
    notchHeight: h,
    capsuleWidth: Math.max(CollapsedLimits.capsuleWidthMin, roundAway(CollapsedLimits.capsuleWidthDefault * scale)),
    capsuleHeight: h,
    capsuleTop: roundAway(CollapsedLimits.capsuleTopDefault * scale),
    lineLength: autoLineLength(thickness),
    lineThickness: thickness,
    fitContent: true
  };
}

// 未知档位一律落到 standard（与 styleOf 的未知值回落同一策略）；auto 是第四个合法档位
function sizeOf(size) {
  var text = typeof size === 'string' ? size.toLowerCase() : '';
  if (text === 'auto') return 'auto';
  return SizePresets[text] ? text : 'standard';
}

// 档位 → resolve() 认识的那组设置值。auto 需要段数（不传按「标准档」的 3 段处理）。
function presetSettings(size, units) {
  if (sizeOf(size) === 'auto') return autoSettings(units === undefined ? 3 : units);
  var p = SizePresets[sizeOf(size)];
  return {
    notchWidth: p.notchWidth, notchHeight: p.notchHeight,
    capsuleWidth: p.capsuleWidth, capsuleHeight: p.capsuleHeight,
    capsuleTop: p.capsuleTop,
    lineLength: p.lineLength, lineThickness: p.lineThickness
  };
}

// 档位 → 内容缩放系数。刘海/胶囊按高，指示条按厚度；和 resolve() 的 scale 同一算法，
// 供绘制层（island.js）直接取用，避免两处各算一遍导致文字和表面不同步。
// auto 档要传段数（不传按 3 段 = 标准档）。
function contentScale(size, style, units) {
  var p = presetSettings(size, units);
  if (styleOf(style) === Styles.Line) return p.lineThickness / CollapsedLimits.lineThicknessDefault;
  return (styleOf(style) === Styles.Capsule ? p.capsuleHeight : p.notchHeight) / CollapsedLimits.baseHeight;
}

// CollapsedHover.cs:18-20：收起表面感知指针的范围。不属于 CollapsedLimits（上游单独一个类）。
var HoverLimits = {
  // 工作区顶边与「仍算搭桥」的胶囊之间最大的缝；不是设置项
  bridgeMaxGap: 20,
  // 指示条四周的感知余量，让它更好点中
  linePadX: 8,
  linePadBelow: 2
};

// ---------------------------------------------------------------- 数值小工具

// C# Math.Clamp(v, min, max) 的等价物（NaN 原样穿过去，和上游一样：两次比较都 false）
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// double.IsFinite(value) ? Math.Max(0, value) : 0 —— CollapsedGeometry.cs:199
function finite(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

// CollapsedGeometry.cs:198：只在非有限值时才回落
function value(value, min, max, fallback) {
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

// Math.Round(x, MidpointRounding.AwayFromZero)：0.5 远离零进位（2.5→3、-2.5→-3），
// 而 Math.round(-2.5) 是 -2（朝 +∞），所以必须按绝对值取整再补符号。见 CollapsedGeometry.cs:169、:177。
function roundAway(value) {
  return Math.sign(value) * Math.round(Math.abs(value));
}

// ---------------------------------------------------------------- 矩形

function rect(x, y, width, height) {
  return { x: x, y: y, width: width, height: height };
}

// CollapsedGeometry.cs:203-211：尺寸不是数或为负的显示器算空；工作区被夹进显示器，
// 缺失或空的工作区用整个显示器顶替。
function sanitize(monitor, work) {
  var m = monitor || {};
  var w = work || {};
  var width = finite(m.width);
  var height = finite(m.height);
  var screen = rect(0, 0, width, height);
  if (!Number.isFinite(w.x) || !Number.isFinite(w.y) || !Number.isFinite(w.width) || !Number.isFinite(w.height)) {
    return { screen: screen, area: screen };
  }
  var left = clamp(w.x, 0, width);
  var top = clamp(w.y, 0, height);
  var right = clamp(w.x + Math.max(0, w.width), left, width);
  var bottom = clamp(w.y + Math.max(0, w.height), top, height);
  if (right - left <= 0 || bottom - top <= 0) return { screen: screen, area: screen };
  return { screen: screen, area: rect(left, top, right - left, bottom - top) };
}

// CollapsedGeometry.cs:192-196：刘海横向铺满显示器，其余形态以工作区为准
function span(style, monitor, work) {
  var both = sanitize(monitor, work);
  return style === Styles.Notch ? both.screen.width : both.area.width;
}

// CollapsedGeometry.cs:184-190：在 span 里居中，再按 offset 移动，移动量被剩余空间夹住
function place(spanWidth, width, offset) {
  var half = Math.max(0, (spanWidth - width) / 2);
  var shift = Number.isFinite(offset) ? clamp(offset, -CollapsedLimits.offsetLimit, CollapsedLimits.offsetLimit) : 0;
  return half + clamp(shift, -half, half);
}

// CollapsedGeometry.cs:181-182：上边可用的范围，0 到 areaHeight - H（再被 limit 夹住）
function topRange(height, areaHeight, limit) {
  return { min: 0, max: clamp(areaHeight - Math.max(0, height), 0, limit) };
}

function styleOf(style) {
  var text = typeof style === 'string' ? style.toLowerCase() : '';
  if (text === Styles.Capsule) return Styles.Capsule;
  if (text === Styles.Line) return Styles.Line;
  return Styles.Notch;
}

// ---------------------------------------------------------------- 尺寸计算

// CollapsedGeometry.cs:166-170：取到最近的半步（2..8），不是数字就给默认值
function roundLineThickness(value_) {
  if (!Number.isFinite(value_)) return CollapsedLimits.lineThicknessDefault;
  return clamp(roundAway(value_ / CollapsedLimits.lineThicknessStep) * CollapsedLimits.lineThicknessStep,
    CollapsedLimits.lineThicknessMin, CollapsedLimits.lineThicknessMax);
}

// CollapsedGeometry.cs:174-179：把 DIP 长度对到最近的整数设备像素（至少一个），再换回 DIP。
// 取整是单调的：更大的值不会给出更小的结果，但相邻两个值可能相同。
function snapToDevicePixels(dip, pixelsPerDip) {
  var scale = Number.isFinite(pixelsPerDip) && pixelsPerDip > 0 ? pixelsPerDip : 1;
  var pixels = Number.isFinite(dip) ? Math.max(1, roundAway(dip * scale)) : 1;
  return pixels / scale;
}

// CollapsedGeometry.cs:159-160：浮层面板在胶囊顶边以上多远 = max(0, 22 - H/2)，默认高度时是 6
function capsulePanelLift(capsuleHeight) {
  return Math.max(0, CollapsedLimits.capsulePanelReach - finite(capsuleHeight) / 2);
}

// CollapsedGeometry.cs:131-133
function capsuleTopRange(height, work) {
  var w = work || {};
  return topRange(finite(height), finite(w.height), Infinity);
}

// CollapsedGeometry.cs:162-164：指示条的同类范围（最多 16）
function lineTopRange(thickness, work) {
  var w = work || {};
  return topRange(finite(thickness), finite(w.height), CollapsedLimits.lineTopMax);
}

// CollapsedGeometry.cs:67-108
// contentWanted: 自动宽度时，刘海/胶囊内容要的宽度（没有内容传 0）；传 null/undefined 就保持保存的宽度。
// 给了值以后，表面宽度 = 内容宽度 + 两侧空隙，可宽可窄，被形态最小宽度与显示器夹住。
function resolve(settings, style, monitor, work, pixelsPerDip, contentWanted) {
  var s = settings || {};
  var shape = styleOf(style);
  var auto = contentWanted !== null && contentWanted !== undefined;
  // CollapsedGeometry.cs:70：给了值但不是有限数时，wanted 归 0（仍然处于自动宽度）
  var wanted = Number.isFinite(contentWanted) ? Math.max(0, contentWanted) : 0;
  var both = sanitize(monitor, work);
  var screen = both.screen;
  var area = both.area;
  var ppd = pixelsPerDip === undefined ? 1 : pixelsPerDip;

  if (shape === Styles.Capsule) {
    // :76-84
    var capsuleTight = s.fitContent === true;
    var height = Math.min(value(s.capsuleHeight, CollapsedLimits.capsuleHeightMin,
      CollapsedLimits.capsuleHeightMax, CollapsedLimits.capsuleHeightDefault), area.height);
    var saved = value(s.capsuleWidth, CollapsedLimits.capsuleWidthMin,
      CollapsedLimits.capsuleWidthMax, CollapsedLimits.capsuleWidthDefault);
    var scale = height / CollapsedLimits.baseHeight;
    // 自动档贴着内容：留白从 16 收到 10，宽度下限也一起收，内容少时不会两边空一大截
    var inset = (capsuleTight ? AutoLimits.capsuleSidePad : CollapsedLimits.capsuleInset) * scale;
    var fitMin = capsuleTight ? Math.max(AutoLimits.minCapsuleWidth, 2 * inset) : CollapsedLimits.capsuleWidthMin;
    var fit = clamp(wanted + 2 * inset, fitMin, CollapsedLimits.capsuleWidthMax);
    var width = Math.min(auto ? fit : saved, area.width);
    var topRangeCapsule = topRange(height, area.height, Infinity);
    var top = clamp(value(s.capsuleTop, CollapsedLimits.capsuleTopMin,
      CollapsedLimits.capsuleTopMax, CollapsedLimits.capsuleTopDefault), topRangeCapsule.min, topRangeCapsule.max);
    var surface = rect(area.x + place(area.width, width, s.capsuleOffsetX), area.y + top, width, height);
    return {
      style: Styles.Capsule,
      surface: surface,
      scale: scale,
      inset: inset,
      contentWidth: Math.max(0, width - 2 * inset),
      bottomRadius: height / 2,
      topRadius: height / 2,
      shoulder: 0
    };
  }

  if (shape === Styles.Line) {
    // :88-93
    var length = Math.min(value(s.lineLength, CollapsedLimits.lineLengthMin,
      CollapsedLimits.lineLengthMax, CollapsedLimits.lineLengthDefault), area.width);
    var thickness = Math.min(snapToDevicePixels(roundLineThickness(s.lineThickness), ppd), area.height);
    var topRangeLine = topRange(thickness, area.height, CollapsedLimits.lineTopMax);
    var lineTop = clamp(value(s.lineTop, CollapsedLimits.lineTopMin,
      CollapsedLimits.lineTopMax, CollapsedLimits.lineTopDefault), topRangeLine.min, topRangeLine.max);
    var lineSurface = rect(area.x + place(area.width, length, s.lineOffsetX), area.y + lineTop, length, thickness);
    return {
      style: Styles.Line,
      surface: lineSurface,
      scale: 1,
      inset: 0,
      contentWidth: length,
      bottomRadius: thickness / 2,
      topRadius: thickness / 2,
      shoulder: 0
    };
  }

  // :97-105（default 分支 = 刘海）
  var notchTight = s.fitContent === true;
  var notchHeight = Math.min(value(s.notchHeight, CollapsedLimits.notchHeightMin,
    CollapsedLimits.notchHeightMax, CollapsedLimits.notchHeightDefault), screen.height);
  var notchSaved = value(s.notchWidth, CollapsedLimits.notchWidthMin,
    CollapsedLimits.notchWidthMax, CollapsedLimits.notchWidthDefault);
  var notchScale = notchHeight / CollapsedLimits.baseHeight;
  // 内容要避开 inset，刘海矮的时候还要避开更宽的肩与圆角（:99-100）。
  // 自动档只避开肩（16，不随缩放）+ 一点留白：肩的曲线只压在顶部 7px，
  // 内容在竖直中线上，28 的那半圈圆角根本不挡它，按 28 留白就是那两条空边。
  var side = notchTight
    ? CollapsedLimits.notchShoulder + AutoLimits.sidePad * notchScale
    : Math.max(CollapsedLimits.notchInset * notchScale, CollapsedLimits.notchShoulder + CollapsedLimits.notchCorner);
  var notchMin = notchTight ? Math.max(AutoLimits.minNotchWidth, 2 * side) : CollapsedLimits.notchWidthMin;
  var notchFit = clamp(wanted + 2 * side, notchMin, CollapsedLimits.notchWidthMax);
  var notchWidth = Math.min(auto ? notchFit : notchSaved, screen.width);
  var notchInset = notchTight ? side : CollapsedLimits.notchInset * notchScale;
  var notchSurface = rect(place(screen.width, notchWidth, s.notchOffsetX), 0, notchWidth, notchHeight);
  return {
    style: Styles.Notch,
    surface: notchSurface,
    scale: notchScale,
    inset: notchInset,
    contentWidth: Math.max(0, notchWidth - 2 * notchInset),
    bottomRadius: CollapsedLimits.notchCorner,
    topRadius: 0,
    shoulder: CollapsedLimits.notchShoulder
  };
}

// CollapsedGeometry.cs:111-116：把这么宽的表面在显示器上左右移动的范围；更大的保存偏移按这个上限生效
function offsetXRange(style, width, monitor, work) {
  var total = span(styleOf(style), monitor, work);
  var half = Number.isFinite(width) ? Math.max(0, (total - clamp(width, 0, total)) / 2) : 0;
  // C# 里 -0.0 与 0.0 相等，JS 的 -0 会被 Object.is 当成另一个值；这里返回 0 而不是 -0
  return { min: half === 0 ? 0 : -half, max: half };
}

// CollapsedGeometry.cs:119-129：这台显示器容得下的宽度范围 = 设置范围被显示器/工作区收窄
function widthRange(style, monitor, work) {
  var shape = styleOf(style);
  var min;
  var max;
  if (shape === Styles.Capsule) {
    min = CollapsedLimits.capsuleWidthMin;
    max = CollapsedLimits.capsuleWidthMax;
  } else if (shape === Styles.Line) {
    min = CollapsedLimits.lineLengthMin;
    max = CollapsedLimits.lineLengthMax;
  } else {
    min = CollapsedLimits.notchWidthMin;
    max = CollapsedLimits.notchWidthMax;
  }
  var high = Math.min(max, span(shape, monitor, work));
  return { min: Math.min(min, high), max: high };
}

// CollapsedHover.cs:22：指针从上面下来时能不能一路扫到表面（中间那段算目标区）
function hasBridge(style, surface, workTop) {
  var shape = styleOf(style);
  var rect_ = surface || {};
  var edge = shape === Styles.Capsule && Number.isFinite(workTop) ? Math.max(0, workTop) : 0;
  return rect_.y - edge <= HoverLimits.bridgeMaxGap || shape !== Styles.Capsule;
}

// CollapsedHover.cs:25-30：收起表面感知指针的区域（与表面同一坐标系）
function zone(style, surface, workTop) {
  var shape = styleOf(style);
  var s = surface || {};
  var padX = shape === Styles.Line ? HoverLimits.linePadX : 0;
  var padBelow = shape === Styles.Line ? HoverLimits.linePadBelow : 0;
  var left = Number.isFinite(s.x) ? s.x : 0;
  var top0 = Number.isFinite(s.y) ? s.y : 0;
  var width = Number.isFinite(s.width) ? s.width : 0;
  var bottom = top0 + (Number.isFinite(s.height) ? s.height : 0);
  var edge = shape === Styles.Capsule && Number.isFinite(workTop) ? Math.max(0, workTop) : 0;
  var top = hasBridge(shape, s, workTop) ? Math.min(edge, top0) : top0;
  return rect(left - padX, top, width + padX * 2, bottom + padBelow - top);
}

// CollapsedGeometry.cs:144-153：展开面板从哪里开始（DIP，相对显示器顶边；work 也是相对显示器），
// 以及它比页面高多少（headerExtra，加在 header 上方）。
// 刘海与指示条：贴屏幕边（0）。胶囊还在 hover 桥内：贴工作区顶边，都算「挂着」，headerExtra 为 0。
// 胶囊降到桥外：面板浮起，比页面高 floatingHeaderExtra，顶边在胶囊顶边以上 capsulePanelLift(H)，
// 必要时上移到工作区内；移到工作区顶边就退回「挂着」。
function panel(shape, work, pageHeight, bottomLimit) {
  var limit = bottomLimit === undefined ? Infinity : bottomLimit;
  var w = work || {};
  if (!shape || styleOf(shape.style) !== Styles.Capsule || !Number.isFinite(w.y) || !Number.isFinite(w.height)) {
    return { top: 0, headerExtra: 0 };
  }
  var top = Math.max(0, w.y);
  var bottom = top + finite(w.height);
  // :148：只挡 NaN；Infinity 是「没有更低的底边」
  if (!Number.isNaN(limit)) bottom = Math.min(bottom, limit);
  // :149
  if (hasBridge(Styles.Capsule, shape.surface, w.y)) return { top: top, headerExtra: 0 };
  var extra = CollapsedLimits.floatingHeaderExtra;
  var surface = shape.surface || {};
  var surfaceTop = Number.isFinite(surface.y) ? surface.y : 0;
  var lift = capsulePanelLift(surface.height);
  var high = Math.max(top, bottom - finite(pageHeight) - extra);
  var floating = clamp(surfaceTop - lift, top, high);
  // :152
  return floating > top ? { top: floating, headerExtra: extra } : { top: top, headerExtra: 0 };
}

// CollapsedGeometry.cs:156-157：只要顶边
function panelTop(shape, work, pageHeight, bottomLimit) {
  return panel(shape, work, pageHeight, bottomLimit).top;
}

// 只把需要对外暴露的名字挂出去：node 看 module.exports，cjs 的旧式模块系统直接读模块全局的 var/function。
if (typeof module !== 'undefined') {
  module.exports = {
    Styles: Styles,
    CollapsedLimits: CollapsedLimits,
    SizePresets: SizePresets,
    AutoLimits: AutoLimits,
    autoUnits: autoUnits,
    autoHeight: autoHeight,
    autoSettings: autoSettings,
    sizeOf: sizeOf,
    presetSettings: presetSettings,
    contentScale: contentScale,
    HoverLimits: HoverLimits,
    clamp: clamp,
    roundAway: roundAway,
    resolve: resolve,
    offsetXRange: offsetXRange,
    widthRange: widthRange,
    capsuleTopRange: capsuleTopRange,
    panel: panel,
    panelTop: panelTop,
    capsulePanelLift: capsulePanelLift,
    lineTopRange: lineTopRange,
    roundLineThickness: roundLineThickness,
    snapToDevicePixels: snapToDevicePixels,
    hasBridge: hasBridge,
    zone: zone
  };
}
