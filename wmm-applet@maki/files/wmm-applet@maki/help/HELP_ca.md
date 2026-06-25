# Ajusts

Per obrir el panell de control, fes clic dret sobre la icona de WMM al panell i selecciona **WMM Ajusts**.

## Opcions

Aquí trobaràs les opcions generals de WMM. Canvia el fons en iniciar, tria el mode d'aspecte, efectes d'imatge, color de fons i controla la presentació de diapositives. Cada canvi es reflecteix en temps real als monitors virtuals de la secció **Pantalles**.

### Icona Reinicia
Reinicia completament el motor i el panell de control. És útil si el motor deixa de respondre.

### Icona Visor de Logs
Obre el visor de logs de depuració en una finestra a part. Mostra en temps real tota l'activitat del motor i del panell de control.

### Canvia el fons de pantalla al inici
Si està **activada**, en iniciar l'ordinador el motor tria imatges noves i regenera el fons des de zero.
Si està **desactivada**, es conserva l'última composició guardada (ideal si t'agrada com ho has deixat i no vols canvis inesperats).

### Distribució
Activa o desactiva el **Mode Distribuït** (*Spanned*). Quan s'activa, s'utilitza una única imatge panoràmica que s'estén per tots els monitors alhora.
Només està disponible si hi ha més d'un monitor actiu.

### Relació d'aspecte
Controla com s'ajusta la imatge dins de cada monitor:

- **Escalat** (*Scaled*): La imatge es redueix o s'amplia per a ocupar el monitor completament **sense deformar-la**. Si la imatge no omple tot el monitor, l'espai sobrant s'omple amb el color o efecte de fons seleccionat.
- **Zoom**: La imatge s'escala per a cobrir tot el monitor. Si la imatge i el monitor tenen proporcions diferents, les parts que sobren es retallen.
- **Estirat** (*Stretched*): La imatge s'estira per a ajustar-se exactament a la mida del monitor, encara que es deformi.

### Efecte d'imatge
Aplica un efecte visual sobre la imatge de cada monitor:

- **Cap** (*None*): Sense efecte.
- **Sèpia** (*Sepia*): Aplica un to envellit, marronós, a la imatge.
- **Blanc i negre** (*Black and White*): Converteix la imatge a escala de grisos, eliminant els colors.

### Efecte de fons
Omple l'espai sobrant quan la imatge no cobreix completament el monitor (només visible en mode Escalat). Tens dues opcions:

- **Difuminat** (*Blur*): Agafa la pròpia imatge, la desenfoca i l'usa com a fons, creant un efecte de continuïtat.
- **Color**: Utilitza el color sòlid o degradat que tinguis seleccionat en l'opció "Color de fons".

### Color de fons
Defineix el color de l'espai sobrant quan s'usa el mode Escalat o quan un monitor no té imatge assignada. Tens tres opcions:

- **Color sòlid** (*Solid color*): Un únic color pla. Pots triar-lo amb el selector de color.
- **Degradat Horitzontal** (*Gradient H*): Un degradat de dos colors d'esquerra a dreta.
- **Degradat Vertical** (*Gradient V*): Un degradat de dos colors de dalt a baix.

### Presentació de diapositives
Activa o desactiva el canvi automàtic d'imatges. Quan està activat, el motor canvia les imatges de fons segons la configuració de freqüència i mode.

### Freqüència màxima.
Estableix el límit màxim (en minuts) que pot tenir l'interval de rotació. El control lliscant del menú de l'applet s'ajusta a aquest valor.

### Diapositives cada:
Defineix cada quants minuts el motor canviarà les imatges de fons.

### Mode de presentació
Controla com canvien les imatges els monitors durant la presentació de diapositives:

- **Síncron** (*Sync*): Tots els monitors canvien alhora, agafant una imatge d'un mateix *preset* o de la biblioteca general.
- **Asíncron** (*Async*): Cada monitor canvia pel seu compte, de manera independent.

