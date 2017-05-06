
# Ayuda para el applet Menú Rápido

### ¡IMPORTANTE!
Jamás borrar ninguno de los archivos encontrados dentro de la carpeta de este xlet. Podría romper la funcionalidad del xlet.

***

<h2 style="color:red;">Reportes de fallos, peticiones de características y contribuciones</h2>
<span style="color:red;">
Si cualquiera tiene fallos que reportar, peticiones de características y contribuciones, deben realizarlas <a href="https://github.com/Odyseus/CinnamonTools">en la página de GitHub de este xlet</a>.
</span>

***

### Uso del applet

- Ítems del menú a archivos .desktop serán mostrados con el ícono y el nombre declarado dentro de los mismos archivos .desktop.
- El menú puede ser mantenido abierto mientras se activan menú ítems con sólo presionar <kbd>Ctrl</kbd> + **Clic Izquierdo** o **Clic Medio**.

***

### Cómo especificar un ícono diferente por cada sub menú ítem
- Crear un archivo al mismo nivel que las carpetas que van a ser usadas para crear los sub menúes.
- El nombre del archivo puede ser personalizado, no necesita tener una extensión y puede ser un archivo oculto (un archivo "punto"). Por defecto is llamado **0_icons_for_sub_menus.json** (íconos para sub menúes).
- Cualquiera sea el nombre elegido para el archivo, éste será automáticamente ignorado y jamás será mostrado en el menú.
- La ruta del ícono tiene que ser una ruta completa. Una ruta que comienza con **~/** puede ser usada y será.
- Si cualquier sub carpeta contiene carpetas que necesitan tener sus propios íconos, sólo se tiene que crear otro archivo **0_icons_for_sub_menus.json** al mismo nivel que esas carpetas.
- El contenido del archivo es un **objeto JSON** y tiene que lucir como sigue:
```json
{
    "Nombre de carpeta 1": "Nombre de ícono o ruta de ícono para la Nombre de carpeta 1",
    "Nombre de carpeta 2": "Nombre de ícono o ruta de ícono para la Nombre de carpeta 2",
    "Nombre de carpeta 3": "Nombre de ícono o ruta de ícono para la Nombre de carpeta 3",
    "Nombre de carpeta n": "Nombre de ícono o ruta de ícono para la Nombre de carpeta n"
}
```

**¡Advertencia!** El *lenguaje* JSON es muy estricto. Asegurarse de utilizar **SOLAMENTE** comillas dobles. Y la combinación llave/valor **no tiene que finalizar con una coma**.(**Nombre de carpeta n** en el ejemplo anterior).

***

### Localización de applets/desklets/extensiones (también conocidos como xlets)

- Si este xlet se instaló desde Configuración de Cinnamon, todas las localizaciones de este xlet se instalaron automáticamente.
- Si este xlet se instaló manualmente y no a través de Configuración de Cinnamon, las localizaciones se pueden instalar ejecutando el archivo llamado **localizations.sh** desde una terminal abierta dentro de la carpeta del xlet.
- Si este xlet no está disponible en su idioma, la localización puede ser creada siguiendo [estas instrucciones](https://github.com/Odyseus/CinnamonTools/wiki/Xlet-localization) y luego enviarme el archivo .po.
    - Si se posee una cuenta de GitHub:
        - Puede enviar una "pull request" con el nuevo archivo de localización.
        - Si no se desea clonar el repositorio, simplemente crear un [Gist](https://gist.github.com/) y enviarme el enlace.
    - Si no se posee o no se quiere una cuenta de GitHub:
        - Se puede enviar un [Pastebin](http://pastebin.com/) (o servicio similar) a mi [cuenta en el foro de Linux Mint](https://forums.linuxmint.com/memberlist.php?mode=viewprofile&u=164858).
- Si el texto fuente (en Inglés) y/o mi traducción al Español contiene errores o inconsistencias, no dude en informarlos.
