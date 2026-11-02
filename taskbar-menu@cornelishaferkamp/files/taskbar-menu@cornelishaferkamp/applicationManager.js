/*
 * Taskbar Menu
 * Copyright (C) 2026 Cornelis Haferkamp
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3.
 */

const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;

var ApplicationManagerDialog = class ApplicationManagerDialog {
    constructor(
        existingDesktopIds,
        onApplicationsSelected,
        onClosed
    ) {
        this._initialDesktopIds = new Set(
            existingDesktopIds || []
        );

        this._selectedDesktopIds = new Set(
            existingDesktopIds || []
        );

        this._onApplicationsSelected =
            onApplicationsSelected;

        this._onClosed = onClosed;

        this._selectedCategory = null;
        this._categoryButtons = [];

        this._dragging = false;
        this._stageDragSignalId = 0;
        this._dragMonitor = null;

        this._dragStartPointerX = 0;
        this._dragStartPointerY = 0;
        this._dragStartActorX = 0;
        this._dragStartActorY = 0;
        this._dragStartTranslationX = 0;
        this._dragStartTranslationY = 0;

        this._dialog = new ModalDialog.ModalDialog({
            styleClass: "taskbar-menu-application-dialog",
            destroyOnClose: true
        });

        this._dialog.connect("closed", () => {
            this._stopDragging();

            if (typeof this._onClosed === "function") {
                this._onClosed();
            }
        });

        const menuData = this._loadMenuData();

        this._applications = menuData.applications;
        this._categories = menuData.categories;

        this._buildInterface();
        this._showApplications();
        this._updateSelectionState();
    }

    _loadMenuData() {
        const appSystem =
            Cinnamon.AppSystem.get_default();

        const applicationMap = new Map();
        const categories = [];

        const tree = appSystem.get_tree();

        const rootDirectory =
            tree.get_root_directory();

        const iterator =
            rootDirectory.iter();

        let itemType;

        while (
            (itemType = iterator.next()) !==
            CMenu.TreeItemType.INVALID
        ) {
            if (
                itemType !==
                CMenu.TreeItemType.DIRECTORY
            ) {
                continue;
            }

            const directory =
                iterator.get_directory();

            if (
                directory.get_is_nodisplay()
            ) {
                continue;
            }

            const categoryId =
                directory.get_menu_id();

            const hasApplications =
                this._loadDirectory(
                    directory,
                    categoryId,
                    applicationMap,
                    appSystem
                );

            if (hasApplications) {
                categories.push({
                    id: categoryId,
                    name: directory.get_name(),
                    icon: directory.get_icon()
                });
            }
        }

        categories.sort(
            (first, second) =>
                first.name.localeCompare(
                    second.name
                )
        );

        const applications =
            Array.from(
                applicationMap.values()
            );

        applications.sort(
            (first, second) =>
                first.app
                    .get_name()
                    .localeCompare(
                        second.app.get_name()
                    )
        );

        return {
            applications,
            categories
        };
    }

    _loadDirectory(
        directory,
        topCategoryId,
        applicationMap,
        appSystem
    ) {
        const iterator =
            directory.iter();

        let hasApplications = false;
        let itemType;

        while (
            (itemType = iterator.next()) !==
            CMenu.TreeItemType.INVALID
        ) {
            if (
                itemType ===
                CMenu.TreeItemType.ENTRY
            ) {
                const entry =
                    iterator.get_entry();

                const desktopId =
                    entry.get_desktop_file_id();

                const app =
                    appSystem.lookup_app(
                        desktopId
                    );

                if (
                    !app ||
                    app.get_nodisplay()
                ) {
                    continue;
                }

                hasApplications = true;

                if (
                    !applicationMap.has(
                        desktopId
                    )
                ) {
                    applicationMap.set(
                        desktopId,
                        {
                            app,
                            desktopId,
                            categories: []
                        }
                    );
                }

                const application =
                    applicationMap.get(
                        desktopId
                    );

                if (
                    !application.categories.includes(
                        topCategoryId
                    )
                ) {
                    application.categories.push(
                        topCategoryId
                    );
                }
            } else if (
                itemType ===
                CMenu.TreeItemType.DIRECTORY
            ) {
                const childHasApplications =
                    this._loadDirectory(
                        iterator.get_directory(),
                        topCategoryId,
                        applicationMap,
                        appSystem
                    );

                if (
                    childHasApplications
                ) {
                    hasApplications = true;
                }
            }
        }

        return hasApplications;
    }

    _buildInterface() {
        const contentBox =
            new St.BoxLayout({
                vertical: true,
                width: 700,
                height: 530,
                style: "spacing: 10px;"
            });

        this._titleBar =
            new St.Button({
                reactive: true,
                track_hover: true,
                x_expand: true,
                style:
                    "padding: 8px 10px; " +
                    "border-radius: 6px; " +
                    "background-color: rgba(255,255,255,0.08);"
            });

        const titleRow =
            new St.BoxLayout({
                vertical: false,
                x_expand: true,
                style: "spacing: 9px;"
            });

        const dragIcon =
            new St.Icon({
                icon_name:
                    "openhand-symbolic",
                icon_size: 20
            });

        const title =
            new St.Label({
                text: "Manage applications",
                style_class: "dialog-title",
                x_align:
                    Clutter.ActorAlign.START,
                y_align:
                    Clutter.ActorAlign.CENTER,
                x_expand: true
            });

        titleRow.add_child(
            dragIcon
        );

        titleRow.add_child(
            title
        );

        this._titleBar.set_child(
            titleRow
        );

        this._titleBar.connect(
            "button-press-event",
            (actor, event) =>
                this._startDragging(
                    event
                )
        );

        contentBox.add_child(
            this._titleBar
        );

        this._searchEntry =
            new St.Entry({
                hint_text:
                    "Search applications…",
                can_focus: true,
                track_hover: true,
                x_expand: true
            });

        this._searchEntry
            .clutter_text
            .connect(
                "text-changed",
                () =>
                    this._showApplications()
            );

        contentBox.add_child(
            this._searchEntry
        );

        const listsBox =
            new St.BoxLayout({
                vertical: false,
                x_expand: true,
                style: "spacing: 12px;"
            });

        const categoryScrollView =
            new St.ScrollView({
                width: 205,
                height: 340
            });

        categoryScrollView.set_policy(
            St.PolicyType.NEVER,
            St.PolicyType.AUTOMATIC
        );

        this._categoryBox =
            new St.BoxLayout({
                vertical: true,
                width: 185,
                style: "spacing: 2px;"
            });

        categoryScrollView.add_actor(
            this._categoryBox
        );

        const applicationScrollView =
            new St.ScrollView({
                width: 470,
                height: 340
            });

        applicationScrollView.set_policy(
            St.PolicyType.NEVER,
            St.PolicyType.AUTOMATIC
        );

        this._applicationBox =
            new St.BoxLayout({
                vertical: true,
                width: 448,
                style: "spacing: 2px;"
            });

        applicationScrollView.add_actor(
            this._applicationBox
        );

        listsBox.add_child(
            categoryScrollView
        );

        listsBox.add_child(
            applicationScrollView
        );

        contentBox.add_child(
            listsBox
        );

        this._selectionCountLabel =
            new St.Label({
                text: "",
                x_align:
                    Clutter.ActorAlign.START,
                style:
                    "font-weight: bold; " +
                    "padding: 2px 2px 0px 2px;"
            });

        contentBox.add_child(
            this._selectionCountLabel
        );

        this._selectionScrollView =
            new St.ScrollView({
                width: 680,
                height: 62
            });

        this._selectionScrollView.set_policy(
            St.PolicyType.NEVER,
            St.PolicyType.AUTOMATIC
        );

        this._selectionContentBox =
            new St.BoxLayout({
                vertical: true,
                width: 660,
                style:
                    "padding: 2px 4px;"
            });

        this._selectionScrollView.add_actor(
            this._selectionContentBox
        );

        contentBox.add_child(
            this._selectionScrollView
        );

        this._createCategoryButton(
            null,
            "All applications",
            "view-grid-symbolic"
        );

        for (
            const category of
            this._categories
        ) {
            this._createCategoryButton(
                category.id,
                category.name,
                category.icon
            );
        }

        this._dialog
            .contentLayout
            .add_child(
                contentBox
            );

        this._dialog.addButton({
            label: "Cancel",

            action: () =>
                this._dialog.close(),

            key:
                Clutter.KEY_Escape
        });

        this._applyButton =
            this._dialog.addButton({
                label: "Apply",

                action: () =>
                    this._confirmSelection(),

                key:
                    Clutter.KEY_Return,

                default: true
            });

        this._setApplyButtonEnabled(
            false
        );

        this._dialog
            .setInitialKeyFocus(
                this._searchEntry
            );
    }

    _createCategoryButton(
        categoryId,
        name,
        iconValue
    ) {
        const button =
            new St.Button({
                reactive: true,
                can_focus: true,
                track_hover: true,
                width: 183,
                height: 40,
                style_class:
                    "popup-menu-item"
            });

        const rowBox =
            new St.BoxLayout({
                vertical: false,
                width: 171,
                height: 40,
                style:
                    "padding: 4px 6px; " +
                    "spacing: 8px;"
            });

        let icon;

        if (
            typeof iconValue ===
            "string"
        ) {
            icon =
                new St.Icon({
                    icon_name:
                        iconValue,
                    icon_size: 22
                });
        } else if (iconValue) {
            icon =
                new St.Icon({
                    gicon:
                        iconValue,
                    icon_size: 22
                });
        } else {
            icon =
                new St.Icon({
                    icon_name:
                        "folder-symbolic",
                    icon_size: 22
                });
        }

        const iconColumn =
            new St.Bin({
                width: 28,
                height: 32,
                x_align:
                    St.Align.MIDDLE,
                y_align:
                    St.Align.MIDDLE
            });

        iconColumn.set_child(
            icon
        );

        const label =
            new St.Label({
                text: name,

                y_align:
                    Clutter.ActorAlign.CENTER,

                x_align:
                    Clutter.ActorAlign.START,

                x_expand: true
            });

        rowBox.add_child(
            iconColumn
        );

        rowBox.add_child(
            label
        );

        button.set_child(
            rowBox
        );

        button.connect(
            "clicked",
            () => {
                this._selectedCategory =
                    categoryId;

                this._searchEntry
                    .set_text("");

                this._updateCategorySelection(
                    button
                );

                this._showApplications();
            }
        );

        this._categoryButtons.push(
            button
        );

        this._categoryBox.add_child(
            button
        );

        if (categoryId === null) {
            button
                .add_style_pseudo_class(
                    "selected"
                );
        }

        return button;
    }

    _updateCategorySelection(
        selectedButton
    ) {
        for (
            const button of
            this._categoryButtons
        ) {
            button
                .remove_style_pseudo_class(
                    "selected"
                );
        }

        selectedButton
            .add_style_pseudo_class(
                "selected"
            );
    }

    _showApplications() {
        this._applicationBox
            .destroy_all_children();

        const searchText =
            this._searchEntry
                .get_text()
                .trim()
                .toLocaleLowerCase();

        const searching =
            searchText.length > 0;

        for (
            const application of
            this._applications
        ) {
            if (
                !searching &&
                this._selectedCategory !==
                    null &&
                !application.categories.includes(
                    this._selectedCategory
                )
            ) {
                continue;
            }

            const name =
                application.app
                    .get_name()
                    .toLocaleLowerCase();

            const description = (
                application.app
                    .get_description() ||
                ""
            ).toLocaleLowerCase();

            const desktopId =
                application.desktopId
                    .toLocaleLowerCase();

            if (
                searching &&
                !name.includes(
                    searchText
                ) &&
                !description.includes(
                    searchText
                ) &&
                !desktopId.includes(
                    searchText
                )
            ) {
                continue;
            }

            this._applicationBox
                .add_child(
                    this._createApplicationRow(
                        application
                    )
                );
        }
    }

    _createApplicationRow(
        application
    ) {
        const selected =
            this._selectedDesktopIds
                .has(
                    application.desktopId
                );

        const button =
            new St.Button({
                reactive: true,
                can_focus: true,
                track_hover: true,
                width: 446,
                height: 42,
                style_class:
                    "popup-menu-item"
            });

        const rowBox =
            new St.BoxLayout({
                vertical: false,
                width: 434,
                height: 42,
                style:
                    "padding: 4px 6px; " +
                    "spacing: 8px;"
            });

        const checkLabel =
            new St.Label({
                text:
                    selected
                        ? "☑"
                        : "☐",

                y_align:
                    Clutter.ActorAlign.CENTER,

                x_align:
                    Clutter.ActorAlign.CENTER
            });

        const checkColumn =
            new St.Bin({
                width: 24,
                height: 34,
                x_align:
                    St.Align.MIDDLE,
                y_align:
                    St.Align.MIDDLE
            });

        checkColumn.set_child(
            checkLabel
        );

        const icon =
            application.app
                .create_icon_texture(
                    28
                );

        const iconColumn =
            new St.Bin({
                width: 32,
                height: 34,
                x_align:
                    St.Align.MIDDLE,
                y_align:
                    St.Align.MIDDLE
            });

        iconColumn.set_child(
            icon
        );

        const label =
            new St.Label({
                text:
                    application.app
                        .get_name(),

                y_align:
                    Clutter.ActorAlign.CENTER,

                x_align:
                    Clutter.ActorAlign.START,

                x_expand: true
            });

        rowBox.add_child(
            checkColumn
        );

        rowBox.add_child(
            iconColumn
        );

        rowBox.add_child(
            label
        );

        button.set_child(
            rowBox
        );

        if (selected) {
            button
                .add_style_pseudo_class(
                    "selected"
                );
        }

        button.connect(
            "clicked",
            () => {
                this._toggleApplicationSelection(
                    application,
                    checkLabel,
                    button
                );
            }
        );

        return button;
    }

    _toggleApplicationSelection(
        application,
        checkLabel,
        button
    ) {
        const desktopId =
            application.desktopId;

        if (
            this._selectedDesktopIds.has(
                desktopId
            )
        ) {
            this._selectedDesktopIds.delete(
                desktopId
            );

            checkLabel.set_text(
                "☐"
            );

            button
                .remove_style_pseudo_class(
                    "selected"
                );
        } else {
            this._selectedDesktopIds.add(
                desktopId
            );

            checkLabel.set_text(
                "☑"
            );

            button
                .add_style_pseudo_class(
                    "selected"
                );
        }

        this._updateSelectionState();
    }

    _getCategoryForSummary(
        application
    ) {
        if (
            !application.categories ||
            application.categories.length === 0
        ) {
            return {
                id: null,
                name: "Other"
            };
        }

        const categoryId =
            application.categories[0];

        const category =
            this._categories.find(
                item =>
                    item.id ===
                    categoryId
            );

        if (!category) {
            return {
                id: null,
                name: "Other"
            };
        }

        return category;
    }

    _buildSelectionMarkup(
        selectedApplications
    ) {
        if (
            selectedApplications.length === 0
        ) {
            return "";
        }

        const groups =
            new Map();

        for (
            const application of
            selectedApplications
        ) {
            const category =
                this._getCategoryForSummary(
                    application
                );

            if (
                !groups.has(
                    category.name
                )
            ) {
                groups.set(
                    category.name,
                    []
                );
            }

            groups
                .get(category.name)
                .push(
                    application
                        .app
                        .get_name()
                );
        }

        const categoryNames =
            Array.from(
                groups.keys()
            );

        categoryNames.sort(
            (first, second) =>
                first.localeCompare(
                    second
                )
        );

        const parts = [];

        for (
            const categoryName of
            categoryNames
        ) {
            const programNames =
                groups.get(
                    categoryName
                );

            programNames.sort(
                (first, second) =>
                    first.localeCompare(
                        second
                    )
            );

            const escapedCategory =
                GLib.markup_escape_text(
                    categoryName,
                    -1
                );

            const escapedPrograms =
                programNames
                    .map(name =>
                        GLib.markup_escape_text(
                            name,
                            -1
                        )
                    )
                    .join(", ");

            parts.push(
                `<b>${escapedCategory}</b> = ${escapedPrograms}`
            );
        }

        return parts.join(
            "  |  "
        );
    }

    _createSelectionDetailsLabel(
        markup
    ) {
        const label =
            new St.Label({
                text: "",
                x_align:
                    Clutter.ActorAlign.START,
                x_expand: true
            });

        label.clutter_text.line_wrap =
            true;

        label.clutter_text.line_wrap_mode =
            Pango.WrapMode.WORD_CHAR;

        label.clutter_text.ellipsize =
            Pango.EllipsizeMode.NONE;

        label.clutter_text.set_markup(
            markup
        );

        return label;
    }

    _rebuildSelectionDetails(
        selectedApplications
    ) {
        this._selectionContentBox
            .destroy_all_children();

        if (
            selectedApplications.length ===
            0
        ) {
            return;
        }

        const markup =
            this._buildSelectionMarkup(
                selectedApplications
            );

        const newLabel =
            this._createSelectionDetailsLabel(
                markup
            );

        this._selectionContentBox
            .add_child(
                newLabel
            );

        this._selectionDetailsLabel =
            newLabel;

        this._selectionContentBox
            .queue_relayout();

        this._selectionScrollView
            .queue_relayout();
    }

    _updateSelectionState() {
        const selectedApplications =
            this._applications.filter(
                application =>
                    this._selectedDesktopIds.has(
                        application.desktopId
                    )
            );

        const count =
            selectedApplications.length;

        if (count === 0) {
            this._selectionCountLabel
                .set_text(
                    "No applications in this menu"
                );
        } else {
            const word =
                count === 1
                    ? "application in this menu"
                    : "applications in this menu";

            this._selectionCountLabel
                .set_text(
                    `${count} ${word}`
                );
        }

        this._rebuildSelectionDetails(
            selectedApplications
        );

        if (
            this._selectionScrollView &&
            this._selectionScrollView.vscroll &&
            this._selectionScrollView
                .vscroll.adjustment
        ) {
            this._selectionScrollView
                .vscroll
                .adjustment
                .set_value(0);
        }

        this._setApplyButtonEnabled(
            this._selectionHasChanged()
        );
    }

    _selectionHasChanged() {
        if (
            this._selectedDesktopIds.size !==
            this._initialDesktopIds.size
        ) {
            return true;
        }

        for (
            const desktopId of
            this._selectedDesktopIds
        ) {
            if (
                !this._initialDesktopIds.has(
                    desktopId
                )
            ) {
                return true;
            }
        }

        return false;
    }

    _setApplyButtonEnabled(
        enabled
    ) {
        if (!this._applyButton) {
            return;
        }

        this._applyButton.reactive =
            enabled;

        this._applyButton.can_focus =
            enabled;

        this._applyButton.opacity =
            enabled
                ? 255
                : 120;
    }

    _confirmSelection() {
        if (
            !this._selectionHasChanged()
        ) {
            return;
        }

        const selectedApplications =
            this._applications
                .filter(
                    application =>
                        this._selectedDesktopIds.has(
                            application.desktopId
                        )
                )
                .map(
                    application => ({
                        desktopId:
                            application.desktopId,

                        name:
                            application.app
                                .get_name()
                    })
                );

        if (
            typeof
                this._onApplicationsSelected ===
            "function"
        ) {
            this._onApplicationsSelected(
                selectedApplications
            );
        }

        this._dialog.close();
    }

    _getMovableDialogActor() {
        if (
            this._dialog.dialogLayout &&
            this._dialog.dialogLayout._dialog
        ) {
            return (
                this._dialog
                    .dialogLayout
                    ._dialog
            );
        }

        return (
            this._dialog.dialogLayout
        );
    }

    _startDragging(event) {
        if (
            event.get_button() !== 1
        ) {
            return (
                Clutter.EVENT_PROPAGATE
            );
        }

        const movableActor =
            this._getMovableDialogActor();

        const [
            pointerX,
            pointerY
        ] =
            event.get_coords();

        const [
            actorX,
            actorY
        ] =
            movableActor
                .get_transformed_position();

        this._dragging = true;

        this._dragStartPointerX =
            pointerX;

        this._dragStartPointerY =
            pointerY;

        this._dragStartActorX =
            actorX;

        this._dragStartActorY =
            actorY;

        this._dragStartTranslationX =
            movableActor.translation_x;

        this._dragStartTranslationY =
            movableActor.translation_y;

        const monitorIndex =
            global.display
                .get_current_monitor();

        this._dragMonitor =
            Main.layoutManager
                .monitors[
                    monitorIndex
                ] ||
            Main.layoutManager
                .primaryMonitor;

        if (
            !this._stageDragSignalId
        ) {
            this._stageDragSignalId =
                global.stage.connect(
                    "captured-event",
                    (
                        actor,
                        capturedEvent
                    ) =>
                        this._handleDragEvent(
                            capturedEvent
                        )
                );
        }

        return (
            Clutter.EVENT_STOP
        );
    }

    _handleDragEvent(event) {
        if (!this._dragging) {
            return (
                Clutter.EVENT_PROPAGATE
            );
        }

        const eventType =
            event.type();

        if (
            eventType ===
            Clutter.EventType.MOTION
        ) {
            const [
                pointerX,
                pointerY
            ] =
                event.get_coords();

            const deltaX =
                pointerX -
                this._dragStartPointerX;

            const deltaY =
                pointerY -
                this._dragStartPointerY;

            const movableActor =
                this._getMovableDialogActor();

            const monitor =
                this._dragMonitor;

            let targetX =
                this._dragStartActorX +
                deltaX;

            let targetY =
                this._dragStartActorY +
                deltaY;

            const minX =
                monitor.x;

            const minY =
                monitor.y;

            const maxX =
                monitor.x +
                monitor.width -
                movableActor.width;

            const maxY =
                monitor.y +
                monitor.height -
                movableActor.height;

            targetX =
                Math.max(
                    minX,
                    Math.min(
                        maxX,
                        targetX
                    )
                );

            targetY =
                Math.max(
                    minY,
                    Math.min(
                        maxY,
                        targetY
                    )
                );

            const translationX =
                this._dragStartTranslationX +
                (
                    targetX -
                    this._dragStartActorX
                );

            const translationY =
                this._dragStartTranslationY +
                (
                    targetY -
                    this._dragStartActorY
                );

            movableActor
                .set_translation(
                    translationX,
                    translationY,
                    0
                );

            return (
                Clutter.EVENT_STOP
            );
        }

        if (
            eventType ===
            Clutter.EventType
                .BUTTON_RELEASE
        ) {
            this._stopDragging();

            return (
                Clutter.EVENT_STOP
            );
        }

        return (
            Clutter.EVENT_PROPAGATE
        );
    }

    _stopDragging() {
        this._dragging = false;

        if (
            this._stageDragSignalId
        ) {
            global.stage.disconnect(
                this._stageDragSignalId
            );

            this._stageDragSignalId =
                0;
        }

        this._dragMonitor = null;
    }

    open() {
        this._dialog.open();
    }
};