**Comportament amb Preferits activat:**
- Si **"Només Preferits"** està activat al menú de l'applet, o a la seccio **Favorits**, la presentació de diapositives utilitza exclusivament les imatges dels teus **Favorits**
- Si tens activat el mode **Síncron** la rotació es farà només amb els presets guardats, ignorant la resta de la biblioteca.
- Si tens activat el mode **Asíncron** la rotació es farà només amb els favorits guardats, ignorant la resta de la biblioteca.

## Preferits

Gestiona les teves combinacions de fons preferides. Pots crear, carregar i eliminar presets. Un *preset* és una composició de fons guardada que pots carregar en qualsevol moment.

### Switch "Només favorits"
Si l'actives, la presentació de diapositives utilitza exclusivament les imatges dels teus presets guardats, ignorant la resta de la biblioteca. Si la presentació està en mode síncron, selecciona un preset a l'atzar en cada canvi. En mode asíncron, selecciona imatges individuals de la llista plana de favorits.

### Caixa Presets (esquerra)

- **Carregar un preset als monitors**: fes clic dret sobre el nom del preset i selecciona *"Carrega als monitors"*. El preset es carregarà en el mode d'edició perquè puguis veure'l i modificar-lo abans d'aplicar-lo.
- **Canviar el nom d'un preset**: fes un clic lent sobre el nom del preset (sense fer doble clic). El text es tornarà editable. Escriu el nou nom i prem Enter.
- **Eliminar un preset**: fes clic dret sobre el preset i selecciona *"Elimina el preset"*. També pots seleccionar-lo i prémer el botó de la paperera.
- **Eliminar una imatge d'un preset**: fes clic dret sobre la imatge dins del preset i selecciona *"Elimina la imatge"*. El monitor conservarà la seva posició al preset però sense imatge.
- **Obrir una imatge del preset**: fes doble clic sobre la imatge. S'obrirà amb el visor d'imatges predeterminat del sistema.

### Caixa Favorits (dreta)

- **Afegir una imatge a favorits**: des de la galeria de miniatures, fes clic dret sobre una imatge i selecciona *"Afegeix a favorits"*. També pots afegir-la des del gestor de fitxers Nemo amb l'acció *"WMM: Add to favorites"*.
- **Seleccionar diverses imatges**: pots seleccionar diverses imatges alhora fent servir **Ctrl+clic** (selecció discontínua) o **Maj+clic** (selecció d'un rang continu).
- **Eliminar una imatge de favorits**: fes clic dret sobre la imatge a la llista i selecciona *"Elimina de favorits"*.
- **Obrir una imatge**: fes doble clic sobre la imatge per obrir-la amb el visor d'imatges predeterminat del sistema.

### Botons d'eliminació

Tant la caixa de Presets com la de Favorits tenen un botó amb icona de paperera a la part inferior dreta. Aquest botó elimina l'element seleccionat en aquell moment (un preset, una imatge d'un preset o una imatge de la llista de favorits). Si tens diversos elements seleccionats a la llista de favorits, el botó els eliminarà tots alhora.

## Fonts d'imatge

Des d'aquí pots afegir, eliminar i gestionar les carpetes que WMM utilitza per cercar imatges. Cada carpeta es mostra amb les seves subcarpetes (si la recursivitat està activada) i pots controlar quines estan actives.
En els processos i funcionalitats d'aquesta secció **mai no s'eliminen carpetes ni imatges originals del disc.** Únicament s'eliminen les seves referències a la bliblioteca i les seves **miniatures** a la memòria cau

### Botó "Afegeix una font"
Obre un diàleg per seleccionar una carpeta del sistema. En seleccionar-la:

- **Carpeta amb subcarpetes**: marca la casella *"Inclou subcarpetes (Recursiu)"* si vols que WMM cerqui imatges també dins de totes les subcarpetes.
- **Carpeta sense subcarpetes**: deixa la casella desmarcada per indexar només les imatges de la carpeta arrel.
- En prémer **"Afegeix"**, la carpeta es registra a la llista de fonts, però **no s'escaneja immediatament**. Queda preparada per ser processada.
- Les miniatures es generaran i la carpeta s'indexarà en la **propera sincronització**, que pot ser:
  - Quan premis el botó **"Resincronitza"**.
  - Quan obris el panell de control en una nova sessió.
  - Quan forces una **"Sincronització de la biblioteca"** des del menú de l'applet.
  - Quan el motor s'inicia.
