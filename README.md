# cinnamon-spices-applets

Deze repository bevat alle applets die beschikbaar zijn voor de Cinnamon-bureaubladomgeving.

Gebruikers kunnen Spices installeren vanuit https://cinnamon-spices.linuxmint.com, of rechtstreeks vanuit Cinnamon -> Systeeminstellingen.

# Definities

## UUID

Elke spice krijgt een unieke naam waarmee deze wordt geïdentificeerd.

Die naam is hun UUID en het is uniek.

## Auteur

Elke spice heeft een auteur.

De github-gebruikersnaam van de auteur is opgegeven in het info.json-bestand van de spice.

# Bestandsstructuur

Een spice kan veel bestanden bevatten, maar het zou de volgende bestandsstructuur moeten hebben:

- UUID/
- UUID/info.json
- UUID/icon.png
- UUID/screenshot.png
- UUID/README.md
- UUID/files/
- UUID/files/UUID
- UUID/files/UUID/metadata.json
- UUID/files/UUID/applet.js

Er zijn twee belangrijke mappen:

- UUID/ is de hoofdmap map, het bevat bestanden die worden gebruikt door de website en op github.
- UUID/bestanden/ vertegenwoordigt de inhoud van het ZIP-archief waar gebruikers van kunnen downloaden https://cinnamon-spices.linuxmint.com of die naar Cinnamon wordt gestuurd wanneer het spice wordt geïnstalleerd vanuit Systeeminstellingen. Dit is de inhoud die wordt geïnterpreteerd door Cinnamon zelf.

Zoals je ziet, wordt de inhoud van de specerij niet in UUID /bestanden/ rechtstreeks geplaatst, maar in plaats daarvan in UUID/ bestanden /UUID/. Dit garandeert dat bestanden niet direct in het bestandssysteem worden uitgepakt, maar in de juiste UUID-map worden geplaatst. De aanwezigheid van deze UUID-map, binnenkant van bestanden / is eigenlijk niet nodig door Cinnamon (omdat Cinnamon deze maakt als deze ontbreekt), maar het is nodig om een goede handmatige installatie te garanderen (dat wil zeggen wanneer gebruikers de ZIP downloaden van de Cinnamon Spices-website ).

Belangrijke opmerking:

- De UUID/bestanden/ map moet "leeg" zijn, wat betekent dat deze ALLEEN de UUID-map zou moeten bevatten. Anders kuunen spices niet worden geïnstalleerd via Systeeminstellingen.

Op het hoogste niveau (root):

- info.json bevat informatie over de spice. Dit is b.v het bestand dat de github-gebruikersnaam van de spices auteur bevat.
- icon.png is het pictogram dat is gekoppeld aan de spice.
- screenshot.png is een screenshot van de spice in actie.
- README.md is optioneel en kan worden gebruikt om instructies en informatie over de spice weer te geven. Het verschijnt zowel in Github als op de website.

## Validatie

 Controleren of een spice met UUID voldoet aan de gestelde eisen `validate-spice` script in deze repo:
```
./validate-spice UUID
```

# Rechten en verantwoordelijkheid van de auteur

De auteur is verantwoordelijk voor de ontwikkeling van de spice.

Auteurs kunnen hun spices aanpassen onder de volgende voorwaarden:

- Ze moeten de hier gedefinieerde bestandsstructuur en workflow respecteren
- Ze kunnen geen schadelijke code of code introduceren die een negatief effect op de gebruikers omgeving zou hebben

Auteurs kunnen wijzigingen van andere mensen accepteren of weigeren die de functies of het uiterlijk van hun spice wijzigen.

Auteurs kunnen ervoor kiezen de ontwikkeling van hun applet door te geven aan iemand anders. In dat geval wordt het veld "author" in UUID /info.json gewijzigd in de nieuwe ontwikkelaar en wordt het veld "original_author" toegevoegd om de oorspronkelijke ontwikkelaar de eer te geven.

Als een auteur zijn applet verlaat, neemt het Linux Mint-team het onderhoud van de applet over of geeft deze door aan iemand anders. Verschillende factoren worden gebruikt om te bepalen of een applet wordt verlaten, zoals langdurige activiteit, het niet reageren op verzoeken en ernstige problemen die zijn opgetreden als gevolg van wijzigingen in de API, enzovoort. Als u van plan bent een applet niet meer te onderhouden, laat dit ons weten.

# Pull-verzoeken van auteurs en workflow

