'use strict';

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

function _rgba(color, alpha) {
  return [color.red / 255, color.green / 255, color.blue / 255, alpha];
}

function _themeColor(area, property, fallback) {
  try {
    return area.get_theme_node().get_color(property);
  } catch (error) {
    return fallback || area.get_theme_node().get_foreground_color();
  }
}

function _setHoverTimestamp(view, timestamp) {
  if (!view._hoverFormatter)
    return;
  const value = Math.max(view._area._minimum,
    Math.min(view._area._maximum, Number(timestamp)));
  view._area._hoverTimestamp = value;
  const detail = view._hoverFormatter(value);
  view._hover.set_text(detail);
  view._area.set_accessible_name(detail);
  view._area.queue_repaint();
}

function _clearHover(view) {
  view._area._hoverTimestamp = null;
  view._hover.set_text(view._defaultDetail || '');
  view._area.set_accessible_name(view._defaultDetail || '');
  view._area.queue_repaint();
}

var createPanelBar = function(styleClass) {
  const area = new St.DrawingArea({
    style_class: `codex-monitor-panel-bar ${styleClass}`,
    x_expand: false,
    y_expand: false,
    y_align: Clutter.ActorAlign.CENTER,
  });
  area._value = 0;
  area._available = false;
  area.connect('repaint', _drawPanelBar);
  return area;
};

var updatePanelBar = function(area, window) {
  area._value = window ? Number(window.usedPercent) : 0;
  area._available = Boolean(window);
  area.queue_repaint();
};

function _drawPanelBar(area) {
  const context = area.get_context();
  const [width, height] = area.get_surface_size();
  const foreground = area.get_theme_node().get_foreground_color();
  const active = _themeColor(area, '-usage-bar-color', foreground);
  const muted = _themeColor(area, '-usage-track-color', foreground);
  const barHeight = Math.max(2, Math.min(4, height));
  const y = Math.max(0, Math.floor((height - barHeight) / 2));
  context.setSourceRGBA(..._rgba(muted, 0.25));
  context.rectangle(0, y, width, barHeight);
  context.fill();
  if (area._available) {
    context.setSourceRGBA(..._rgba(active, 0.95));
    context.rectangle(0, y, width * Math.min(100, Math.max(0, area._value)) / 100, barHeight);
    context.fill();
  }
  context.$dispose();
}

var createQuotaGraph = function(options = {}) {
  const view = new St.BoxLayout({
    vertical: true,
    style_class: 'codex-monitor-graph-view',
  });
  const plotRow = new St.BoxLayout({ style_class: 'codex-monitor-graph-plot-row' });
  view._leftAxis = new St.BoxLayout({
    vertical: true,
    style_class: 'codex-monitor-graph-y-axis',
  });
  view._rightAxis = new St.BoxLayout({
    vertical: true,
    style_class: 'codex-monitor-graph-y-axis codex-monitor-graph-y-axis-right',
  });
  _updateAxis(view._leftAxis, null);
  _updateAxis(view._rightAxis, null);
  view._rightAxis.visible = false;
  view._area = new St.DrawingArea({
    style_class: 'codex-monitor-graph',
    reactive: true,
    can_focus: true,
    track_hover: true,
    x_expand: true,
    accessible_name: options.accessibleName || 'Usage trend graph',
  });
  view._area._series = [];
  view._area._resetMarkers = [];
  view._area._axes = null;
  view._area._minimum = 0;
  view._area._maximum = 1;
  view._area._collectionStart = null;
  view._area._uncollectedText = '';
  view._area._hoverTimestamp = null;
  view._area.connect('repaint', _drawQuotaGraph);
  view._area.connect('motion-event', (_actor, event) => {
    const [stageX, stageY] = event.get_coords();
    const transformed = view._area.transform_stage_point(stageX, stageY);
    if (!transformed[0] || !view._hoverFormatter)
      return Clutter.EVENT_PROPAGATE;
    // Cairo's surface only exists during repaint, so its dimensions are 0x0
    // here on Cinnamon. Use the actor's allocated width for pointer geometry.
    const width = Math.max(1, Number(view._area.width) || 1);
    const ratio = Math.max(0, Math.min(1, transformed[1] / Math.max(1, width)));
    const timestamp = view._area._minimum +
      ratio * (view._area._maximum - view._area._minimum);
    _setHoverTimestamp(view, timestamp);
    return Clutter.EVENT_PROPAGATE;
  });
  view._area.connect('leave-event', () => {
    _clearHover(view);
    return Clutter.EVENT_PROPAGATE;
  });
  view._area.connect('key-press-event', (_actor, event) => {
    const key = event.get_key_symbol();
    const span = Math.max(1, view._area._maximum - view._area._minimum);
    const current = Number.isFinite(view._area._hoverTimestamp)
      ? view._area._hoverTimestamp : view._area._maximum;
    if (key === Clutter.KEY_Left)
      _setHoverTimestamp(view, current - span / 40);
    else if (key === Clutter.KEY_Right)
      _setHoverTimestamp(view, current + span / 40);
    else if (key === Clutter.KEY_Home)
      _setHoverTimestamp(view, view._area._minimum);
    else if (key === Clutter.KEY_End)
      _setHoverTimestamp(view, view._area._maximum);
    else if (key === Clutter.KEY_Escape)
      _clearHover(view);
    else
      return Clutter.EVENT_PROPAGATE;
    return Clutter.EVENT_STOP;
  });
  plotRow.add_child(view._leftAxis);
  plotRow.add_child(view._area);
  plotRow.add_child(view._rightAxis);
  view.add_child(plotRow);

  view._xAxis = new St.BoxLayout({ style_class: 'codex-monitor-graph-x-axis' });
  for (let index = 0; index < 3; index += 1) {
    view._xAxis.add_child(new St.Label({
      text: '—',
      style_class: 'codex-monitor-graph-axis-label',
      x_expand: true,
      x_align: index === 0
        ? Clutter.ActorAlign.START
        : index === 2 ? Clutter.ActorAlign.END : Clutter.ActorAlign.CENTER,
    }));
  }
  view.add_child(view._xAxis);
  view._legend = new St.BoxLayout({
    vertical: false,
    style_class: options.legendStyleClass || 'codex-monitor-graph-legend',
  });
  view.add_child(view._legend);
  view._empty = new St.Label({
    text: '',
    style_class: 'codex-monitor-graph-empty',
    x_align: Clutter.ActorAlign.CENTER,
  });
  view.add_child(view._empty);
  view._hover = new St.Label({
    text: '',
    style_class: 'codex-monitor-graph-detail',
  });
  view.add_child(view._hover);
  return view;
};