- Fins que no es produeixi una d'aquestes accions, la carpeta apareixerà a la llista però no veuràs les seves imatges a la galeria.

### Botó "Elimina una font"
Elimina la carpeta seleccionada **de la biblioteca d'imatges.** Abans d'eliminar-la, es mostra un diàleg de confirmació. Si acceptes:

- La carpeta desapareix de la llista de fonts.
- **Les miniatures no s'esborren immediatament.** Romanen a la memòria cau fins que es faci una neteja. Pots eliminar-les de tres maneres:
  - Manualment: fent clic dret a la carpeta (o subcarpeta) i seleccionant **"Elimina la memòria cau"**.
  - Automàticament: en prémer el botó **"Resincronitza"** (el motor detecta que la font ja no existeix i neteja la seva caché).
  - Automàticament: durant un cicle de manteniment (sincronització de la biblioteca des de l'applet o a l'inici del motor).

### Botó "Resincronitza"
Torna a escanejar totes les fonts d'imatge i actualitza la biblioteca. Has de fer servir aquest botó quan:

- **Afegeixes o elimines imatges** manualment dins de les carpetes de WMM.
- **Canvies el nom o l'estructura** de les subcarpetes.
- Vols **regenerar les miniatures** després d'haver mogut o modificat imatges.

Durant la sincronització, WMM recorre totes les carpetes actives, detecta imatges noves, **elimina miniatures** les que ja no existeixen i actualitza la galeria de miniatures. En finalitzar, rebràs una notificació amb el resum dels canvis.

### Navegació per l'arbre de carpetes

#### Doble clic en una carpeta
Obre la carpeta amb el gestor de fitxers del sistema perquè puguis veure'n el contingut directament.

#### Clic dret en una carpeta pare
Mostra un menú contextual amb aquestes opcions:

- **Activa/Desactiva la carpeta**: si la desactives, la carpeta i totes les seves subcarpetes deixaran de mostrar-se a la galeria de miniatures. Les imatges no s'inclouran en la presentació de diapositives. És útil per amagar temporalment una carpeta sense eliminar-la.
- **Activa/Desactiva totes les subcarpetes**: aplica el mateix estat (activat o desactivat) a totes les subcarpetes de la carpeta seleccionada. Ideal per gestionar carpetes amb moltes subcarpetes de cop.
- **Elimina de la memòria cau de la carpeta**: aquesta opció **només apareix si la carpeta ha estat prèviament desactivada**. Esborra les **miniatures** associades per alliberar espai.

#### Clic dret en una subcarpeta
Mostra un menú contextual amb aquestes opcions:

- **Activa/Desactiva la subcarpeta**: controla si les imatges d'aquesta subcarpeta en concret es mostren a la galeria i s'inclouen en la presentació.
- **Elimina la memòria cau de la subcarpeta**: esborra les **miniatures** d'aquesta subcarpeta específica.

### Activar/Desactivar la recursivitat
La columna *"Recursiu"* de l'arbre de carpetes mostra un interruptor per a cada carpeta pare. Quan està **activat**, WMM indexa totes les subcarpetes dins d'aquesta font. Quan està **desactivat**, només indexa les imatges de la carpeta arrel, ignorant les subcarpetes.

Si actives la recursivitat, l'arbre de carpetes es desplega automàticament per mostrar les subcarpetes actives. Si la desactives, les subcarpetes no desapareixeran immediatament. El canvi es farà efectiu en la propera sincronització (en prémer "Resincronitza", en obrir el panell de nou, al forçar una sincronització de la biblioteca o en el següent inici del motor). Fins llavors, les subcarpetes romandran a la galeria i a la presentació de diapositives.

## Monitors

