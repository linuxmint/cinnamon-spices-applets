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
- **自定义菜单项**：可自由添加任意数量的菜单项，并选择显示在内置项的上方或下方  
  **Custom menu items**: Freely add any number of menu items, positioned above or below built-in items

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

### 内置菜单项 | Built-in Menu Items

- 勾选对应复选框以添加项目  
  Check the corresponding checkboxes to add items
- 可自定义每个菜单项的名称、图标和命令  
  Customize the name, icon, and command for each item
- 支持为关机项下方单独设置分隔线  
  Separately toggle a separator below the shutdown item

### 自定义菜单项 | Custom Menu Items

- **添加任意数量的菜单项**：在设置面板中通过列表新增、删除、调整顺序  
  **Add any number of items**: Use the list in the settings panel to add, remove, or reorder items
- **每项可独立设置**：名称、图标（图标名或文件路径）、命令  
  **Each item is fully configurable**: Name, icon (icon name or file path), and command
- **图标辅助选择器**：提供一个图形化图标选择器，选择后可复制其值填入列表  
  **Icon helper**: A graphical icon picker is provided; copy its value into the list
- **位置可选**：自定义项可显示在内置项的上方或下方  
  **Position**: Choose whether custom items appear above or below built-in items
- **分隔线可选**：可控制自定义项与内置项之间是否显示分隔线  
  **Separator**: Toggle whether a separator is shown between custom and built-in items

### 交互行为 | Interaction Behavior

- **滚轮切换工作区**：勾选“使用鼠标滚轮切换工作区”后，悬停滚动滚轮即可循环切换工作区（默认关闭）。  
  **Scroll to switch workspaces**: Enable `Switch workspace with mouse scroll` to cycle through workspaces (disabled by default).
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

## 🔧 开发信息 | Development Information

- 代码基于 `ShutdownMenuWithIcons@LLOBERA` 重构  
  The code is refactored based on `ShutdownMenuWithIcons@LLOBERA`
- 并扩展了交互功能与自定义菜单项  
  Extended with interaction features and custom menu items