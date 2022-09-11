import { createAppletContainer } from "../../lib/AppletContainer";
import { mpvHandler } from "../../services/mpv/MpvHandler";
import { createRadioAppletLabel } from "./RadioAppletLabel";
import { createRadioAppletTooltip } from "./RadioAppletTooltip";
import { createRadioAppletIcon } from "./RadioAppletIcon";
import { APPLET_SITE, MPRIS_PLUGIN_PATH, VOLUME_DELTA } from "../../consts";
import { radioPopupMenu, initRadioPopupMenu } from "../RadioPopupMenu/RadioPopupMenu";
import { installMpvWithMpris } from "../../services/mpv/CheckInstallation";
import { createYoutubeDownloadIcon } from "./YoutubeDownloadIcon";
import { notify } from "../../lib/notify";
import { createRadioContextMenu } from "../RadioContextMenu";

const { ScrollDirection } = imports.gi.Clutter;

export function createRadioAppletContainer() {
  let installationInProgress = false;

  const appletContainer = createAppletContainer({
    onMiddleClick: () => mpvHandler.togglePlayPause(),
    onMoved: () => mpvHandler.deactivateAllListener(),
    onRemoved: handleAppletRemoved,
    onClick: handleClick,
    onRightClick: () => {
      radioPopupMenu?.close();
      contextMenu?.toggle();
    },
    onScroll: handleScroll,
  });

  [
    createRadioAppletIcon(),
    createYoutubeDownloadIcon(),
    createRadioAppletLabel(),
  ].forEach((widget) => {
    appletContainer.actor.add_child(widget);
  });

  const tooltip = createRadioAppletTooltip({ appletContainer });

  initRadioPopupMenu({ launcher: appletContainer.actor })

  const contextMenu = createRadioContextMenu({
    launcher: appletContainer.actor,
  });

  radioPopupMenu.connect("notify::visible", () => {
    radioPopupMenu.visible && tooltip.hide();
  });

  function handleAppletRemoved() {
    mpvHandler?.deactivateAllListener();
    mpvHandler?.stop();
  }

  function handleScroll(scrollDirection: imports.gi.Clutter.ScrollDirection) {
    if (scrollDirection === ScrollDirection.UP) {
      mpvHandler.increaseDecreaseVolume(VOLUME_DELTA);
      return;
    }

    if (scrollDirection === ScrollDirection.DOWN) {
      mpvHandler.increaseDecreaseVolume(-VOLUME_DELTA);
    }
  }

  async function handleClick() {
    contextMenu?.close();
    if (installationInProgress) return;

    try {
      installationInProgress = true;
      await installMpvWithMpris();
      radioPopupMenu?.toggle();
    } catch (error) {
      const notificationText = `Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin is located at ${MPRIS_PLUGIN_PATH} and correctly compiled for your environment. Refer to ${APPLET_SITE} (section Known Issues)`;

      notify(notificationText, { transient: false });
      global.logError(error);
    } finally {
      installationInProgress = false;
    }
  }

  return appletContainer;
}
