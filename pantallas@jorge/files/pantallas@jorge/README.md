# Pantalla — applet de Cinnamon

Controla el **brillo** y la **temperatura de color** de tus monitores desde el panel de Cinnamon, con **modos** personalizables (Día, Noche, los que quieras) y cambio **automático** día/noche.

Funciona por software: aplica brillo y temperatura sobre la tabla de color del GPU con `xrandr`, sin tocar la retroiluminación física. Por eso vale para cualquier monitor —incluidos los que no permiten control por DDC/CI— y para varios monitores a la vez.

## Requisitos

- Cinnamon en **X11** (la sesión por defecto de Linux Mint).
- `xrandr` (viene preinstalado). Sin más dependencias.

## Instalación

1. Copia la carpeta `pantallas@jorge` a `~/.local/share/cinnamon/applets/`.
2. Clic derecho en el panel → **Applets** → busca **«Pantalla»** → añádelo al panel.

Si algo no aparece, recarga Cinnamon: `Alt+F2` → `r` → Enter.

## Uso

- **Clic izquierdo** en el icono: sliders de **brillo** y **temperatura**, botones para **aplicar un modo** (con un punto en el modo activo), **«Guardar valores actuales en…»** y **«Configuración…»**.
- **Configuración** (menú → «Configuración…», o clic derecho → Configurar): crear, editar y borrar **modos** (lista), **brillo mínimo**, y el **automático día/noche**.

### Automático día/noche

Sigue el **Night Light** de Cinnamon (amanecer/atardecer según tu ubicación). Actívalo en la configuración del sistema —a intensidad neutra, para no doblar el tinte— y enciende los interruptores del applet. Puedes activar solo el de noche, solo el de día, o ambos.

## Autor y licencia

- Autor: **Jorge Senosiain**
- Licencia: **GPL-3.0** (ver el archivo `LICENSE`)
- Web: **apps.culturoscope.es**
