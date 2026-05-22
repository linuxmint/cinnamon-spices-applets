#!/usr/bin/env python3
import sys
import os
import json
import time
import signal
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
from config import IS_WAYLAND, APPLET_DIR, _
from app import ScreenshotOverlay


# --- Bootstrap ---

def _check_dependencies(force=False):
    """Verify required system packages. Caches the result to skip on future starts."""
    config_path = os.path.expanduser("~/.config/mint-screenshot-deps.json")
    config = {}
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                config = json.load(f)
        except Exception: pass

    if config.get('deps_ok') and not force:
        return True

    missing = []
    
    try:
        import gi
    except ImportError:
        missing.append(("gi", "Python GObject Introspection"))
        
    try:
        import cairo
    except ImportError:
        missing.append(("cairo", "Python Cairo library"))
        
    try:
        import gi
        gi.require_foreign("cairo")
    except Exception:
        missing.append(("gi-cairo", "Python GObject Cairo bindings"))
        
    try:
        from PIL import Image
    except ImportError:
        missing.append(("pil", "Pillow (Icon Processing)"))

    if IS_WAYLAND:
        try:
            import dbus
        except ImportError:
            missing.append(("dbus", "D-Bus Python (Wayland portal support)"))
    else:
        try:
            import gi
            gi.require_version('Wnck', '3.0')
            from gi.repository import Wnck
        except (ImportError, ValueError):
            missing.append(("wnck", "Wnck (X11 window detection)"))

    if missing:
        import shutil
        pkg_manager = "unknown"
        install_cmd = ""
        
        try:
            if shutil.which("apt"):
                pkg_manager = "apt"
                install_cmd = "sudo apt install"
            elif shutil.which("pacman"):
                pkg_manager = "pacman"
                install_cmd = "sudo pacman -S"
            elif shutil.which("dnf"):
                pkg_manager = "dnf"
                install_cmd = "sudo dnf install"
            elif shutil.which("zypper"):
                pkg_manager = "zypper"
                install_cmd = "sudo zypper install"
        except Exception:
            pass
            
        pkg_map = {
            "apt": {
                "gi": "python3-gi", "cairo": "python3-cairo", "gi-cairo": "python3-gi-cairo", 
                "dbus": "python3-dbus", "wnck": "gir1.2-wnck-3.0"
            },
            "pacman": {
                "gi": "python-gobject", "cairo": "python-cairo", "gi-cairo": "python-gobject", 
                "dbus": "python-dbus", "wnck": "libwnck3"
            },
            "dnf": {
                "gi": "python3-gobject", "cairo": "python3-cairo", "gi-cairo": "python3-gobject", 
                "dbus": "python3-dbus", "wnck": "libwnck3"
            },
            "zypper": {
                "gi": "python3-gobject", "cairo": "python3-cairo", "gi-cairo": "python3-gobject", 
                "dbus": "python3-dbus", "wnck": "typelib-1_0-Wnck-3_0"
            }
        }
        
        suggested_pkgs = set()
        pkg_list_str = []
        
        lookup_manager = pkg_manager if pkg_manager != "unknown" else "apt"
        
        for key, desc in missing:
            pkg_name = pkg_map[lookup_manager][key]
            suggested_pkgs.add(pkg_name)
            pkg_list_str.append(f'  \u2022 {desc}  ({pkg_name})')
            
        pkg_names_str = ' '.join(sorted(suggested_pkgs))
        
        if pkg_manager == "unknown":
            msg = (_("The following dependencies are missing:\n\n{}\n\nPlease install them using your system's package manager.\n(Debian/Ubuntu package names shown as reference)")
                   .format('\n'.join(pkg_list_str)))
        else:
            msg = (_("The following dependencies are missing:\n\n{}\n\nPlease install them using your package manager:\n  {} {}")
                   .format('\n'.join(pkg_list_str), install_cmd, pkg_names_str))

        dialog = Gtk.MessageDialog(
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.OK,
            text=_("Mint Screenshot \u2014 Missing Dependencies")
        )
        dialog.format_secondary_text(msg)
        dialog.set_keep_above(True)
        dialog.run()
        dialog.destroy()
        return False

    # Cache the result so we don't check again next time
    config['deps_ok'] = True
    try:
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception: pass
    return True