Aquí es mostren els teus monitors com a miniatures. La secció s'actualitza en temps real amb qualsevol canvi: rotació de fons, canvis de geometria, encesa/apagada de monitors, etc.

### Botonera d'alineació

A la capçalera de la secció trobaràs tres botons: `[` , `•` i `]`. Serveixen per canviar l'alineació horitzontal del bloc de monitors dins de la finestra:

- **`[`** : alineació a l'esquerra.
- **`•`** : alineació centrada.
- **`]`** : alineació a la dreta.

És útil quan tens monitors amb geometries molt diferents i vols ajustar visualment la previsualització.

### Mode normal

En mode normal, la secció mostra una miniatura de cada monitor amb la imatge que té assignada i un interruptor a la part superior per activar-lo o desactivar-lo.

#### Interruptors de monitor

Cada interruptor té dues funcions:
- **Activat**: el monitor mostra la imatge que té assignada. Si no en té cap, se li assignarà una automàticament segons la seva orientació.
- **Desactivat**: el monitor es pinta amb el color de fons seleccionat (sòlid o degradat) i no participa en la rotació de diapositives.

Si el **Mode Distribuït** està activat, els interruptors queden bloquejats (no es poden canviar) perquè una única imatge s'estén per tots els monitors.

#### Botons d'acció

- **Casella "Favorit"**: si la marques, en prémer **Acepta** es guardarà la composició actual com un preset nou.
- **Acepta**: guarda la composició actual com a preset (si la casella està marcada) o simplement aplica els canvis a les teves pantalles. Si no es marca la casella, no es desa cap preset.
- **Actualitza**: refresca la vista dels monitors des del motor. Útil si detectes que la previsualització no coincideix amb la realitat.

### Mode d'edició

Per activar-lo, prem el botó **Mode d'edició** (icona del llapis). La secció canvia per permetre't assignar imatges manualment a cada monitor.

#### Arrossegar i deixar anar (Drag & Drop)

Pots arrossegar qualsevol imatge des de la galeria de miniatures i deixar-la anar sobre el monitor virtual on vulguis assignar-la. El monitor s'actualitza a l'instant amb la nova imatge.

#### Panell d'opcions d'edició

Quan el mode d'edició està actiu, apareix un panell amb opcions específiques per a la composició que estàs creant:

- **Distribució (Spanned)**: activa o desactiva el mode distribuït per a aquesta composició.
- **Relació d'aspecte**: tria el mode d'ajust per a les imatges d'aquesta composició.
- **Efectes**: aplica un efecte d'imatge (sèpia, blanc i negre) a la composició.

Podràs veure l'efecte en manipular aquestes opcions en temps real.
Aquests valors es guarden juntament amb el preset i tenen prioritat sobre la configuració global.

#### Botons d'acció en mode edició

- **Casella "Favorit"**: si la marques, en prémer **Acepta** es guardarà la composició editada com un preset (creant-ne un de nou o actualitzant el que havies carregat).
- **Acepta**: aplica els canvis al motor i surt del mode d'edició. Si la casella de favorit està marcada, també desa el preset.
- **Actualitza**: buida totes les imatges dels monitors i els deixa sense imatge, perquè puguis començar de zero.

## Miniatures

La galeria d'imatges disponibles. Aquí es mostren totes les imatges que WMM ha indexat a les teves fonts. Les miniatures es generen automàticament i es desen a la memòria cau perquè la navegació sigui ràpida.

### Botó Actualitza

A la dreta dels botons H/V trobaràs un botó amb la icona de refresc. En prémer-lo, es regeneren totes les miniatures de la galeria. És útil si has modificat imatges fora de WMM (per exemple, si les has editades amb un programa extern) i vols veure els canvis reflectits sense haver de fer una sincronització completa de la biblioteca.

### Botons H / V

A la capçalera de la secció trobaràs dos botons: **Horizontal** i **Vertical**. En prémer'ls, la galeria es desplaça automàticament fins a la primera imatge de l'orientació seleccionada. Són una ajuda ràpida per navegar per la galeria sense haver de fer scroll manual.

