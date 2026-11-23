/*
 * Taskbar Menu
 * Copyright (C) 2026 Cornelis Haferkamp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const ApplicationManager = require("./applicationManager");

class TaskbarMenuApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.menuName = "New Menu";
        this.displayMode = "both";
        this.menuIcon = "folder-symbolic";
        this.applications = [];

        this._applicationManagerDialog = null;
        this._appSystem = Cinnamon.AppSystem.get_default();

        this.settings = new Settings.AppletSettings(
            this,
            metadata.uuid,
            this.instance_id
        );

        this.settings.bind(
            "menu-name",
            "menuName",
            this._updateAppearance.bind(this)
        );

        this.settings.bind(
            "display-mode",
            "displayMode",
            this._updateAppearance.bind(this)
        );

        this.settings.bind(
            "menu-icon",
            "menuIcon",
            this._updateAppearance.bind(this)
        );

        this.settings.bind(
            "applications",
            "applications",
            this._rebuildMenu.bind(this)
        );

        this._menuManager =
            new PopupMenu.PopupMenuManager(this);

        this.menu =
            new Applet.AppletPopupMenu(
                this,
                orientation
            );

        this._menuManager.addMenu(
            this.menu
        );

        this._updateAppearance();
        this._rebuildMenu();
    }

    _updateAppearance() {
        const name =
            this.menuName ||
            "New Menu";

        const mode =
            this.displayMode ||
            "both";

        const icon =
            this.menuIcon ||
            "folder-symbolic";

        if (
            GLib.path_is_absolute(
                icon
            )
        ) {
            this.set_applet_icon_path(
                icon
            );
        } else {
            this.set_applet_icon_name(
                icon
            );
        }

        this._applet_label.set_style(
            ""
        );

        if (mode === "icon") {
            this.set_applet_label(
                ""
            );

            this._applet_icon_box.show();
        } else if (mode === "text") {
            this.set_applet_label(
                name
            );

            this._applet_icon_box.hide();
        } else {
            this.set_applet_label(
                name
            );

            this._applet_icon_box.show();

            this._applet_label.set_style(
                "margin-left: 7px;"
            );
        }
    }

    _rebuildMenu() {
        if (!this.menu) {
            return;
        }

        this.menu.removeAll();

        if (
            !Array.isArray(
                this.applications
            ) ||
            this.applications.length === 0
        ) {
            const emptyItem =
                new PopupMenu.PopupMenuItem(
                    "No applications added yet"
                );

            emptyItem.setSensitive(
                false
            );

            this.menu.addMenuItem(
                emptyItem
            );

            return;
        }

        for (
            const applicationData of
            this.applications
        ) {
            if (
                !applicationData ||
                !applicationData.desktopId
            ) {
                continue;
            }

            const application =
                this._appSystem.lookup_app(
                    applicationData.desktopId
                );

            if (!application) {
                this._addMissingApplicationItem(
                    applicationData
                );

                continue;
            }

            this._addApplicationItem(
                application,
                applicationData
            );
        }
    }

    _addApplicationItem(
        application,
        applicationData
    ) {
        const item =
            new PopupMenu.PopupBaseMenuItem({
                reactive: true
            });

        const icon =
            application
                .create_icon_texture(
                    22
                );

        const label =
            new St.Label({
                text:
                    applicationData.name ||
                    application.get_name(),

                y_align:
                    Clutter.ActorAlign.CENTER
            });

        item.addActor(
            icon
        );

        item.addActor(
            label
        );

        item.connect(
            "activate",
            () => {
                try {
                    application
                        .open_new_window(
                            -1
                        );

                    this.menu.close();
                } catch (error) {
                    global.logError(
                        error,
                        "[Taskbar Menu] Application could not be launched"
                    );
                }
            }
        );

        this.menu.addMenuItem(
            item
        );
    }

    _addMissingApplicationItem(
        applicationData
    ) {
        const name =
            applicationData.name ||
            applicationData.desktopId ||
            "Unknown application";

        const item =
            new PopupMenu.PopupMenuItem(
                `${name} (not found)`
            );

        item.setSensitive(
            false
        );

        this.menu.addMenuItem(
            item
        );
    }

    openApplicationManager() {
        if (
            this._applicationManagerDialog
        ) {
            return;
        }

        const existingDesktopIds =
            Array.isArray(
                this.applications
            )
                ? this.applications
                    .map(
                        application =>
                            application.desktopId
                    )
                    .filter(Boolean)
                : [];

        this._applicationManagerDialog =
            new ApplicationManager
                .ApplicationManagerDialog(
                    existingDesktopIds,

                    selectedApplications => {
                        this._replaceApplications(
                            selectedApplications
                        );
                    },

                    () => {
                        this._applicationManagerDialog =
                            null;
                    }
                );

        this._applicationManagerDialog
            .open();
    }

    _replaceApplications(
        selectedApplications
    ) {
        const updatedApplications =
            Array.isArray(
                selectedApplications
            )
                ? selectedApplications
                    .filter(
                        application =>
                            application &&
                            application.desktopId
                    )
                    .map(
                        application => ({
                            desktopId:
                                application.desktopId,

                            name:
                                application.name ||
                                application.desktopId
                        })
                    )
                : [];

        this.applications =
            updatedApplications;

        this.settings.setValue(
            "applications",
            updatedApplications
        );

        this._rebuildMenu();
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._applicationManagerDialog =
            null;

        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
    }
}

function main(
    metadata,
    orientation,
    panelHeight,
    instanceId
) {
    return new TaskbarMenuApplet(
        metadata,
        orientation,
        panelHeight,
        instanceId
    );
}
