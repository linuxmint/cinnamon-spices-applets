# WMM - Wallpaper Multi-Monitor Manager

Un gestor de fondos de pantalla para configuraciones multi-monitor en **Cinnamon** y **GNOME Shell**.
Olvídate de fondos deformados, recortados o repetidos.
Con WMM, tú tienes el control total.

<p align="center">
  <a href="screenshots/screenshot.png">
    <img src="screenshots/screenshot.png" alt="WMM Screenshot" width="100%"/>
  </a>
</p>

## ✨ Características principales

*   **Gestión multi-monitor real**: Asigna fondos diferentes a cada monitor o "extiende" (spanned) una imagen panorámica por todos ellos.
*   **Asignación de imágenes**: Intenta adaptar la imagen más apropiada a cada monitor según su orientación (Vertical-Horizontal).
*   **Modos de aspecto flexibles**: Controla cómo se ajusta la imagen: `Scaled` (sin deformar), `Zoom` (llenar recortando) o `Stretched` (llenar deformando).
*   **Efectos visuales**: Aplica filtros `Sepia` o `Blanco y Negro` a las imágenes por monitor.
*   **Efectos de fondo**: Aplica filtros `Desenfoque` o `Color` al fondo si la imagen no ocupa toda el área del monitor.
*   **Rotación automática**: Configura un temporizador para cambiar los fondos automáticamente, ya sea de forma síncrona o asíncrona.
*   **Favoritos (Presets)**: Guarda tus combinaciones de fondos favoritas como "Presets" y carga la que quieras al instante.
*   **Internacionalización**: Interfaz preparada para múltiples idiomas (Inglés, Español, Catalán), con dominio de traducción propio y totalmente independiente del escritorio.
*   **Compatibilidad multi-entorno**: Funciona tanto en Cinnamon como en GNOME Shell. El instalador detecta tu escritorio y copia automáticamente los archivos correctos.

## 🖥️ Entornos soportados

| Escritorio          | Soporte       | Notas                                                 |
|---------------------|---------------|-------------------------------------------------------|
| **Cinnamon**        | Completo      | Applet nativo con todas las funciones                 |
| **GNOME Shell**     | Completo      | Extensión con menú contextual idéntico al de Cinnamon |
| **KDE Plasma**      | En desarrollo | Módulo de plataforma preparado                        |
| **Windows / macOS** | Planeado      | Módulos de plataforma ya esbozados                    |

## ⚙️ Configuración ideal del sistema

Para que WMM funcione correctamente y las transiciones de fondos sean limpias, necesita que el escritorio tenga los siguientes ajustes en Configuración del sistema → Fondos de pantalla:

| Ajuste                           | Valor necesario       | Motivo                                                        |
|----------------------------------|-----------------------|---------------------------------------------------------------|
| Relación de aspecto de la imagen | Distribuida (spanned) | Evitar que el sistema deforme o recorte la composición de WMM |
| Tipo de degradado                | Sólido (solid)        | Evitar mezclas con otros colores durante la transición        |
| Presentación de diapositivas     | Desactivada (false)   | Evitar que el sistema interfiera en los cambios de WMM        |

*   WMM intenta forzar estos ajustes automáticamente cada vez que aplica un fondo.
*   Si no puede (por ejemplo, por restricciones del sistema), te mostrará una notificación con los pasos a seguir.
*   Puedes configurarlos manualmente en cualquier momento en Configuración del sistema → Fondos de pantalla.

## 🚀 Instalación

*   Descarga o clona este repositorio en tu ordenador.
*   Abre una terminal en la carpeta raíz del proyecto.
*   Ejecuta el script de instalación:
    ```bash
    chmod +x install.sh
    ./install.sh
    ```

*   El script detectará tu escritorio (Cinnamon o GNOME), comprobará las dependencias y te preguntará si quieres instalarlas automáticamente.

*   En Cinnamon: Ve a la configuración de Applets, busca "WMM Manager" y actívalo.

*   En GNOME: Abre la aplicación «Extensiones» (instálala con sudo apt install gnome-shell-extension-prefs si no la tienes), busca "WMM Manager" y actívala. Luego reinicia sesión (Wayland) o recarga GNOME Shell con Alt+F2 → r (X11).

