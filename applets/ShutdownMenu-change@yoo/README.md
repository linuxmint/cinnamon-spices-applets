# Shutdown Menu - change | 关机菜单（修改版）

A small and practical Cinnamon panel applet.  
一个小巧实用的 Cinnamon 面板小程序。

## 📖 Introduction | 简介

This applet adds an icon to the Cinnamon panel. Clicking it provides quick access to the following system functions:  
这个小程序会在 Cinnamon 面板上添加一个图标，点击后可以快速访问以下系统功能：

- **Shut down** (关机)：Shows the system confirmation dialog / 弹出系统确认对话框
- **Log out** (注销)：Shows the system confirmation dialog / 弹出系统确认对话框
- **Lock screen** (锁屏)：Locks the screen immediately (no confirmation) / 立即锁定屏幕（无确认提示）

In addition, it offers extra handy interactions:  
此外，还提供了一些额外便捷操作：

- **Mouse wheel** (鼠标滚轮)：Hover and scroll to cycle through workspaces / 悬停滚动，循环切换工作区
- **Middle click** (鼠标中键)：Opens workspace selector (Expo) or window selector (Scale) / 呼出工作区选择器（Expo）或窗口选择器（Scale）

---

## ⚙️ Settings | 设置

### Panel Icon | 面板图标

- Freely choose an icon (system icons or custom image path supported) / 可自由选择图标（支持系统图标或自定义图片路径）
- Adjust icon size (16–64 pixels) / 可调整图标大小（16–64 像素）

### Menu Options | 菜单选项

- Check the corresponding checkboxes to add items / 勾选对应复选框以添加项目
- Change icons by replacing the icon name or browsing to an icon file / 替换图标名称或浏览至图标文件来更改图标
- Change commands by replacing the command / 通过替换命令来更改命令

### Interaction Behavior | 交互行为

- **Scroll to switch workspaces** (滚轮切换工作区)：Enable `Switch workspace with mouse scroll` to cycle through workspaces / 勾选“使用鼠标滚轮切换工作区”后，悬停滚动滚轮即可循环切换工作区（默认开启）。
- **Middle click action** (鼠标中键单击动作)：Choose an action to perform / 可选择中键点击时执行的动作：
  - `Nothing` (无) — Does nothing / 不执行任何操作
  - `Show workspace selector (Expo)` (显示工作区选择器) — Opens the workspace selector / 打开工作区选择器
  - `Show window selector (Scale)` (显示窗口选择器) — Opens the window selector / 打开窗口选择器

> 💡 **All changes take effect immediately – no need to restart Cinnamon.**  
> **所有更改都会立即生效，无需重启 Cinnamon。**

---

## 🔧 Development Information | 开发信息

- Code is based on `ShutdownMenuWithIcons@LLOBERA` / 代码基于 `ShutdownMenuWithIcons@LLOBERA` 修改
- Extended with interaction features / 并扩展了交互功能
