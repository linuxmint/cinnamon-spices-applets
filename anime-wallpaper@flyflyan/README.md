# Anime Desktop Wallpaper

A Cinnamon applet to apply the daily Anime Wallpaper to your Cinnamon Desktop Background.
Based on [bing-wallpaper@starcross.dev](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/bing-wallpaper%40starcross.dev)

### Requirements:
WebP images need either the `dwebp` tool to transcode them, or the `webp-pixbuf-loader` GdkPixbuf loader to display them directly — only one of the two is required. Install it with the Synaptic Package Manager or using one of the following terminal commands:
```sh
sudo apt install webp                # provides dwebp
# or
sudo apt install webp-pixbuf-loader  # lets GdkPixbuf load webp directly
```

### Image sources:
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
