# 关机菜单（修改版） | Shutdown Menu - change

一个小巧实用的 Cinnamon 面板小工具。  
A small and practical Cinnamon panel applet.

## 📖 简介 | Introduction

这个小程序会在 Cinnamon 面板上添加一个图标，点击后可以快速访问以下系统功能：  
This applet adds an icon to the Cinnamon panel. Clicking it provides quick access to the following system functions:

- **关机**：弹出系统确认对话框  
  **Shut down**: Shows the system confirmation dialog
- **注销**：弹出系统确认对话框  
  **Log out**: Shows the system confirmation dialog
- **锁屏**：立即锁定屏幕（无确认提示）  
  **Lock screen**: Locks the screen immediately (no confirmation)

此外，还提供了一些额外便捷操作：  
In addition, it offers extra handy interactions:

- **鼠标滚轮**：悬停滚动，循环切换工作区（默认关闭）  
  **Mouse wheel**: Hover and scroll to cycle through workspaces (disabled by default)
- **鼠标中键**：显示桌面、呼出工作区选择器（Expo）、窗口选择器（Scale），或切换桌面图标的显示与隐藏  
  **Middle click**: Show the desktop, open workspace selector (Expo) or window selector (Scale), or toggle desktop icons visibility
- **自定义菜单项**：可自由添加任意数量的菜单项，支持从 `.desktop` 文件选择应用或手动添加命令  
  **Custom menu items**: Freely add any number of items, from `.desktop` files or custom commands
- **网格布局**：可将自定义项以图标网格形式展示，适合作为快速启动面板  
  **Grid layout**: Display custom items as an icon grid, ideal as a quick launcher
- **场景预设**：保存整套配置为命名场景，右键菜单或胶囊导航栏一键切换  
  **Scene presets**: Save the whole configuration as named scenes and switch from the right-click menu or capsule navigation bar

---

## ⚙️ 设置 | Settings

### 面板图标 | Panel Icon

- 可自由选择图标（支持系统图标或自定义图片路径）  
  Freely choose an icon (system icons or custom image path supported)
- 可调整图标大小（16–64 像素）  
  Adjust icon size (16–64 pixels)

### 全局设置 | Global Settings

- **菜单项文字大小**：可调整菜单内所有项的文字大小（0 表示使用主题默认值）  
  **Menu item text size**: Adjust the text size of all items in the menu (0 = theme default)
- **菜单项图标大小**：统一调整菜单内所有项的图标大小（16–48 像素）  
  **Menu item icon size**: Uniformly adjust the icon size of all items in the menu (16–48 pixels)
- **菜单项标签最大字符数**：超出部分自动截断并显示省略号  
  **Menu label max chars**: Labels longer than this are truncated with an ellipsis

### 内置菜单项 | Built-in Menu Items

- 勾选对应复选框以添加项目  
  Check the corresponding checkboxes to add items
- **图标可自定义**：为每项输入图标名或通过文件选择器挑选图片，右侧有实时预览图  
  **Custom icon**: Enter an icon name or pick an image file for each item; a live preview is shown next to the picker
- **命令可自定义**：替换默认命令以改变行为  
  **Custom command**: Replace the default command to change behavior
- 支持为关机项下方单独设置分隔线  
  Separately toggle a separator below the shutdown item

### 自定义菜单项 | Custom Menu Items

- **搜索**：工具栏右侧的搜索框支持按名称实时过滤列表（不区分大小写）  
  **Search**: The search box in the toolbar filters the list by name in real time (case-insensitive)
- **从 `.desktop` 添加应用**：点击列表工具栏的 **+** 按钮，打开文件选择器（默认路径 `/usr/share/applications`），选择任意 `.desktop` 文件即可自动提取名称、图标和启动命令  
  **Add from `.desktop`**: Click the **+** button in the list toolbar, choose any `.desktop` file (file chooser opens `/usr/share/applications` by default); name, icon and launch command are auto-extracted
- **一键导入所有应用**：点击全选图标按钮，一键导入系统开始菜单中的所有应用程序（跳过已存在的同名项）。导入的项默认**不勾选**，方便你逐个勾选想显示的程序  
  **Import all apps**: Click the select-all icon button to import all applications from the start menu at once (duplicates are skipped). Imported items are **unchecked by default** so you can selectively enable the ones you want
- **添加自定义命令**：点击文本图标按钮，手动填写名称、图标和命令  
  **Add custom command**: Click the text icon button to manually enter name, icon and command
- **勾选框（Show）**：列表最左侧的勾选框控制该项是否在面板菜单中显示。勾选的项会自动置顶排列，方便查看和管理  
  **Checkbox (Show)**: The checkbox on the leftmost column controls whether the item appears in the panel menu. Checked items are automatically pinned to the top for easy access