### Disposició i ordre

Les miniatures es mostren en un mosaic que s'adapta a l'amplada de la finestra. L'ordre és fix:

- Primer, totes les imatges **horitzontals**.
- Després, totes les imatges **verticals**.

Dins de cada grup, les imatges apareixen ordenades per carpeta (segons l'ordre de les fonts d'imatge) i alfabèticament dins de cada carpeta.

### Interacció amb les miniatures

Pots interactuar amb qualsevol miniatura de tres maneres:

- **Doble clic**: obre la imatge original amb el visor d'imatges predeterminat del sistema.
- **Clic dret**: mostra un menú contextual amb dues opcions:
  - *"Afegeix a favorits"*: afegeix la imatge a la llista plana de favorits.
  - *"Elimina de favorits"*: treu la imatge de la llista de favorits (només apareix si la imatge ja és favorita).
- **Arrossegar (Drag & Drop)**: pots arrossegar qualsevol miniatura i deixar-la anar sobre un monitor virtual a la secció **Monitors** (només en mode d'edició). La imatge s'assignarà a aquell monitor.

### Marc de favorit

Les imatges que has afegit a la llista de favorits es destaquen visualment amb un marc de color verd al voltant de la miniatura. Així pots identificar-les ràpidament mentre navegues per la galeria.

# Favorits

El menú Favorits de l'applet permet accedir ràpidament als presets guardats i crear-ne de nous amb la composició actual del fons.

### Switch "Només favorits"

Si l'actives, la presentació de diapositives utilitza exclusivament les imatges dels teus presets guardats, ignorant la resta de la biblioteca. Quan està activat, el mode de presentació canvia el seu comportament:

- **Mode síncron**: selecciona un preset a l'atzar en cada canvi i l'aplica a tots els monitors alhora.
- **Mode asíncron**: selecciona imatges individuals de la llista plana de favorits i les assigna als monitors per torns.

Si actives aquest switch mentre el temporitzador està apagat, el motor l'engegarà automàticament perquè la rotació pugui funcionar.

### Afegir un preset

En prémer **"Add Preset Favorite"**, s'obre un petit diàleg on pots posar nom a la composició actual de fons. WMM suggereix un nom automàtic (per exemple, *"Bookmark 01"*), però pots escriure el que vulguis.

- **Nom en blanc**: si deixes el camp buit i prems **OK**, el diàleg t'avisa i no es desa res.
- **Nom repetit**: si escrius un nom que ja existeix, el diàleg t'avisa i has de triar-ne un de diferent.
- **Gravació del preset**: en prémer **OK** amb un nom vàlid, el preset es desa automàticament amb la configuració actual de tots els monitors, incloent les imatges, el mode d'aspecte, l'efecte d'imatge i el mode distribuït.

### Llista de presets

Sota el switch i el botó d'afegir, apareix una llista amb tots els presets que tens guardats. Si la llista és llarga, es mostra una barra de desplaçament per navegar-hi.

- **Carregar un preset**: fes clic sobre el nom del preset. WMM aturarà el temporitzador (si estava actiu) i aplicarà la composició guardada als monitors immediatament.
- **Eliminar un preset**: fes clic a la icona de la paperera que hi ha a la dreta de cada preset. Es mostrarà un diàleg de confirmació. Si l'elimines, el preset desapareix de la llista i de la llista plana de favorits.

# Presentació de diapositives

Des d'aquest menú pots controlar el canvi automàtic d'imatges de fons. Quan la presentació està activa, el motor canvia les imatges segons l'interval i el mode que tinguis configurats al panell de control.

### Switch "Activat / Desactivat"

L'interruptor principal encén o apaga completament el temporitzador de rotació.

- **Activat**: el motor inicia el comptador enrere immediatament. El primer canvi d'imatges es produirà un cop transcorregut l'interval configurat (per defecte, 15 minuts). Si l'interval és molt curt, el canvi pot ser gairebé instantani.
- **Desactivat**: el temporitzador s'atura. Es manté el fons actual sense canvis fins que el tornis a activar o facis una rotació manual.

Quan actives el temporitzador des d'aquí, el panell de control es sincronitza automàticament per reflectir el canvi.

### Control lliscant (Slider)

Just a sota de l'interruptor trobaràs un control lliscant que et permet ajustar l'interval de canvi sense obrir el panell de control.

- **Arrossega** el control per triar els minuts que vols que passin entre cada canvi d'imatge.
- Mentre l'arrossegues, veuràs el valor en minuts al costat del control.
- En **deixar anar** el control, el valor es desa automàticament i el motor actualitza el temporitzador a l'instant.

El valor mínim és d'1 minut. El valor màxim ve definit per l'opció **"Freq. Max."** del panell de control (per defecte, 60 minuts).

# Monitors (Mode de Rotació)

Aquest interruptor controla el mode de canvi de fons entre els monitors.

- **ASYNC (One)**: cada monitor canvia per torns. En cada cicle de rotació, només un monitor rep una imatge nova, mentre que els altres conserven la que tenen.
- **SYNC (All)**: tots els monitors canvien alhora, aplicant una composició completa de manera simultània.

El canvi entre un mode i l'altre és immediat i no reinicia el temporitzador.

# Mode Distribuït (Spanned)

Activa o desactiva el mode de fons estès. Quan està activat, una única imatge panoràmica s'estén per tots els monitors, cobrint el llenç complet. Aquesta opció només té efecte si hi ha més d'un monitor actiu.
L'aplicació del mode distribuït és immediata

En activar-lo, els interruptors individuals dels monitors al Centre de Control es bloquegen (no es poden canviar), ja que la imatge és comuna per a tots.

# Sincronitzar Biblioteca

Aquesta opció força un escaneig complet de totes les fonts d'imatge configurades. WMM recorre les carpetes actives, detecta imatges noves, elimina referències a imatges que ja no existeixen i actualitza la galeria de miniatures.

En finalitzar, rebràs una notificació amb el resum dels canvis (nombre d'imatges noves i eliminades). És útil després d'afegir o treure imatges manualment de les carpetes de WMM.

# Dreceres de teclat

Pots forçar un canvi de fons sense fer servir el ratolí configurant una drecera de teclat personalitzada al teu escriptori. WMM inclou un petit script preparat per a això.

## En Cinnamon

1.  Obre **Configuració del sistema → Teclat → Dreceres de teclat**.
2.  Fes clic a **Afegeix una drecera personalitzada**.
3.  Posa-li el nom **"WMM - Canviar fons de pantalla"**.
4.  Al camp **Comanda**, escriu:

    `bash -c "bash $HOME/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh"`

5.  Assigna la combinació de tecles que prefereixis (per exemple, Ctrl+Alt+N).
6.  Prem Accepta i prova la drecera.

## En GNOME

1.  Obre Configuració → Teclat → Dreceres personalitzades.
2.  Fes clic a "+" per afegir-ne una de nova.
3.  Posa-li el nom "WMM - Canviar fons de pantalla".
4.  Al camp Comanda, escriu:

    `bash -c "bash $HOME/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh"`

5.  Assigna la combinació de tecles que prefereixis (per exemple, Ctrl+Alt+N).
6.  Tanca la finestra i prova la drecera.

Nota: El script wmm-next.sh s'instal·la automàticament amb WMM i hauria de tenir els permisos d'execució correctes. Si la drecera no funciona, assegura't que el script sigui executable:

    **Per a GNOME**

    `chmod +x ~/.local/share/gnome-shell/extensions/wmm@maki/wmm_platform/shell/gnome/wmm-next.sh`

    **Per a Cinnamon**

    `chmod +x ~/.local/share/cinnamon/applets/wmm-applet@maki/wmm_platform/shell/cinnamon/wmm-next.sh`

# Ajuda

Obre la finestra d'ajuda de WMM, on trobaràs informació detallada sobre totes les funcionalitats del programa. La finestra compta amb un índex de navegació a l'esquerra i el contingut formatejat a la dreta.
