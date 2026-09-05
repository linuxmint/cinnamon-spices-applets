# 关机菜单（修改版） | Shutdown Menu - change

一个小巧实用的 Cinnamon 面板小程序。  
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
- **鼠标中键**：呼出工作区选择器（Expo）或窗口选择器（Scale）或切换桌面图标的显示与隐藏  
  **Middle click**: Opens workspace selector (Expo) or window selector (Scale) or Toggle desktop icons visibility

---

## ⚙️ 设置 | Settings

### 面板图标 | Panel Icon

- 可自由选择图标（支持系统图标或自定义图片路径）  
  Freely choose an icon (system icons or custom image path supported)
- 可调整图标大小（16–64 像素）  
  Adjust icon size (16–64 pixels)

### 菜单选项 | Menu Options

- 勾选对应复选框以添加项目  
  Check the corresponding checkboxes to add items
- 替换图标名称或浏览至图标文件来更改图标  
  Change icons by replacing the icon name or browsing to an icon file
- 通过替换命令来更改命令  
  Change commands by replacing the command

### 交互行为 | Interaction Behavior

- **滚轮切换工作区**：勾选“使用鼠标滚轮切换工作区”后，悬停滚动滚轮即可循环切换工作区（默认关闭）。  
  **Scroll to switch workspaces**: Enable `Switch workspace with mouse scroll` to cycle through workspaces (disabled by default).
- **鼠标中键单击动作**：可选择中键点击时执行的动作：  
  **Middle click action**: Choose an action to perform:
  - `无` — 不执行任何操作  
    `Nothing` — Does nothing
  - `显示工作区选择器 (Expo)` — 打开工作区选择器  
    `Show workspace selector (Expo)` — Opens the workspace selector
  - `显示窗口选择器 (Scale)` — 打开窗口选择器  
    `Show window selector (Scale)` — Opens the window selector
  - `显示/隐藏桌面图标`  
    `Toggle desktop icons visibility` 

> 💡 **所有更改都会立即生效，无需重启 Cinnamon。**  
> **All changes take effect immediately – no need to restart Cinnamon.**

---

## 🔧 开发信息 | Development Information

- 代码基于 `ShutdownMenuWithIcons@LLOBERA` 重构  
  The code is refactored based on `ShutdownMenuWithIcons@LLOBERA`
- 并扩展了交互功能  
  Extended with interaction features