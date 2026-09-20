# ActionCenter

> **一个功能齐全的 Cinnamon 面板快捷设置中心**

[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Cinnamon](https://img.shields.io/badge/Cinnamon-6.x%2B-green.svg)](https://github.com/linuxmint/Cinnamon)
[![Version](https://img.shields.io/badge/Version-1.0-orange.svg)](#)

---

## 目录

- [功能特性](#功能特性)
- [配置说明](#配置说明)
- [模块说明](#模块说明)
- [依赖说明](#依赖说明)

---

## 功能特性

**ActionCenter** 是一款为 Linux Mint / Cinnamon 桌面环境设计的综合面板小程序，将多个系统控制模块整合到一个统一的弹出菜单中，让你无需打开多个设置窗口即可快速管理系统。

### 核心模块

| 模块 | 功能描述 |
|------|---------|
| 🎵 媒体播放器控制 | 基于 MPRIS 协议监听系统媒体播放器，支持切歌/暂停/上一首/进度拖拽，显示专辑封面、歌曲名、艺术家信息 |
| 🔆 亮度调节 | 通过 `brightnessctl` / `ddcutil` 调节屏幕亮度，支持多显示器独立控制 |
| 🔊 音量控制 | 基于 `Cvc MixerControl` 的音量调节与静音切换 |
| 🔘 快捷开关 | 网络、蓝牙、性能模式、夜间模式、深色主题、飞行模式一键开关 |
| ⚡ 电源菜单 | 关机 / 重启 / 注销 / 挂起，支持系统对话框模式 |
| 🎨 主题切换 | 深色/浅色模式一键切换，支持 GTK 主题、图标主题、光标主题分别配置 |
| 📋 右键菜单 | 右键面板图标弹出快捷菜单：声音控制、静音、网络连接管理 |
| 📊 系统状态 | 实时轮询电池状态、网络连接状态、蓝牙状态并显示在面板 |

---

## 配置说明

右键面板图标 → **设置**，可配置以下三个页面：

### 基础设置

| 设置项 | 说明 |
|--------|------|
| 面板图标 | 自定义面板图标图片 |
| 面板图标高度 | 图标高度（像素），0 表示自动匹配面板 |
| 截图命令 | 点击截图按钮时执行的命令（默认 `gnome-screenshot`） |
| 电源模式 | 开启后使用系统对话框进行关机/重启等操作 |
| 显示播放器模块 | 显示/隐藏媒体播放器控制模块 |
| 自动切换播放器 | 自动切换到正在播放的播放器 |

### 快捷开关

| 设置项 | 说明 |
|--------|------|
| 显示性能模式开关 | 显示/隐藏性能模式开关 |
| 显示夜间模式开关 | 显示/隐藏夜间模式开关 |
| 显示深色主题开关 | 显示/隐藏深色主题开关 |
| 显示飞行模式开关 | 显示/隐藏飞行模式开关 |
| 深色 GTK 主题 | 深色模式下使用的 GTK 主题 |
| 深色图标主题 | 深色模式下使用的图标主题 |
| 深色光标主题 | 深色模式下使用的光标主题 |
| 浅色 GTK 主题 | 浅色模式下使用的 GTK 主题 |
| 浅色图标主题 | 浅色模式下使用的图标主题 |
| 浅色光标主题 | 浅色模式下使用的光标主题 |

### 右键菜单

| 设置项 | 说明 |
|--------|------|
| 显示声音控制 | 右键菜单中显示音量控制 |
| 显示静音按钮 | 右键菜单中显示静音按钮 |
| 显示网络连接 | 右键菜单中显示网络连接选项 |
| 显示有线网络 | 右键菜单中显示有线网络选项 |
| 显示无线网络 | 右键菜单中显示无线网络扫描与连接 |
| 显示移动网络 | 右键菜单中显示移动网络（WWAN）选项 |

---

## 模块说明

### MPRIS 媒体播放器控制

通过后台 Python 守护进程（`mpris_monitor.py`）监听 D-Bus MPRIS 事件，维护所有已连接播放器的状态。Applet 通过读取 JSON 状态文件和写入命令文件与守护进程通信，实现播放器控制。

**支持的操作：**

- ⏯ 播放/暂停
- ⏭ 下一首
- ⏮ 上一首

### 亮度控制

使用 `brightnessctl`（笔记本）或 `ddcutil`（外接显示器）调节屏幕亮度，支持多显示器检测和主显示器自动识别。

### 主题切换

通过修改 `gsettings` 中的 `gtk-theme`、`icon-theme`、`cursor-theme` 实现主题切换。支持分别配置深色和浅色两套主题方案。

### 电源菜单

支持两种模式：

- **系统对话框模式**：调用 `cinnamon-session-quit` 弹出系统确认对话框
- **直接执行模式**：直接调用 `systemctl` 执行关机/重启/注销/挂起

---

## 依赖说明

### 运行时依赖

- **Cinnamon 6.x+**
- **Python 3**（用于 MPRIS 守护进程和主题扫描）
- **brightnessctl** 或 **ddcutil**（亮度控制）
- **nmcli**（网络连接管理）
- **gnome-screenshot** 或其他截图工具（截图功能）
- **curl**（媒体封面下载）

### Python 依赖

- `dbus-python` — D-Bus 通信
- `PyGObject` — GStreamer/GLib 绑定

### 可选依赖

- `cinnamon-session-quit` — 用于系统对话框模式的电源管理

---



## English Version

---

## ActionCenter

> **An all-in-one Quick Settings panel for Cinnamon desktop**

[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Cinnamon](https://img.shields.io/badge/Cinnamon-6.x%2B-green.svg)](https://github.com/linuxmint/Cinnamon)
[![Version](https://img.shields.io/badge/Version-1.0-orange.svg)](#)

---

## Table of Contents

- [Features](#features)
- [Configuration](#configuration)
- [Module Details](#module-details)
- [Dependencies](#dependencies)

---

## Features

**ActionCenter** is a comprehensive panel applet for the Linux Mint / Cinnamon desktop environment that integrates multiple system control modules into a single unified popup menu, allowing you to quickly manage your system without opening multiple settings windows.

### Core Modules

| Module | Description |
|--------|-------------|
| 🎵 Media Player Control | MPRIS protocol-based media player control — play/pause/next/previous/seek, album art display, track info |
| 🔆 Brightness Control | Screen brightness adjustment via `brightnessctl` / `ddcutil`, multi-monitor support |
| 🔊 Volume Control | Volume adjustment and mute toggle via `Cvc MixerControl` |
| 🔘 Quick Toggles | One-click toggles for network, Bluetooth, performance mode, night light, dark mode, airplane mode |
| ⚡ Power Menu | Shutdown / reboot / logoff / suspend, with system dialog mode support |
| 🎨 Theme Switcher | One-click dark/light mode switching with separate GTK, icon, and cursor theme configuration |
| 📋 Context Menu | Right-click popup menu with sound controls, mute button, and network management |
| 📊 System Status | Real-time polling of battery, network, and Bluetooth status displayed on the panel |

---

## Configuration

Right-click the panel icon → **Settings** to configure three pages:

### Basic Settings

| Setting | Description |
|---------|-------------|
| Panel Icon | Custom panel icon image |
| Panel Icon Height | Icon height in pixels, 0 = auto-match panel size |
| Screenshot Command | Command to run when clicking the screenshot button (default: `gnome-screenshot`) |
| Power Mode | Use system dialog for shutdown/reboot operations |
| Show Player Module | Show/hide the media player control module |
| Auto-switch Player | Automatically switch to the player that is currently playing |

### Toggle Switches

| Setting | Description |
|---------|-------------|
| Show Performance Mode Toggle | Show/hide performance mode toggle |
| Show Night Light Toggle | Show/hide night light toggle |
| Show Dark Mode Toggle | Show/hide dark mode toggle |
| Show Airplane Mode Toggle | Show/hide airplane mode toggle |
| Dark GTK Theme | GTK theme used when dark mode is enabled |
| Dark Icon Theme | Icon theme used when dark mode is enabled |
| Dark Cursor Theme | Cursor theme used when dark mode is enabled |
| Light GTK Theme | GTK theme used when dark mode is disabled |
| Light Icon Theme | Icon theme used when dark mode is disabled |
| Light Cursor Theme | Cursor theme used when dark mode is disabled |

### Context Menu

| Setting | Description |
|---------|-------------|
| Show Sound Control | Show volume control in context menu |
| Show Mute Button | Show mute button in context menu |
| Show Network Connection | Show network connection options in context menu |
| Show Wired Network | Show wired network options in context menu |
| Show Wireless Network | Show wireless network scan and connect in context menu |
| Show WWAN | Show mobile network (WWAN) options in context menu |

---

## Module Details

### MPRIS Media Player Control

Uses a background Python daemon (`mpris_monitor.py`) to listen to D-Bus MPRIS events and maintain state for all connected players. The applet communicates with the daemon via JSON state files and command files.

**Supported operations:**

- ⏯ Play/Pause
- ⏭ Next
- ⏮ Previous

### Brightness Control

Uses `brightnessctl` (laptops) or `ddcutil` (external monitors) to adjust screen brightness, with multi-monitor detection and primary display auto-identification.

### Theme Switcher

Switches themes by modifying `gsettings` for `gtk-theme`, `icon-theme`, and `cursor-theme`. Supports separate dark and light theme schemes.

### Power Menu

Two modes available:

- **System Dialog Mode**: Uses `cinnamon-session-quit` to show system confirmation dialog
- **Direct Execution Mode**: Directly calls `systemctl` for shutdown/reboot/logoff/suspend

---

## Dependencies

### Runtime Dependencies

- **Cinnamon 6.x+**
- **Python 3** (for MPRIS daemon and theme scanning)
- **brightnessctl** or **ddcutil** (brightness control)
- **nmcli** (network connection management)
- **gnome-screenshot** or alternative (screenshot functionality)
- **curl** (media cover art download)

### Python Dependencies

- `dbus-python` — D-Bus communication
- `PyGObject` — GStreamer/GLib bindings

### Optional Dependencies

- `cinnamon-session-quit` — for system dialog mode power management

