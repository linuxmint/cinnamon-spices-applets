<p align="center">
  <img src="icon.png" width="64" alt="OpenCode GO Usage">
</p>

<h1 align="center">OpenCode GO Usage</h1>

<p align="center">
  <b>Cinnamon Applet</b> — мониторинг лимитов OpenCode GO подписки
</p>

<p align="center">
  <img src="https://img.shields.io/badge/linuxmint-Cinnamon-87cf3e?logo=linuxmint">
  <img src="https://img.shields.io/badge/version-1.1-blue">
  <img src="https://img.shields.io/badge/license-GPL--3.0-green">
  <img src="https://img.shields.io/badge/GJS-ES6-yellow">
</p>

---

> **[English version](README_EN.md)**

Panel applet для Cinnamon, показывающий статус использования лимитов OpenCode **GO** подписки. Для OpenCode ZEN не подходит.

Отображает иконку на панели, stats в popup-меню по клику, и поддерживает уведомления при сбросе лимитов.

## Установка

```bash
mkdir -p ~/.local/share/cinnamon/applets/opencode-go-usage@clrblind
cp applet.js metadata.json settings-schema.json icon.png \
  ~/.local/share/cinnamon/applets/opencode-go-usage@clrblind
```

Перезапустить Cinnamon: `Alt+F2` → `r` → Enter.

Добавить на панель: правый клик по панели → `Add to panel` → `OpenCode GO Usage`.

## Получение данных для входа

1. Открой `https://opencode.ai/auth` в браузере
2. Войди в аккаунт
3. После редиректа скопируй `wrk_...` из адресной строки
4. Извлеки cookie `auth` (F12 → Application/Cookies → `opencode.ai`)
5. Вставь оба значения в настройки апплета

## Настройки

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `workspace_id` | entry | — | ID workspace (`wrk_...`) |
| `auth_cookie` | entry | — | Cookie `auth` из браузера |
| `update_interval` | spinbutton | 30 | Интервал обновления (сек) |
| `show_notifications` | checkbox | false | Уведомлять о сбросе лимита |

**Шрифт:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `monospace` | checkbox | true | Моноширинный шрифт |
| `font_family` | combobox | sans-serif | Гарнитура (если monospace выкл) |
| `font_size` | spinbutton | 11 | Размер текста (pt) |
| `font_color` | colorchooser | — | Цвет текста |

## Как это работает

```
Gio.Subprocess(argv) — curl https://opencode.ai/workspace/.../go
         │
         ▼
   _parseOutput — JS парсинг HTML → Rolling Usage | 34% | Resets in: 2h
         │                         Weekly Usage  | 100% | Resets in: 1d
         ▼                         Monthly Usage | 63%  | Resets in: 3d
   PopupMenu — 3 строки в popup
   _checkResets — уведомление при >0 → 0
```

### Парсинг

1. `replace(/\n/g, "")` — HTML в одну строку
2. split по `data-slot="usage-item"`
3. regex — извлечение label / процент / время сброса
4. `padEnd`/`padStart` — выравнивание колонок

### Анти-флуд уведомлений

Уведомление срабатывает **только** при переходе >0 → 0. Пока лимит висит на 0 — тишина. Как только уходит выше 0 — блокировка сбрасывается.

## Файлы

| Файл | Назначение |
|------|-----------|
| `applet.js` | Основная логика |
| `settings-schema.json` | Схема настроек |
| `metadata.json` | Метаданные апплета |
| `icon.png` | Иконка на панели |
| `stats.png` | Скриншот stats popup |
| `settings.png` | Скриншот настроек |

## Технологии

- **Язык:** GJS (GNOME JavaScript, ES6)
- **UI:** St (Cinnamon toolkit), Clutter, Pango
- **Ассемблер:** `imports.ui.applet`, `GLib`, `Gio`
- **Парсинг:** curl + sed + awk

## Лицензия

GPL-3.0 © clrblind 2026

## Changelog

### 1.1

- Парсинг HTML перенесён из shell pipeline (sed/awk) в JS
- Shell-команды заменены на `Util.spawn` и `Gio.Subprocess` с argv (без shell-injection)
- `GLib.get_home_dir()` → `GLib.get_user_data_dir()` (XDG-compat)
- Исправлен UUID каталога иконки на `@clrblind`

---

<p align="center">
  <a href="README_EN.md">English version</a> •
  <a href="https://github.com/clrblind/opencode-go-usage">GitHub</a>
</p>
