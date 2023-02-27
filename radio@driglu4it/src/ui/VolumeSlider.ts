import { createActivWidget } from "../lib/ActivWidget";
import { createSlider } from "../lib/Slider";
import {
  getVolumeIcon,
  POPUP_ICON_CLASS,
  POPUP_MENU_ITEM_CLASS,
  VOLUME_DELTA,
} from "../consts";
import { mpvHandler } from "../services/mpv/MpvHandler";

const { BoxLayout, Icon, IconType } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;
const { KEY_Right, KEY_Left, ScrollDirection } = imports.gi.Clutter;

export function createVolumeSlider() {
  const {
    getVolume,
    setVolume,
    addVolumeChangeHandler,
    addPlaybackStatusChangeHandler,
  } = mpvHandler;

  const container = new BoxLayout({
    style_class: POPUP_MENU_ITEM_CLASS,
  });

  createActivWidget({
    widget: container,
  });

  const slider = createSlider({
    onValueChanged: (newValue) => setVolume(newValue * 100),
  });

  const tooltip = new Tooltip(slider.actor, null);

  const icon = new Icon({
    icon_type: IconType.SYMBOLIC,
    style_class: POPUP_ICON_CLASS,
    reactive: true,
  });

  [icon, slider.actor].forEach((widget) => {
    container.add_child(widget);
  });

  container.connect("key-press-event", (actor, event) => {
    const key = event.get_key_symbol();

    if (key === KEY_Right || key === KEY_Left) {
      const direction = key === KEY_Right ? "increase" : "decrease";
      handleDeltaChange(direction);
    }

    return false;
  });

  container.connect("scroll-event", (actor, event) => {
    const scrollDirection = event.get_scroll_direction();

    if (scrollDirection === ScrollDirection.UP) {
      handleDeltaChange("increase");
      return false;
    }

    if (scrollDirection === ScrollDirection.DOWN) {
      handleDeltaChange("decrease");
    }

    return false;
  });

  icon.connect("button-press-event", () => {
    slider.setValue(0);

    return false;
  });

  function handleDeltaChange(direction: "increase" | "decrease") {
    const delta = direction === "increase" ? VOLUME_DELTA : -VOLUME_DELTA;
    const newValue = slider.getValue() + delta / 100;
    slider.setValue(newValue);
  }

  const setRefreshVolumeSlider = () => {
    const volume = getVolume();

    if (volume != null) {
      tooltip.set_text(`Volume: ${volume.toString()} %`);
      slider.setValue(volume / 100, true);
      icon.set_icon_name(getVolumeIcon({ volume }));
    }
  };

  [addVolumeChangeHandler, addPlaybackStatusChangeHandler].forEach((cb) =>
    cb(setRefreshVolumeSlider)
  );

  setRefreshVolumeSlider();

  return container;
}
