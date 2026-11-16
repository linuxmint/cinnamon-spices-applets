# Waterfall Menu

A cascading application menu for Cinnamon in the spirit of classic start menus: a narrow banner on the left, pinned programs on top, **Programs / Documents / Settings / Search / Help / Run / Shut Down** below, a search box at the bottom, and submenus that fly out to the side.

The menu takes its look from your current Cinnamon theme: if the theme draws menus with images (glass frame, selection highlight, scrollbar), those same images are used.

## Features

- **Cascading submenus** with a short hover delay; long lists get a scrollbar instead of growing across the screen (mouse wheel, scrollbar and keyboard all work).
- **Pinned programs** at the top (taken from your Cinnamon favorites).
- **Search across the whole menu.** Just start typing: the list is replaced by results from applications, System Settings pages (typing `appl` finds *Applets*), folders, power commands and recent files. Several words are matched together, best matches come first.
- **Shut down, restart, sleep, lock, log off.** The *Shut Down...* item opens a submenu, so nothing is shut down by a single stray click.
- **Menu editing.** Right-click the applet's button on the panel and choose **Edit menu** to open Cinnamon's menu editor: add launchers and folders, show or hide items. The *Programs* list follows the system menu, so your changes appear here (the menu is rebuilt every time it opens).
- **Right-click on a program** opens a context menu: Open, the actions from its `.desktop` file (for example *New Window*), Add to panel, Add to desktop, Add to / Remove from favorites, Uninstall and Properties.
- **Full keyboard control.**
- **Theme-aware.** Colors and fonts are read from the active theme; with image-based themes the theme's own images are used. If the theme provides no such images, the menu falls back to colors sampled from the theme.
- English and Russian interface (selected automatically from the system language).

## Installation

1. Copy the `waterfallmenu@xopek` folder to `~/.local/share/cinnamon/applets/` (the file `applet.js` must end up directly inside `~/.local/share/cinnamon/applets/waterfallmenu@xopek/`).
2. Restart Cinnamon (`Ctrl+Alt+Esc`, or `Alt+F2`, type `r`, `Enter`).
3. Right-click the panel, choose **Applets**, find **Waterfall Menu** and add it to the panel.

If you keep another menu applet on the panel, remove it or change its hotkey: both use `Super` by default.

## Configuration

Open the applet's settings (right-click the applet, then **Configure...**). The same right-click menu has **Edit menu** for editing the list of programs.

| Setting | What it does |
| --- | --- |
| Use a custom panel icon / Panel icon | By default the applet shows the theme's `start-here-symbolic` icon. Turn this on to choose another icon or image file. |
| Panel label | Optional text next to the icon. Empty means no text. |
| Keyboard shortcut | Opens and closes the menu. Default: `Super`. |
| Show the vertical banner | Shows or hides the strip on the left of the main menu. |
| Banner text | Text on the banner. Empty means the name of your distribution. |
| Frame opacity | Opacity of the outer frame. Used only when the theme does not draw the menu with images. |
| Theme selection highlight in cascades | Uses the theme's image highlight for the selected row in submenus too (the main menu always uses it). |
| Pinned programs | How many of your Cinnamon favorites are shown at the top. `0` hides them. |
| Ask for confirmation | If on, shut down, restart and log off go through the session's confirmation dialog; if off, they happen immediately. |

Pinned programs are your Cinnamon favorites: add or remove them from the right-click menu of any program.

## Keyboard

| Key | Action |
| --- | --- |
| Type any text | Search (the search box always has the focus) |
| `Up` / `Down` | Move the selection |
| `Right` | Open the submenu of the selected item |
| `Left` | Close the current submenu |
| `Enter` | Run the selected item or open its submenu |
| `Home` / `End` | First / last item |
| `Menu` or `Shift+F10` | Context menu of the selected program |
| `Esc` | Clear the search, close the context menu or the current submenu, then the menu itself |

While the search box contains text, `Left` and `Right` move the text cursor.

## Requirements and notes

- Cinnamon 6.x.
- Used when present: `nemo` (Computer, Network, file search fallback), `catfish` (file search) and `yelp` (Help); without them the menu falls back to a simpler action. *Edit menu*, *Uninstall* and *Properties* use `cinnamon-menu-editor`, `cinnamon-remove-application` and `cinnamon-desktop-editor`, which are part of Cinnamon itself.
- *Add to panel* uses the standard panel launchers applet and the first panel (`panel1`).
- The applet does not ship any images of its own except its icon: all menu graphics come from your theme.

## Русский

**Waterfall Menu** — каскадное меню приложений для Cinnamon в духе классических меню «Пуск»: узкая полоса слева, закреплённые программы сверху, пункты *Программы / Документы / Настройка / Поиск / Справка / Выполнить / Завершение работы*, строка поиска внизу и подменю, выезжающие вбок. Оформление берётся из вашей темы: если тема рисует меню картинками (стекло, подсветка, полоса прокрутки), используются именно они.

**Возможности:** каскадные подменю с полосой прокрутки для длинных списков; закреплённые программы (избранное Cinnamon); поиск по всему меню (просто начните печатать: программы, разделы «Параметров системы», папки, команды питания, недавние файлы); «Завершение работы…» с выбором — выключить, перезагрузить, спящий режим, блокировка, завершить сеанс; «Редактировать меню» в правом клике по кнопке на панели (редактор меню Cinnamon: новые пункты и папки, скрытие пунктов; список «Программы» повторяет системное меню); контекстное меню по правой кнопке на программе (открыть, действия ярлыка, добавить на панель / на рабочий стол / в избранное, удалить, свойства); полное управление с клавиатуры.

**Установка:** скопируйте папку `waterfallmenu@xopek` в `~/.local/share/cinnamon/applets/`, перезапустите Cinnamon (`Ctrl+Alt+Esc`), затем правый клик по панели → «Апплеты» → добавьте **Waterfall Menu**. Если на панели есть другое меню, уберите его или смените горячую клавишу: по умолчанию обе используют `Super`.

**Настройка:** правый клик по апплету → «Настроить…». Можно задать свой значок и текст на панели, горячую клавишу, показ и текст вертикальной полосы, прозрачность рамки (если тема не рисует меню картинками), подсветку из темы в каскадах, число закреплённых программ и подтверждение при выключении.

**Клавиши:** печать — поиск; `↑` `↓` — выбор; `→` — открыть подменю; `←` — закрыть подменю; `Enter` — запуск; `Home` / `End` — первый / последний пункт; `Menu` или `Shift+F10` — контекстное меню программы; `Esc` — шаг назад (очистить поиск, закрыть подменю, закрыть меню).

## License

GPL-2.0-or-later.