## 🔧 Instalación manual

Si prefieres no usar el script:

1.  **Crea la carpeta del applet**:

      Para Cinnamon:
      ```bash
      mkdir -p ~/.local/share/cinnamon/applets/wmm-applet@maki
      ```
      Para GNOME:
      ```bash
      mkdir -p ~/.local/share/gnome-shell/extensions/wmm@maki
      ```
2. Copia los archivos del proyecto en esa carpeta (el contenido del zip, no la carpeta padre)
3. Copia el archivo JavaScript y metadata correctos según tu escritorio:
       Para Cinnamon:
       ```bash
       cp wmm_platform/shell/cinnamon/metadata.cinnamon.json ~/.local/share/cinnamon/applets/wmm-applet@maki/metadata.json
       cp wmm_platform/shell/cinnamon/applet.js ~/.local/share/cinnamon/applets/wmm-applet@maki/applet.js
       ```

       Para GNOME:
       ```bash
       cp wmm_platform/shell/gnome/metadata.gnome.json ~/.local/share/gnome-shell/extensions/wmm@maki/metadata.json
       cp wmm_platform/shell/gnome/extension.js ~/.local/share/gnome-shell/extensions/wmm@maki/extension.js
       ```

4.  **Compila las traducciones**
       ```bash
       for po in po/*.po; do lang=$(basename "$po" .po); msgfmt "$po" -o ~/.local/share/locale/$lang/LC_MESSAGES/wmm-applet@maki.mo; done
       ```

5.  **Instalar dependencias** listadas a continuacion:
6.  Reinicia la sesion de usuario y **Activa el applet:** Ve a la configuración de Applets de Cinnamon o el Gestro de Extensiones en Gnome, busca **WMM - Wallpaper Multi-Monitor Manager** y actívalo.

### 📋 Dependencias

Antes de instalar, asegúrate de tener estas dependencias. Puedes instalarlas manualmente o dejar que el script `install.sh` lo haga por ti.

| Paquete                       | Descripción                                                          |
|------------------------------ |----------------------------------------------------------------------|
| **Dependencias instalables**  | **(se instalan con `install.sh`)**                                   |
| `python3`                     | Intérprete de Python 3                                               |
| `python3-pillow`              | Librería de manipulación de imágenes                                 |
| `python3-numpy`               | Librería de computación científica para procesado rápido de imágenes |
| `libnotify-bin`               | Para enviar notificaciones de escritorio                             |
| **Dependencias del sistema**  | **(vienen con Cinnamon y Gnome)**                                    |
| `python3-gi`                  | Bindings de GTK para Python                                          |
| `python3-gi-cairo`            | Bindings de Cairo para Python                                        |
| `gir1.2-gtk-3.0`              | Información de tipos para GTK+ 3.0                                   |
| `gir1.2-glib-2.0`             | Información de tipos para GLib 2.0                                   |
| `gettext`                     | Herramientas de internacionalización                                 |
| `zenity`                      | Para mostrar diálogos gráficos                                       |
| `procps`                      | Para la herramienta de gestión de procesos `pkill`                   |
| **Dependencias de Gnome**     | **(se instalan con `install.sh`)**                                   |
| `gnome-extensions`            | Soporte para extensiones en GNOME                                    |
| `gnome-shell-extension-prefs` | Interfaz grafica para GNOME Shell Extensions                         |

### Instalación rápida de dependencias (si no usas `install.sh`)

*   **Linux Mint / Ubuntu / Debian**:
       ```bash
       sudo apt install -y python3 python3-pillow python3-numpy libnotify-bin
       ```
       Solo en GNOME:
       ```bash
       sudo apt install -y gnome-shell-extension-prefs
       ```

*   **Fedora**:
       ```bash
       sudo dnf install -y python3 python3-pillow python3-numpy libnotify
       ```

*   **Arch Linux / Manjaro**:
       ```bash
       sudo pacman -Sy --noconfirm python python-pillow python-numpy libnotify
       ```

       Solo en GNOME:
       ```bash
       sudo pacman -Sy --noconfirm gnome-shell-extensions
       ```

### 🗑️ Desinstalación