- **全选 / 取消全选**：列表下方提供「全选」和「取消全选」按钮，一键切换所有项的勾选状态  
  **Select All / Deselect All**: "Select All" and "Deselect All" buttons below the list toggle all items at once
- **编辑 / 删除 / 上移 / 下移**：工具栏按钮操作选中项  
  **Edit / Remove / Move up / Move down**: Toolbar buttons operate on the selected item
- **分隔线**：将某项的 **名称设为 `-`** 且 **命令留空**，该行即渲染为分隔线（网格模式忽略分隔线）  
  **Separator**: Set an item's **Name to `-`** with an **empty Command**; that row renders as a separator (grid mode ignores separators)
- **位置可选**：自定义项可显示在内置项的上方或下方  
  **Position**: Choose whether custom items appear above or below built-in items
- **分隔线可选**：可控制自定义项与内置项之间是否显示分隔线  
  **Separator between groups**: Toggle whether a separator is shown between custom and built-in items
- **首次运行时自动注入**：默认会添加一个 "Neofetch" 项作为示例，可以随时删除；删除后不会再次自动添加  
  **First-run injection**: A "Neofetch" item is added by default as a sample; it can be deleted and won't come back

### 网格布局 | Grid Layout

- **启用网格模式**：自定义项以图标网格形式显示  
  **Enable grid mode**: Display custom items as an icon grid
- **隐藏内置项**：网格模式下可隐藏关机/注销/锁屏，让菜单成为纯启动器  
  **Hide built-in items**: In grid mode, optionally hide Quit/Logout/Lock so the menu becomes a pure launcher
- **网格列数**：2–8 列  
  **Grid columns**: 2–8
- **单元格宽度 / 高度**：分别控制每格尺寸，0 表示自动  
  **Cell width / height**: Control each cell's size individually; 0 = auto
- **显示文字标签**：在图标下方显示名称  
  **Show labels**: Display names below icons
- **图标大小**：独立于内置项的网格图标尺寸  
  **Grid icon size**: Independent icon size for grid mode
- **文字间距**：图标与文字之间的间距  
  **Label spacing**: Gap between icon and label

### 场景胶囊导航栏 | Scene Capsule Navigation Bar

在全局设置中将"场景快捷切换按钮数"设为 1–5，菜单顶部会显示胶囊导航栏，分段显示各场景名称，当前激活的场景高亮显示。  
Set "Scene quick-switch capsule" to 1–5 in global settings to show a segmented capsule bar at the top of the menu. Each segment displays a scene name; the active scene is highlighted.

- **分段式显示**：每个场景占一个分段，所有分段共享圆角胶囊外框  
  **Segmented display**: Each scene occupies one segment; all segments share a rounded capsule border
- **动态宽度**：胶囊宽度根据场景数量自动调整  
  **Dynamic width**: Capsule width adjusts automatically based on the number of scenes
- **点击切换**：点击任意场景分段即可切换，菜单保持打开状态  
  **Click to switch**: Click any segment to switch scenes; the menu stays open
- **悬停高亮**：鼠标悬停时显示半透明背景  
  **Hover highlight**: A semi-transparent background appears on hover

### 场景预设 | Scene Presets

位于 **Scenes** 页，用来保存或切换整套配置（含面板图标、交互行为、内置项、自定义项、网格选项）。  
Located on the **Scenes** page; used to save or switch the whole configuration (panel icon, interactions, built-in items, custom items, grid options).

- **Default（默认）**：列表中的虚拟项，不写入文件。选中并应用后恢复所有默认值（包括首次注入的 Neofetch 项）  
  **Default**: A virtual entry not written to disk. Applying it resets everything to the defaults (including the initial Neofetch item)
- **保存为新场景**：在名称框输入名字并点击"保存为新场景"，同名则覆盖  
  **Save as new**: Type a name and click "Save as new"; existing scene with the same name is overwritten
- **覆盖保存当前**：选中一个已保存场景，点击 💾 按钮，用当前设置覆盖它  
  **Save current scene**: Select a saved scene and click the 💾 button to overwrite it with the current settings
- **复制**：选中任意场景（含 Default），点击 📋 生成一份副本  
  **Duplicate**: Select any scene (including Default) and click 📋 to create a copy
- **重命名**：选中已保存场景，点击 ✏ 修改名字  
  **Rename**: Select a saved scene and click ✏ to change its name
- **上移 / 下移 / 删除**：调整顺序或删除  
  **Move up / Move down / Delete**: Reorder or delete
- **在右键菜单中显示默认场景**：勾选后，右键菜单的 Scenes 子菜单中会显示"默认"项  
  **Show default scene in context menu**: When enabled, a "Default" entry appears in the right-click "Scenes" submenu

