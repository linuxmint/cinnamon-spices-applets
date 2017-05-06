
# Ayuda para el applet Monitor de Sistema (Modificado por Odyseus)

### ¡IMPORTANTE!
Jamás borrar ninguno de los archivos encontrados dentro de la carpeta de este xlet. Podría romper la funcionalidad del xlet.

***

<h2 style="color:red;">Reportes de fallos, peticiones de características y contribuciones</h2>
<span style="color:red;">
Si cualquiera tiene fallos que reportar, peticiones de características y contribuciones, deben realizarlas <a href="https://github.com/Odyseus/CinnamonTools">en la página de GitHub de este xlet</a>.
</span>

***

### Dependencias

- **gir1.2-gtop-2.0**: La biblioteca gtop lee información acerca de procesos y el estado del
sistema.
    - Distribuciones basadas en Debian: El packate es llamado **gir1.2-gtop-2.0**.
    - Distribuciones basadas en Archlinux: El packate es llamado **libgtop**.
    - Distribuciones basadas en Fedora: El packate es llamado **libgtop2-devel**.
- **NetworkManager**: NetworkManager es un servicio de red del sistema que administra los dispositivos y conexiones de red, intentando mantener una conectividad de red activa cuando está disponible.
    - Distribuciones basadas en Debian: El packate es llamado **gir1.2-networkmanager-1.0**.
    - Distribuciones basadas en Archlinux: El packate es llamado **networkmanager**.
    - Distribuciones basadas en Fedora: El packate es llamado **NetworkManager**.

**Nota importante:** NetworkManager is usado sólo si la versión de la librería **GTop** instalada en el sistema es < 2.32 y no soporta ciertas llamadas a la librería. Básicamente, si el gráfico de red de este applet funciona sin tener instalado NetworkManager, entonces no es necesario que sea instalado.

**Reiniciar Cinnamon luego de haber instalado los paquetes para que el applet los reconozca.**

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