1.  En Cinnamon: haz clic derecho en el applet del panel y selecciona **Eliminar**. Abre **Miniaplicaciones**, busca **WMM Manager** y pulsa **Desinstalar**.
2.  En GNOME: abre la aplicación **Extensiones**, busca **WMM Manager** y desactívala. Luego usa la opcion **Quitar**
3.  Borra la carpeta de caché:
    ```bash
    rm -rf ~/.cache/wmm
    ```

4.  Elimina las acciones de Nemo (Cinnamon) o los scripts de Nautilus (GNOME) instalados previamente:

       Acciones de Nemo (Cinnamon)
       ```bash
       rm ~/.local/share/nemo/actions/wmm-*
       ```

       Scripts de Nautilus (GNOME)
       ```bash
       rm ~/.local/share/nautilus/scripts/wmm-*
       ``
## ⌨️ Atajos de teclado

Si quieres forzar la rotación de fondos sin usar el ratón, puedes configurar un atajo de teclado personalizado en tu escritorio. WMM incluye un pequeño script preparado para ello.

### 🖥️ En Cinnamon

1.  Abre **Configuración del sistema → Teclado → Atajos de teclado**.
2.  Haz clic en **Añadir atajo personalizado**.
3.  Ponle el nombre **"WMM - Cambiar fondo de pantalla"**.
4.  En el campo **Comando**, escribe:

    ```bash
    bash -c "bash $HOME/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh"
    ```

5.  Asigna la combinación de teclas que prefieras (por ejemplo, `Ctrl+Alt+N`).
6.  Pulsa **Aceptar** y prueba el atajo.

### 🖥️ En GNOME

1.  Abre **Configuración → Teclado → Atajos personalizados**.
2.  Haz clic en **"+"** para añadir uno nuevo.
3.  Ponle el nombre **"WMM - Cambiar fondo de pantalla"**.
4.  En el campo **Comando**, escribe:

    ```bash
    bash -c "bash $HOME/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh"
    ```

5.  Asigna la combinación de teclas que prefieras (por ejemplo, `Ctrl+Alt+N`).
6.  Cierra la ventana y prueba el atajo.

**Nota:** El script `wmm-next.sh` se instala automáticamente con WMM y debería tener los permisos de ejecución correctos. Si el atajo no funciona, asegúrate de que el script sea ejecutable:

    ```bash
    chmod +x ~/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh   # para GNOME
    chmod +x ~/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh # para Cinnamon
    ```

## 🛠️ Visor de depuración / Registro de eventos

WMM incluye un sistema de registro integrado que graba la actividad del motor, el panel y los scripts en tiempo real. Puedes consultar los registros en cualquier momento sin reiniciar la aplicación.

*   **Abrir el Visor de Registros**: En el Panel de Control, haz clic en el botón **Log** (icono de documento). Se abrirá una ventana independiente que muestra los eventos del motor, el panel y las acciones de Nemo con marca de tiempo.
*   **Actualización en tiempo real**: El visor se refresca automáticamente según se escriben nuevos eventos. Usa los filtros (origen, nivel, motivo) o la barra de búsqueda para encontrar exactamente lo que necesitas.
*   **Inspección manual**: El archivo de registro se guarda en `~/.cache/wmm/debug.log`. Puedes abrirlo con cualquier editor de texto, usar el visor del panel, o ejecutar el siguiente comando para mostrarlo directamente en una terminal:

    ```bash
    python3 ~/.local/share/cinnamon/applets/wmm-applet@maki/python/debug_logger.py
    ```

## 🌍 Traducción

WMM soporta múltiples idiomas. Las traducciones se instalan automáticamente al ejecutar install.sh.
*   Los archivos fuente se encuentran en la carpeta locale/ del proyecto.
*   La interfaz se mostrará automáticamente en tu idioma si las traducciones están disponibles.
*   Todas las cadenas traducibles están centralizadas en el dominio propio de WMM, completamente independiente de las traducciones del sistema. Esto garantiza la compatibilidad con cualquier escritorio o sistema operativo.

Si quieres ayudarnos a traducir WMM a tu idioma, ¡serás más que bienvenido!

## 📜 Licencia

WMM se distribuye bajo la licencia [GPL-3.0](LICENSE).
Eres libre de usar, modificar y distribuir este software, siempre que mantengas la misma licencia y la atribución a los autores originales.