function _updateAxis(actor, axis) {
  for (const child of actor.get_children())
    child.destroy();
  const ticks = axis && Array.isArray(axis.ticks) ? axis.ticks : [
    { label: '—' }, { label: '' }, { label: '' }, { label: '' }, { label: '—' },
  ];
  for (const tick of ticks) {
    actor.add_child(new St.Label({
      text: tick.label || '',
      style_class: 'codex-monitor-graph-axis-label',
      y_expand: true,
    }));
  }
}

var updateQuotaGraph = function(view, payload) {
  const data = payload || {};
  const series = data.series || [];
  const axes = data.axes || { x: data.axis || [], left: null, right: null };
  const axis = axes.x || [];
  view._area._hoverTimestamp = null;
  view._area._series = series;
  view._area._resetMarkers = data.resetMarkers || [];
  view._area._axes = axes;
  view._area._minimum = axis.length > 0 ? Number(axis[0].timestamp) : 0;
  view._area._maximum = axis.length > 0
    ? Math.max(view._area._minimum + 1, Number(axis[axis.length - 1].timestamp))
    : 1;
  view._area._collectionStart = axes.domain &&
    Number.isFinite(Number(axes.domain.collectionStart))
    ? Number(axes.domain.collectionStart) : null;
  view._area._uncollectedText = data.uncollectedText || '';
  view._hoverFormatter = data.hoverFormatter || null;
  view._defaultDetail = data.defaultDetail || '';
  view._hover.set_text(view._defaultDetail);
  view._area.set_accessible_name(data.accessibleName || view._defaultDetail);

  const xLabels = view._xAxis.get_children();
  xLabels.forEach((label, index) => label.set_text(axis[index] ? axis[index].label : '—'));
  _updateAxis(view._leftAxis, data.axes && data.axes.left);
  _updateAxis(view._rightAxis, data.axes && data.axes.right);
  view._rightAxis.visible = Boolean(data.axes && data.axes.right);
  if (view._rightAxis.visible)
    view.add_style_class_name('codex-monitor-graph-dual-axis');
  else
    view.remove_style_class_name('codex-monitor-graph-dual-axis');
  for (const child of view._legend.get_children())
    child.destroy();
  for (const item of data.legend || []) {
    const label = new St.Label({
      text: item.text,
      style_class: `codex-monitor-graph-legend-item codex-monitor-graph-color-${item.colorIndex}`,
      x_expand: true,
    });
    view._legend.add_child(label);
  }
  if ((data.resetMarkers || []).length > 0) {
    view._legend.add_child(new St.Label({
      text: data.resetKey || '',
      style_class: 'codex-monitor-graph-legend-item codex-monitor-graph-reset-key',
    }));
  }

  const counts = series.map(item => item.points.length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  view._empty.set_text(total === 0
    ? data.emptyText || ''
    : counts.every(count => count <= 1) ? data.collectingText || '' : '');
  view._empty.visible = Boolean(view._empty.get_text());
  view._area.queue_repaint();
};

function _drawResetMarkers(context, area, markers, xFor, padding, height, foreground,
    minimum, maximum) {
  context.setDash([4, 4], 0);
  context.setSourceRGBA(..._rgba(foreground, 0.28));
  for (const marker of markers) {
    if (marker < minimum || marker > maximum)
      continue;
    const x = xFor(marker);
    context.moveTo(x, padding);
    context.lineTo(x, height - padding);
    context.stroke();
    context.setDash([], 0);
    context.setSourceRGBA(..._rgba(foreground, 0.72));
    context.setFontSize(9);
    context.moveTo(Math.min(area.get_surface_size()[0] - 10, x + 2), padding + 9);
    context.showText('R');
    context.setDash([4, 4], 0);
    context.setSourceRGBA(..._rgba(foreground, 0.28));
  }
  context.stroke();
  context.setDash([], 0);
}

function _drawQuotaSteps(context, series, xFor, yFor, color) {
  context.setSourceRGBA(..._rgba(color, 0.95));
  context.setLineCap(Cairo.LineCap.ROUND);
  context.setLineJoin(Cairo.LineJoin.ROUND);
  context.setLineWidth(2);
  const segments = series.segments || [series.points || []];
  for (const segment of segments) {
    if (segment.length === 0)
      continue;
    const first = segment[0];
    context.moveTo(xFor(first.timestamp), yFor(first.usedPercent ?? first.value));
    for (let index = 1; index < segment.length; index += 1) {
      const previous = segment[index - 1];
      const point = segment[index];
      const x = xFor(point.timestamp);
      const previousY = yFor(previous.usedPercent ?? previous.value);
      const y = yFor(point.usedPercent ?? point.value);
      context.lineTo(x, previousY);
      context.lineTo(x, y);
    }
    context.stroke();
    if (segment.length === 1) {
      context.arc(
        xFor(first.timestamp),
        yFor(first.usedPercent ?? first.value),
        2.5, 0, Math.PI * 2
      );
      context.fill();
    }
  }
}

function _drawQuotaArea(context, series, xFor, yFor, bottom, color) {
  const segments = series.segments || [series.points || []];
  context.setSourceRGBA(..._rgba(color, 0.12));
  for (const segment of segments) {
    if (segment.length < 2)
      continue;
    const first = segment[0];
    const last = segment[segment.length - 1];
    context.moveTo(xFor(first.timestamp), bottom);
    context.lineTo(xFor(first.timestamp), yFor(first.usedPercent ?? first.value));
    for (let index = 1; index < segment.length; index += 1) {
      const previous = segment[index - 1];
      const point = segment[index];
      const x = xFor(point.timestamp);
      context.lineTo(x, yFor(previous.usedPercent ?? previous.value));
      context.lineTo(x, yFor(point.usedPercent ?? point.value));
    }
    context.lineTo(xFor(last.timestamp), bottom);
    context.closePath();
    context.fill();
  }
}

function _drawQuotaEndpoint(context, series, xFor, yFor, color) {
  const points = series.points || [];
  if (points.length === 0)
    return;
  const point = points[points.length - 1];
  const x = xFor(point.timestamp);
  const y = yFor(point.usedPercent ?? point.value);
  context.setSourceRGBA(..._rgba(color, 0.95));
  context.arc(x, y, 3.5, 0, Math.PI * 2);
  context.fill();
}

function _drawActivityBars(context, series, xFor, yFor, plotWidth, bottom, color) {
  const points = series.points || [];
  if (points.length === 0)
    return;
  const barWidth = Math.max(3, Math.min(18, plotWidth / Math.max(3, points.length) * 0.68));
  context.setSourceRGBA(..._rgba(color, 0.72));
  for (const point of points) {
    const x = xFor(point.timestamp);
    const y = yFor(point.tokens);
    context.rectangle(x - barWidth / 2, y, barWidth, Math.max(1, bottom - y));
  }
  context.fill();
}

function _drawUncollectedHistory(context, startX, padding, width, height,
    foreground, hasHistory, label) {
  const boundary = Math.max(padding, Math.min(width - padding, startX));
  const shadedWidth = boundary - padding;
  if (shadedWidth <= 0)
    return;
  context.setSourceRGBA(..._rgba(foreground, 0.045));
  context.rectangle(padding, padding, shadedWidth, height - padding * 2);
  context.fill();
  context.save();
  context.rectangle(padding, padding, shadedWidth, height - padding * 2);
  context.clip();
  context.setLineWidth(1);
  context.setSourceRGBA(..._rgba(foreground, 0.08));
  for (let x = padding - height; x < boundary; x += 12) {
    context.moveTo(x, height - padding);
    context.lineTo(x + height, padding);
  }
  context.stroke();
  context.restore();
  if (hasHistory) {
    context.setDash([3, 3], 0);
    context.setSourceRGBA(..._rgba(foreground, 0.38));
    context.moveTo(boundary, padding);
    context.lineTo(boundary, height - padding);
    context.stroke();
    context.setDash([], 0);
  }
  if (shadedWidth >= 90 && label) {
    context.setSourceRGBA(..._rgba(foreground, 0.48));
    context.setFontSize(10);
    context.moveTo(padding + 8, padding + 14);
    context.showText(label);
  }
}

function _drawQuotaGraph(area) {
  const context = area.get_context();
  const [width, height] = area.get_surface_size();
  const padding = 6;
  const plotWidth = Math.max(1, width - padding * 2);
  const plotHeight = Math.max(1, height - padding * 2);
  const foreground = area.get_theme_node().get_foreground_color();
  const colors = [
    _themeColor(area, '-graph-five-hour-color', foreground),
    _themeColor(area, '-graph-weekly-color', foreground),
    _themeColor(area, '-graph-activity-color', foreground),
  ];

  context.setLineWidth(1);
  context.setSourceRGBA(..._rgba(foreground, 0.14));
  for (let index = 0; index <= 4; index += 1) {
    const y = padding + plotHeight * index / 4;
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
  }
  context.stroke();

  const minimum = Number(area._minimum);
  const maximum = Math.max(Number(area._maximum), minimum + 1);
  const xFor = timestamp => padding + ((timestamp - minimum) / (maximum - minimum)) * plotWidth;
  const timestamps = area._series.flatMap(series => series.points.map(point => point.timestamp));
  const collectionStart = Number.isFinite(area._collectionStart)
    ? area._collectionStart : maximum;
  _drawUncollectedHistory(
    context, xFor(collectionStart), padding, width, height, foreground,
    timestamps.length > 0, area._uncollectedText
  );
  if (timestamps.length === 0) {
    context.$dispose();
    return;
  }

  const axes = area._axes || {};
  const quotaMaximum = Number(axes.left && axes.left.maximum) || 100;
  const tokenAxis = axes.right || axes.left;
  const tokenMaximum = Number(tokenAxis && tokenAxis.maximum) || 1;
  const yForQuota = value => padding + plotHeight *
    (1 - Math.max(0, Math.min(quotaMaximum, Number(value) || 0)) / quotaMaximum);
  const yForTokens = value => padding + plotHeight *
    (1 - Math.max(0, Math.min(tokenMaximum, Number(value) || 0)) / tokenMaximum);

  area._series.forEach((series, seriesIndex) => {
    if (series.kind !== 'activity')
      return;
    const colorIndex = Number.isInteger(series.colorIndex) ? series.colorIndex : seriesIndex;
    _drawActivityBars(
      context, series, xFor, yForTokens, plotWidth, height - padding,
      colors[colorIndex % colors.length]
    );
  });
  area._series.forEach((series, seriesIndex) => {
    if (series.kind === 'activity')
      return;
    const colorIndex = Number.isInteger(series.colorIndex) ? series.colorIndex : seriesIndex;
    _drawQuotaArea(
      context, series, xFor, yForQuota, height - padding,
      colors[colorIndex % colors.length]
    );
  });
  _drawResetMarkers(
    context, area, area._resetMarkers, xFor, padding, height, foreground,
    minimum, maximum
  );
  area._series.forEach((series, seriesIndex) => {
    if (series.kind === 'activity')
      return;
    const colorIndex = Number.isInteger(series.colorIndex) ? series.colorIndex : seriesIndex;
    _drawQuotaSteps(
      context, series, xFor, yForQuota, colors[colorIndex % colors.length]
    );
    _drawQuotaEndpoint(
      context, series, xFor, yForQuota, colors[colorIndex % colors.length]
    );
  });
  if (Number.isFinite(area._hoverTimestamp)) {
    const x = xFor(area._hoverTimestamp);
    context.setLineWidth(1);
    context.setSourceRGBA(..._rgba(foreground, 0.5));
    context.moveTo(x, padding);
    context.lineTo(x, height - padding);
    context.stroke();
  }
  context.$dispose();
}