Om een spice te wijzigen, dienen ontwikkelaars een Pull-aanvraag in.

Leden van het team van spices-ontwikkelaars bekijken het pull-verzoek.

Als de auteur van het pull-verzoek de auteur van de spice is (zijn github-gebruikersnaam komt overeen met het auteurveld in UUID /info.json), hoeft de beoordelaar alleen de volgende controles uit te voeren:

- De veranderingen zijn alleen van invloed op spices die bij die auteur horen
- De wijzigingen respecteren de bestandsstructuur van de spices
- De wijzigingen introduceren geen schadelijke code of code die de desktopomgeving negatief zou beïnvloeden

Als alles in orde is, wordt de PR samengevoegd, wordt de website bijgewerkt en kunnen gebruikers een spices-update zien in Systeeminstellingen.

# Pull verzoeken van andere

Naast de hierboven gespecificeerde controles, wordt het pull-verzoek van iemand anders dan de auteur afkomstig vastgehouden, totdat de auteur het bekijkt of een thumbs-up geeft, met de volgende uitzonderingen:

- Als het een bugfix is, kan de PR worden samengevoegd, maar als de bug klein is of de fix mogelijk invloed heeft op de manier waarop de applet werkt, wachten we mogelijk op goedkeuring van de auteur voordat deze wordt samengevoegd.
-Als het pull-verzoek vertalingen toevoegt, wordt het ook samengevoegd. Deze gaan de functionaliteit van de code niet beïnvloeden en zullen de applet beschikbaar maken voor veel gebruikers die het eerder niet konden gebruiken vanwege een taalbarrière. We beschouwen dit in wezen als een bugfix, maar het is hier opgenomen ter verduidelijking.
- Als de auteur niet binnen een redelijke termijn reageert, nemen we aan dat de toepassing niet meer wordt onderhouden (zoals hierboven vermeld) en dat het pull-verzoek wordt samengevoegd, ervan uitgaande dat het aan alle andere vereisten voldoet.

Als de wijzigingen een verandering in functionaliteit, uiterlijk vertegenwoordigen, of als de implementatie ervan in twijfel kan worden getrokken en/of besproken moet worden , moet de beoordelaar de PR open laten en de auteur vragen het te herzien.

Als de auteur tevreden is met de PR, kan deze worden samengevoegd. Als dat niet het geval is, kan het worden gesloten of bijgewerkt om de door de auteur gewenste wijzigingen weer te geven. Op dat moment wordt het samengevoegd of kan de auteur worden gevraagd de wijzigingen te beoordelen, afhankelijk van het feit of de wijzigingen volledig voldoen aan de vereisten van de auteur. .

# Verwijderingen

Auteurs hebben het recht om hun spices te verwijderen.

Het Cinnamon-team heeft ook het recht om dit te doen. Veelvoorkomende redenen zijn gebrek aan onderhoud, kritieke fouten of als de functies al bestaand zijn, hetzij door Cinnamon zelf, hetzij door een spice dat succesvoller is.

# Aanvullingen

Nieuwe spices kunnen worden toegevoegd door een Pull Request.

Het Cinnamon-team kan de toevoeging accepteren of afwijzen en moet een motivering geven in het gedeelte PR-opmerkingen.

# Meldingen melden en Pull Requests opstellen

Zie de [Guidelines for Contributing](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/.github/CONTRIBUTING.md)

# Vertalingen

het script `cinnamon-spices-makepot` in deze repository is geschreven om auteurs te helpen hun vertaalsjabloon bij te werken (`.pot`) bestand om vertalers te helpen hun vertalingen te testen.

Een vertaalsjabloon bijwerken `.pot`:
```
./cinnamon-spices-makepot UUID
```

Test vertaling `.po` lokaal voordat u deze upload naar Spices:"
```
./cinnamon-spices-makepot UUID --install
```

Meer info:
```
./cinnamon-spices-makepot --help
```

# Applets automatisch opnieuw laden

Er is een gebruiksscript met Gulp meegeleverd dat automatisch applets bij het wijzigen van de code kan herladen. Om te gebruiken, installeert u de [latest NodeJS LTS release](https://github.com/nodesource/distributions).
- Voer uit `npm install -g gulp@^4.0.0`
- In de hoofdmap van de directory van deze repo voer uit `npm install`.
- Om het script te gebruiken, voer uit ```gulp watch --uuid="<applet uuid>"```

Voor meer informatie voer uit ```gulp help```.
