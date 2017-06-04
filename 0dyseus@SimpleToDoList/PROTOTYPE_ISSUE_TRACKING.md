## Applet status

- Applet ready to be published. Estimated date of publishing: **May 29, 2017**.
- Applet ready to be translated.

## Description

Simple ToDo List is an applet based on two gnome-shell extensions ([Todo list](https://github.com/bsaleil/todolist-gnome-shell-extension) and [Section Todo List](https://github.com/tomMoral/ToDoList)). It allows to create simple ToDo lists from a menu on the panel.

## Tested environments

* [x] ![Cinnamon 2.8](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-2.8.svg)
* [x] ![Cinnamon 3.0](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.0.svg)
* [x] ![Cinnamon 3.2](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.2.svg)
* [x] ![Cinnamon 3.4](https://odyseus.github.io/CinnamonTools/lib/badges/cinn-3.4.svg)

### Applet usage and features

The usage of this applet is very simple. Each task list is represented by a sub menu and each sub menu item inside a sub menu represents a task.

- To add a new tasks list, simply focus the **New tasks list...** entry, give a name to the tasks list and press <kbd>Enter</kbd>.
- To add a new task, simply focus the **New task...** entry, give a name to the task and press <kbd>Enter</kbd>.
- All tasks lists and tasks can be edited in-line.
- Tasks can be marked as completed by changing the checked state of their sub menu items.
- Each tasks list can have its own settings for sorting tasks (by name and/or by completed state), remove task button visibility and completed tasks visibility.
- Each tasks list can be saved as individual TODO files and also can be exported into a file for backup purposes.
- Tasks can be reordered by simply dragging them inside the tasks list they belong to (only if all automatic sorting options for the tasks list are disabled).
- Tasks can be deleted by simply pressing the delete task button (if visible).
- Colorized priority tags support. The background and text colors of a task can be colorized depending on the @tag found inside the task text.
- Configurable hotkey to open/close the menu.
- Read the tooltips of each option on this applet settings window for more details.

### Keyboard shortcuts

The keyboard navigation inside this applet menu is very similar to the keyboard navigation used by any other menu on Cinnamon. But it's slightly changed to facilitate tasks and sections handling and edition.

##### When the focus is on a task

- <kbd>Ctrl</kbd> + <kbd>Spacebar</kbd>: Toggle the completed (checked) state of a task.
- <kbd>Shift</kbd> + <kbd>Delete</kbd>: Deletes a task and focuses the element above of the deleted task.
- <kbd>Alt</kbd> + <kbd>Delete</kbd>: Deletes a task and focuses the element bellow the deleted task.
- <kbd>Ctrl</kbd> + <kbd>Arrow Up</kbd> or <kbd>Ctrl</kbd> + <kbd>Arrow Down</kbd>: Moves a task inside its tasks list.
- <kbd>Insert</kbd>: Will focus the "New task..." entry of the currently opened task section.

##### When the focus is on a task section

- <kbd>Arrow Left</kbd> and <kbd>Arrow Right</kbd>: If the tasks list (sub menu) is closed, these keys will open the sub menu. If the sub menu is open, these keys will move the cursor inside the sub menu label to allow the edition of the section text.
- <kbd>Insert</kbd>: Will focus the "New task..." entry inside the task section. If the task section sub menu isn't open, it will be opened.

##### When the focus is on the "New task..." entry

- <kbd>Ctrl</kbd> + <kbd>Spacebar</kbd>: Toggles the visibility of the tasks list options menu.

### Known issues

- **Hovering over items inside the menu doesn't highlight menu items nor sub menus:** This is actually a desired feature. Allowing the items to highlight on mouse hover would cause the entries to loose focus, resulting in the impossibility to keep typing text inside them and constantly forcing us to move the mouse cursor to regain focus.
- **Task entries look wrong:** Task entries on this applet have the ability to wrap its text in case one sets a fixed width for them. They also can be multi line (<kbd>Shift</kbd> + <kbd>Enter</kbd> inside an entry will create a new line). Some Cinnamon themes, like the default Mint-X family of themes, set a fixed width and a fixed height for entries inside menus. These fixed sizes makes it impossible to programmatically set a desired width for the entries (at least, I couldn't find a way to do it). And the fixed height doesn't allow the entries to expand, completely breaking the entries capability to wrap its text and to be multi line. The only way to fix this (that I could find) is by editing the Cinnamon theme that one is using and remove those fixed sizes. The CSS selectors that needs to be edited are **.menu StEntry**, **.menu StEntry:focus**, **.popup-menu StEntry** and **.popup-menu StEntry:focus**. Depending on the Cinnamon version the theme was created for, one might find just the first two selectors or the last two or all of them. The CSS properties that need to be edited are **width** and **height**. They could be removed, but the sensible thing to do is to rename them to **min-width** and **min-height** respectively. After editing the theme's file and restarting Cinnamon, the entries inside this applet will look and work like they should.

## Images

![screenshot](https://cloud.githubusercontent.com/assets/3822556/25260927/90d078ba-2625-11e7-9ed5-6ada5a8fe5ae.png)

## Issue reports

**Issue reporters should adjunct the output of the following commands.**
**Check the content of the log files for sensible information BEFORE running the commands!!!**

`inxi -xxxSc0 -! 31`
`pastebin ~/.cinnamon/glass.log`
`pastebin ~/.xsession-errors`

## [Download Simple ToDo List applet](https://odyseus.github.io/CinnamonTools/pkg/0dyseus@SimpleToDoList.tar.gz)

## References to anyone that could be interested in testing the applet

@buzz @copecu @fortalezense @maladro1t @NikoKrause @Radek71 @sphh @DamienNZ @muzena @eson57 @giwhub
