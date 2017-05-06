
# Ayuda para el applet Traductor Emergente

### ¡IMPORTANTE!
Jamás borrar ninguno de los archivos encontrados dentro de la carpeta de este xlet. Podría romper la funcionalidad del xlet.

***

<h2 style="color:red;">Reportes de fallos, peticiones de características y contribuciones</h2>
<span style="color:red;">
Si cualquiera tiene fallos que reportar, peticiones de características y contribuciones, deben realizarlas <a href="https://github.com/Odyseus/CinnamonTools">en la página de GitHub de este xlet</a>.
</span>

***

### Dependencias

**Si una o más de estas dependencias faltan en su sistema, no podrá utilizar este applet.**

- Comando **xsel**: XSel es un programa de la consola para obtener y asignar los contenidos de una selección en X.
    - Distribuciones basadas en Debian y Archlinux: El paquete es llamado **xsel**.
- Comando **xdg-open**: Abre una URI en la aplicación preferida por el usuario que puede manejar la URI o tipo de archivo respectivo.
    - Distribuciones basadas en Debian y Archlinux: Este comando es instalado por el paquete llamado **xdg-utils**. Instalado por defecto en todas las versiones modernas de Linux Mint.
- **Python 3**: Debería estar ya instalado en todas las distribuciones Linux.
- **requests**, módulo Python 3: Requests permite enviar peticiones HTTP/1.1. Se pueden agregar encabezados, datos de formulario, archivos multi-parte y parámetros con simples diccionarios Python, y acceder a los datos recibidos de la misma manera.
    - Distribuciones basadas en Debian: Este comando es instalado por el paquete llamado **python3-requests**. Instalado por defecto en todas las versiones modernas de Linux Mint.
    - Distribuciones basadas en Archlinux: El paquete es llamado **python-requests**.

**Luego de instalar cualquiera de las dependencias faltantes, Cinnamon necesita ser reiniciado**

**Nota:** Yo no utilizo ningún otro tipo de distribución Linux (basada en Gentoo, basada en Slackware, etc.). Si cualquiera de los paquetes/módulos previamente nombrados son llamados de forma diferente, por favor, háganmelo saber y los especificaré en este archivo de ayuda.

***

### Uso del applet

Existen 4 *mecanismos de traducción* diferentes (**Clic izquierdo**, **Clic medio**, **Atajo de teclado #1** y **Atajo de teclado #2**). Cada mecanismo de traducción puede ser configurado con sus propios servicios de traducción, par de lenguajes y atajos de teclado.

- **Primer mecanismo de traducción (Clic izquierdo):** Traduce cualquier texto seleccionado desde cualquier aplicación en el sistema. Un atajo de teclado puede ser asignado para realizar esta tarea.
- **Primer mecanismo de traducción (<kbd>Ctrl</kbd> + Clic izquierdo):** Igual que **Clic izquierdo**, pero el historial de traducciones será ignorado. Un atajo de teclado puede ser asignado para realizar esta tarea.
- **Segundo mecanismo de traducción (Clic medio):** Igual que **Clic izquierdo**.
- **Segundo mecanismo de traducción (<kbd>Ctrl</kbd> + Clic medio):** Igual que **<kbd>Ctrl</kbd> + Clic izquierdo**.
- **Tercer mecanismo de traducción (Atajo de teclado #1):** Dos atajos de teclado pueden ser configurados para realizar una traducción y una traducción forzada.
- **Tercer mecanismo de traducción (Atajo de teclado #2):** Dos atajos de teclado pueden ser configurados para realizar una traducción y una traducción forzada.

Todas las traducciones son guardadas en el historial de traducciones. Si una cadena de texto ya fue traducida en el pasado, el menú emergente mostrará esa cadena de texto guardada sin hacer uso del servicio de traducción del proveedor.

***

### Sobre el historial de traducción

He creado el mecanismo del historial de traducciones mayormente para evitar el abuso de los servicios de traducción.

- Si el servicio de Google Translate is *abusado*, Google puede que bloquee temporalmente su IP. O lo que es peor, ellos podrían cambiar el mecanismo de traducción usado haciendo este applet inútil y obligándome a actualizar su código.
- Si el servicio de Yandex Translate is *abusado*, usted está *desperdiciando* la cuota de sus llaves de la API y estas serán bloqueadas (temporalmente o permanentemente).

En el menú contextual de este applet existe un ítem que permite abrir la carpeta donde el historial de traducciones está guardado. Desde allí, el archivo de historial puede ser respaldado o incluso borrado.

**¡NUNCA editar el archivo de historial manualmente!**

**Si el archivo de historial es borrado/renombrado/movido, Cinnamon necesita ser reiniciado.**

***

### ¿Cómo obtener llaves de API para Yandex translator?

- Visitar uno de los enlaces siguientes y registrar una cuenta de Yandex (o usar uno de los servicios sociales disponibles).
    - **Inglés:** https://tech.yandex.com/keys/get/?service=trnsl
    - **Ruso:** https://tech.yandex.ru/keys/get/?service=trnsl
- Una vez creada exitosamente la cuenta de Yandex, El enlace proveído anteriormente puede ser visitado varias veces para obtener varias llaves de API. **¡NO ABUSAR!**
- Una vez que se tengan varias llaves de API, ellas pueden ser agregadas a la ventana de configuración de Traductor Emergente (una llave de API por linea).

#### Notas importantes sobre llaves de API Yandex

- Las llaves de API son guardadas en una preferencia. Mantener las llaves de API respaldadas en el caso de que la preferencias de Traductor Emergente sean reiniciadas.
- **¡NUNCA hacer públicas las llaves de API!** El propósito de tomarse la molestia de obtener nuestras propias llaves de API es que el único que *consuma sus límites* es uno y nadie más.
- Con cada llave de API de Yandex Translator uno puede traducir **HASTA** 1.000.000 (1 millón) de caracteres por día **PERO NO MÁS** de 10.000.000 (10 millones) por mes.

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