def _cleanup_tmp_files():
    """Delete stale mint-screenshot-*.png temp files older than 1 hour."""
    try:
        import glob
        import tempfile
        now = time.time()
        pattern = os.path.join(tempfile.gettempdir(), "mint-screenshot-*.png")
        for f in glob.glob(pattern):
            if os.path.exists(f) and now - os.path.getmtime(f) > 3600:
                os.remove(f)
    except Exception: pass

LOCK_FILE = os.path.join("/tmp", "mint-screenshot.lock")

def _is_already_running():
    """Check if another instance is running. If so, signal it to raise its window."""
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE) as f:
                old_pid = int(f.read().strip())
            # Send SIGUSR1 to the running instance — it will raise its own window
            os.kill(old_pid, signal.SIGUSR1)
        except (ValueError, ProcessLookupError, PermissionError, OSError):
            # Stale lock file — previous instance is gone
            return False
        return True
    return False

def _write_lock():
    """Write our PID to the lock file."""
    try:
        with open(LOCK_FILE, 'w') as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

def _remove_lock():
    """Remove the lock file on exit."""
    try:
        if os.path.exists(LOCK_FILE):
            with open(LOCK_FILE) as f:
                pid = int(f.read().strip())
            if pid == os.getpid():
                os.remove(LOCK_FILE)
    except Exception:
        pass

if __name__ == "__main__":
    # --- Single-instance guard ---
    if _is_already_running():
        sys.exit(0)
    _write_lock()
    import atexit
    atexit.register(_remove_lock)

    # Set identification for the window manager (Cinnamon panel/taskbar)
    from gi.repository import GLib
    GLib.set_prgname("mint-screenshot-tool")
    GLib.set_application_name(_("Mint Screenshot"))

    # 1. Set Window Icon immediately so all windows (including dialogs) use it
    from gi.repository import GdkPixbuf
    
    # Add assets folder to icon theme search path so "mint-screenshot" name works
    icon_theme = Gtk.IconTheme.get_default()
    assets_dir = os.path.join(APPLET_DIR, "assets")
    if os.path.exists(assets_dir):
        icon_theme.append_search_path(assets_dir)

    icon_path = os.path.join(assets_dir, "mint-screenshot.png")
    small_icon = os.path.join(APPLET_DIR, "icon.png")
    
    icons = []
    try:
        if os.path.exists(icon_path):
            pb = GdkPixbuf.Pixbuf.new_from_file(icon_path)
            # Only keep the sizes GTK actually uses — no need for the full 1024x1024
            for size in [64, 48, 32]:
                icons.append(pb.scale_simple(size, size, GdkPixbuf.InterpType.BILINEAR))
    except Exception:
        pass

    if icons:
        Gtk.Window.set_default_icon_list(icons)
    
    # Use the name that matches our asset filename (without extension)
    Gtk.Window.set_default_icon_name("mint-screenshot")

    _cleanup_tmp_files()
    _check_dependencies()
    

    try:
        # argv[1] is an optional save directory override passed by applet.js
        save_dir = sys.argv[1] if len(sys.argv) > 1 else None
        overlay = ScreenshotOverlay(save_dir_override=save_dir)

        # Handle SIGUSR1 from duplicate launches: present and focus our window
        def _on_raise_signal(signum, frame):
            from gi.repository import GLib
            def _present():
                def _raise_win(w):
                    """Raise and focus a window, handling both X11 and Wayland."""
                    w.deiconify()
                    if IS_WAYLAND:
                        w.present()
                    else:
                        from gi.repository import Gdk
                        try:
                            ts = Gdk.x11_get_server_time(
                                Gdk.get_default_root_window())
                        except Exception:
                            ts = 0
                        w.present_with_time(ts)

                # The visible window depends on the current state:
                # launcher state → overlay.launcher, editor state → overlay itself
                win = getattr(overlay, 'launcher', None)
                if win and win.get_visible():
                    _raise_win(win)
                elif win and not win.get_visible():
                    win.show_all()
                    _raise_win(win)
                elif overlay.get_visible():
                    _raise_win(overlay)
                else:
                    overlay._show_launcher()
                return False
            GLib.idle_add(_present)

        signal.signal(signal.SIGUSR1, _on_raise_signal)

        Gtk.main()
    except Exception as e:
        # If startup crashes, re-check deps in case something is missing
        _check_dependencies(force=True)
        raise
    finally:
        _remove_lock()
