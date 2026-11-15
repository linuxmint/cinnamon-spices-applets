# Anime Desktop Wallpaper

A Cinnamon applet to apply the daily Anime Wallpaper to your Cinnamon Desktop Background.
Based on [bing-wallpaper@starcross.dev](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/bing-wallpaper%40starcross.dev)

### Requirements:
Need `dwebp` tool to transcode webp images.It can be installed wih the Synaptic Package Manager or using the following terminal command:
```sh
sudo apt install webp
```

### Image sources:
<<<<<<< Updated upstream
- [LoliAPI](https://loliapi.com/) - [电脑端二次元图片](https://www.loliapi.com/acg/pc/)
- [梓宸的小屋](https://zichen.zone/) - [梓宸随机图片API](https://app.zichen.zone/api/acg.php)
- [Jitsuの主页](https://jitsu.top/) - [Jitsuの随机涩图API](https://moe.jitsu.top/img/?sort=pc)
- [保罗｜API](https://api.paugram.com/) - [随机动漫壁纸](https://api.paugram.com/wallpaper/)
- [栗次元API-举个栗子](https://www.dmoe.cc/) - [栗次元API](https://t.mwm.moe/pc)
- [樱花二次元图片API-Dmoe](https://dmoe.cc/) - [樱花二次元图片API](https://www.dmoe.cc/random.php)
- [韩小韩API接口站](https://api.vvhan.com/) - [随机二次元图片API接口](https://api.vvhan.com/api/acgimg)
- [Paulzzh](https://blog.paulzzh.com/) - [东方Project随机图片API](https://img.paulzzh.com/touhou/random)

### README.md
- [English](README.md)
- [简体中文](README.zh_CN.md)
=======
- [LoliAPI](https://loliapi.com/) - [PC anime images](https://www.loliapi.com/acg/pc/)
- [栗次元](https://t.alcy.cc/) - [random anime images](https://t.alcy.cc/pc)
- [樱花二次元图片API-Dmoe](https://dmoe.cc/) - [sakura anime image API](https://www.dmoe.cc/random.php)
- [保罗｜API](https://api.paugram.com/) - [random anime wallpaper](https://api.paugram.com/wallpaper/)
- [妖狐API](https://acg.yaohud.cn/) - [random anime images](https://acg.yaohud.cn/dm/acg.php)
- [Jitsuの主页](https://jitsu.top/) - [Jitsu's random anime API](https://moe.jitsu.top/img/?sort=pc)
- [Paulzzh](https://blog.paulzzh.com/) - [Touhou Project random images](https://img.paulzzh.com/touhou/random)
- [栗次元API-举个栗子](https://www.dmoe.cc/) - [anime image API](https://t.mwm.moe/pc)

You can also add your own image URLs in the applet settings, one `http://` or `https://` URL per line under **Custom wallpaper URLs**; they are listed together with the built-in sources in the right-click menu. The built-in sources all use `https://`; a custom `http://` URL is not encrypted, so the image could be tampered with on the way — prefer `https://` whenever the site supports it.

Note: This code has undergone AI-assisted bug fixing and compliance review.

### Left-click action:
The left click can be set to either **Switch to another wallpaper** or **Save the current wallpaper** (saved into the **Save background images to** folder). When switching, the image is also saved if **Automatically save background images** is enabled.
>>>>>>> Stashed changes