> 💡 场景保存在 `~/.local/share/ShutdownMenu-change@yoo/scenes.json`，可直接备份或迁移。  
> **Scenes** are stored in `~/.local/share/ShutdownMenu-change@yoo/scenes.json`; you can back them up or move them to another machine.

### 交互行为 | Interaction Behavior

- **滚轮切换工作区**：勾选"使用鼠标滚轮切换工作区"后，悬停滚动滚轮即可循环切换工作区（默认关闭）。菜单打开时滚轮自动禁用，避免误操作。  
  **Scroll to switch workspaces**: Enable `Switch workspace with mouse scroll` to cycle through workspaces (disabled by default). Scroll is automatically disabled while the menu is open.
- **鼠标中键单击动作**：可选择中键点击时执行的动作：  
  **Middle click action**: Choose an action to perform:
  - `无` — 不执行任何操作  
    `Nothing` — Does nothing
  - `显示桌面` — 最小化所有窗口显示桌面，再次触发则恢复  
    `Show desktop` — Minimizes all windows to show the desktop; trigger again to restore
  - `显示工作区选择器 (Expo)` — 打开工作区选择器  
    `Show workspace selector (Expo)` — Opens the workspace selector
  - `显示窗口选择器 (Scale)` — 打开窗口选择器  
    `Show window selector (Scale)` — Opens the window selector
  - `显示/隐藏桌面图标` — 切换桌面图标的显示与隐藏  
    `Toggle desktop icons visibility` — Toggles desktop icons on/off

> 💡 **所有更改都会立即生效，无需重启 Cinnamon。**  
> **All changes take effect immediately – no need to restart Cinnamon.**

> ℹ️ **注意**：使用动态壁纸（如 Hidamari 等）时，切换"显示/隐藏桌面图标"可能无法正常显示图标，建议在动态壁纸工具中开启"将桌面图标显示在视频之上"之类的选项。  
> **Note**: When using a live wallpaper (such as Hidamari), toggling "desktop icons visibility" may not work correctly. Please enable an option like "Show desktop icons on top of the video" in your live wallpaper tool.

---

## 🧩 使用技巧 | Tips

- 自定义菜单项支持 **手动添加命令**，不一定非要选择 `.desktop` 文件。例如可以添加一行：
  - Name: `重启`
  - Icon: `system-reboot`
  - Command: `cinnamon-session-quit --reboot`
- **一键导入 + 勾选框工作流**：先点击全选按钮导入所有应用，再使用底部的「全选」/「取消全选」按钮批量管理勾选状态，未勾选的不会出现在菜单中，已勾选的自动置顶，非常方便管理大量应用。
- **搜索过滤**：在自定义菜单项列表的搜索框中输入关键词，可按名称实时过滤，快速定位目标应用。
- **场景胶囊导航栏**：在全局设置中将"场景快捷切换按钮数"设为 1–5，菜单顶部会显示胶囊导航栏，点击分段即可即时切换场景，菜单保持打开。
- 网格模式下配合 `Hide built-in items`，可以将菜单变成类似 Dock 的应用启动器。
- 图标输入框支持两种形式：
  - **系统图标名**（如 `firefox`、`system-shutdown`）
  - **图片绝对路径**（如 `/usr/share/icons/my-icon.png`）
- 场景可以理解为一整套设置的"存档"。例如：
  - 保存一个"工作"场景，只显示办公相关应用；
  - 保存一个"娱乐"场景，展示游戏和媒体。
  - 右键点击面板图标 → Scenes → 选择某个场景，即可切换。

---

## 🔧 开发信息 | Development Information

- 代码基于 `ShutdownMenuWithIcons@LLOBERA` 重构，网格化代码参考 `Cinnamenu@json`  
  The code is refactored based on `ShutdownMenuWithIcons@LLOBERA`; the grid-based code refers to `Cinnamenu@json`
- 扩展了交互功能、自定义菜单项、网格布局与场景预设  
  Extended with interaction features, custom menu items, grid layout, and scene presets
- 自定义菜单项和场景预设的 UI 由独立的 Python 组件（`widgets.py`）提供：  
  - `CustomAppList`：解析 `.desktop` 文件并管理列表，支持按名称搜索过滤  
  - `SceneManager`：管理场景的保存 / 应用 / 复制 / 重命名 / 排序  
  - `IconPickerRow`：带预览的图标选择行  
  The UI for custom menu items and scenes is provided by a standalone Python widget (`widgets.py`):
  - `CustomAppList`: parse `.desktop` files and manage the list, with name-based search filtering
  - `SceneManager`: save / apply / duplicate / rename / reorder scenes
  - `IconPickerRow`: icon chooser row with live preview
- 许可证：GPLv3  
  License: GPLv3