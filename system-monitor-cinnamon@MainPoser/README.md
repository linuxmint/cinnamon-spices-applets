[English](README.en.md) | [中文](README.md)

# System Monitor Cinnamon

用于在Cinnamon桌面面板中显示CPU占用率、内存占用率和实时网速的一个小工具。
灵感来源[RunCat365](https://github.com/Kyome22/RunCat365)


## 功能特性

- 📊 实时显示CPU使用率
- 💾 显示内存占用情况
- 🌐 显示网络上传/下载速度
- 🎨 可自定义图标主题（猫咪/小马）
- 🌓 支持自动/黑色/白色图标主题
- ⚙️ 可调节刷新频率
- 🎯 轻量级，资源占用低

## 安装方法

1. 解压 .zip 到 ~/.local/share/cinnamon/applets
2. 启用 System Monitor Cinnamon 小工具

## 使用说明

安装后，小部件将自动在面板上显示系统监控信息。默认显示格式为：

```
CPU: 45% | MEM: 2.1G/8G | ↑ 1.2MB/s ↓ 500KB/s
```

## 配置选项

右键点击小部件，选择"配置"可以调整以下选项：

- **是否显示网速**：控制是否在面板上显示网络速度
- **刷新频率**：设置数据更新间隔（1-60秒）
- **图标主题**：选择图标颜色主题（跟随系统/白色/黑色）
- **动画图标**：选择动画图标类型（猫咪/小马）

## 项目结构

```
system-monitor-cinnamon/
├── applet.js              # 主程序文件
├── metada.json            # 小部件元数据
├── setting-schema.json    # 配置选项定义
├── stylesheet.css         # 样式文件
├── icons/                 # 图标资源
│   └── runners/
│       ├── cat/          # 猫咪动画图标
│       └── horse/        # 小马动画图标
├── po/                   # Translation files
└── README.md              # 项目说明
```

## 技术实现

- 使用JavaScript (ES6)编写
- 基于Cinnamon Applet框架
- 通过系统文件读取CPU、内存和网络数据

## 故障排除

如果小部件无法正常工作，请尝试以下解决方案：

1. 重启Cinnamon：按`Ctrl+Alt+Esc`或运行`cinnamon --replace`
2. 检查系统日志：查看`~/.xsession-errors`中的错误信息
3. 确保系统已安装必要的依赖包

## 作者

MainPoser - 2026