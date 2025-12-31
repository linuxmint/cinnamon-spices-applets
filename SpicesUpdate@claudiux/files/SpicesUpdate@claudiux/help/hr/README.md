# Nadopune dodataka

## Sažetak

Cinnamon Dodaci su Apleti, Deskleti, Proširenja i Teme.

Uobičajeno provjeravate nadopune dodataka u Cinnamon postavkama. Ali, poput mene, to činite povremeno.

**Nadopune dodataka** aplet, koji je vrlo prilagodljiv, čini to umjesto vas:

  * Upozorava vas kada instalirani dodaci imaju dostupne nadopune.
  * Neobavezno: Može vas upozoriti kada je dostupan novi dodatak.
  * Daje vam izravan pristup u Cinnamon postavke za aplete, desklete, proširenja i teme.
  * Samo za Cinnamon 3.8 ili noviji:
    * Omogućuje vam da nastavite preuzimanje najnovije inačice dodatka.
    * Jamči vam da uvijek preuzmete najnoviju inačicu dodatka kada je nadopuna dostupna.
    * Omogućuje vam da zanemarite dostupne nadopune za dodatke koje ne želite nadograditi.
    * Srednji klik na ikonu apleta, omogućuje vam trenutno osvježavanje podataka o dostupnim novim dodacima i nadopunama, ili otvara postavke sustava korisne za izvođenje dostupnih nadopuna.


## Stanje

Koristi se za Cinnamon 2.8 do Cinnamon 4.4.

Potpuno podržan od strane autora, pod neprekidnim razvojem i neprekidnim korištenjem na nekoliko računala, pogonjenih s **Linux Mintom**, **Fedorom**,  **Archlinuxom** i **Debianom 10**.

Od inačice v3.0.0 ~ 20190808:

  * Nadopune dodataka su kompatibilne s Cinnamon 2.8 -> 4.4 (Mint 17.3 -> 19.3).
  * Od Cinnamona 3.8 do 4.4 (Mint 19 -> 19.3): **Izvanredno funkcionalan, kao i obično.**
  * Od Cinnamona 2.8 do 3.6 (Mint 17.3 -> 18.3): Određene značajke su uskraćene:
    * Prozor podešavanja dodataka ne otvara se u drugoj kartici, nego samo u prvoj. Morat ćete kliknuti na drugu karticu i odabradi razvrstaj prema datumu.
    * Prozor postavki ovog apleta ne sadrži kartice.
    * U postavkama ovog apleta, ne možete pristupiti popisu dodataka kako bi onemogućili njihovo nadgledanje. Stoga, svi instalirani dodaci se nadgledaju.
    * Skripta `generate_mo.sh` (u `scripts` mapi) omogućuje vam instalaciju svih dostupnih prijevoda. Ponovno pokrenite Cinnamon nakon pokretanja skripte.
    * Ako `Symbola_Hinted` font se ne može automatski instalirati, tada ga smjestite u `fonts/symbola` mapu i dvostruko kliknite na `Symbola_Hinted.ttf` datoteku. Instalirajte ga jednostavno otvaranjem `gnome-font-viewer` aplikacije.
    * Cinnamon 2.8: Broj promjena ne pojavljuje se pokraj ikone apleta Nadopune dodataka.

## Zahtjevi

Nadopune dodataka aplet zahtijeva ```notify-send``` alat i ```symbola``` TrueType font.

**Ovaj aplet vam pomaže u instalaciji tih zavisnosti, ako je potrebno.**

Ručno ih možete instalirati pokretanjem naredbi:

  * Fedora: `sudo dnf install libnotify gdouros-symbola-fonts`
  * Arch:
    * ```sudo pacman -Syu libnotify```
    * `yay -S ttf-symbola` _or_ `pamac build ttf-symbola`
  * Linux Mint, Ubuntu: ```sudo apt install libnotify-bin fonts-symbola```
  * Debian (bez sudo):
    * `su`
    * ```apt install libnotify-bin fonts-symbola```


## Postavke

![screenshot](https://cinnamon-spices.linuxmint.com/git/applets/SpicesUpdate@claudiux/screenshot.png)

Postoji pet kartica u postavkama.

Prva, _Općenito_, omogućuje vam:

  * Odabir _Vremenskog razdoblja između nadopuna_ (u satima). Zapamtite da će se prva provjera pokrenuti jednu minutu nakon pokretanja ovog apleta.
  * Odabir načina obavijesti: promjena izgleda (prema boji) ikone ovog apleta i/ili prikaza poruke u području obavijesti. Možete odabrati i vrstu obavijesti: Minimalna ili s tipkom za otvaranje kartice Preuzimanje u postavkama sustava. Ako je potrebno, obavijest može sadržavati opis pojedine nadopune ili novog dodatka.
  * Odabir _vrste prikaza_ ikone: s ili bez teksta?
  * Sakrivanje ikone apleta kada nema nikakvih nadopuna ili novih dodataka. _Zapamtite da postavke Nadopune dodataka su dostupne samo kada je ikona apleta vidljiva ili otvaranjem Cinnamon postavki-> Apleti._

![system_settings_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/System_Settings_Applets.png)

Za sadržaj ostalih kartica (_Apleti_, _Deskleti_, itd.), pogledajte snimku zaslona ispod i zapamtite da se **popis instaliranih dodataka automatski popunjava** pri pokretanju; tipke osvježavanja omogućuje vam nadopunjavanje i osvježavanje podataka o nadopunama.

Postavite na _LAŽ_ (ili uklonite prvi odabir) sve dodatke za koje _ne želite_ provjeriti nadopunu. Postoje dva razloga za to:

  * Dodatak ispravno funkcionira i ne želite biti obaviješteni o bilo kakvim promjenama.
  * Vi ste razvijatelj koji radi na dodatku i želite zaštiti svoj rad tijekom razvijanja dodatka.

Od Cinnamona 3.8, možete zatražiti obnovu preuzimanja najnovije inačice dodatka odabirom obje mogućnosti (ili postavljanje oba preklopnika na ISTINU) zatim klikom na tipku osvježavanja.

![SpicesUpdate-settings_applets](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/Settings_Spices_Update_Applets.png)

## Izbornik

U izborniku ovog apleta:

  * tipka osvježavanja omogućuje vam ručno pokretanje provjere dostupnosti nadopuna za vaše dodatke;
  * pojavljuje se točka ispred svakog dodatka kada je najmanje jedna nadopuna dostupna;
  * klik na vrstu dodatka (Apleti, Deskleti, itd.) otvara karticu preuzimanja odgovarajuće stranice u Cinnamon postavkama, s dodacima razvrstanim prema datumu;
  * kada su novi dodaci dostupni:
    * pojavi se mogućnost _Ne obavještavaj o novim dodacima_; klikom na nju će se ukloniti te obavijesti o novim dodacima, dok se ne pojavi novi dodatak;
  * kada su dostupni novi dodaci ili nadopune:
    * pojavi se mogućnost _Otvori korisne Cinnamon postavke_ (za pokretanje nadopuna);
  * Prilagodi... tipka otvara postavke Nadopune dodataka.

## Ikona

Boja ikone se promijeni kada je dostupna najmanje jedna nadopuna dodataka.

Od Cinnamona 3.8, ikona se okreće i njena boja potamni tijekom osvježavanja podataka.

_Srednji klik_ na ikonu apleta:

  * Pokreće osvježavanja bez obavijesti o novim nadopunama.
  * Otvara sve korisne Cinnamon postavke, kada su nadopune dodataka dostupne, dopuštajući korisniku pokretanje tih nadopuna.

Savjet ikone (poruka prikazana prijelazom pokazivača miša iznad ikone) sadrži popis dodataka s dostupnim nadopunama.

![hovering_icon](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/hovering_icon.png)


## Obavijesti

Postoje dvije vrste obavijesti: _Minimalna_ ili _S tipkama radnje_. Svaka od njih može ili ne treba sadržavati pojedinosti: razlog nadopune ili opis novog dodatka.

### Minimalna obavijest

Primjer s razlogom nadopune:

![notif_simple_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_simple_with_details.png)

### Obavijest s tipkama radnje

Sadrži dvije tipke: prva tipka otvara stranicu preuzimanja nadopuna u postavkama sustava; druga tipka osvježava obavijesti.

![notif_with_details](https://github.com/claudiux/docs/raw/master/SpicesUpdate/images/notif_with_details2.png)

## Prijevodi

Svaki prijevod je dobrodošao. Hvala vam na doprisu prevođenja poruka apleta na nove jezike ili poboljšanju ili nadopuni postojećih prijevoda.

### Available translations and their authors

  * Hrvatski (hr): muzena
  * Nizozemski (nl): Jurien (French77)
  * Finski (fi): MahtiAnkka
  * Francuski (fr): claudiux
  * Njemački (de): Mintulix
  * Talijanski (it): Dragone2
  * Španjolski (es): claudiux
  * Švedski (sv): Åke Engelbrektson (eson57)

Hvala im puno!

### Kako poslati prijevod

  1. Stvorite račun na [Githubu](https://github.com/).
  2. Fork [cinnamon-spices-applets](https://github.com/linuxmint/cinnamon-spices-applets) repozitorij.
  3. U vašem forku, stvorite ogranak (branch) (naziva poput `SpicesUpdate-YOUR_LANGUAGE_CODE`) iz master ogranka (branch).
  4. Na svojem računalu, instalirajte _git_ i _poedit_ programe.
  5. Klonirajte vaš ogranak (branch) na svoje računalo:

    `git clone -b SpicesUpdate-VAŠ_JEZIČNI_KÔD --single-branch https://github.com/VAŠ_GITHUB_RAČUN/cinnamon-spices-applets.git SpicesUpdate-VAŠ_JEZIČNI_KÔD`
  6. Otvorite `SpicesUpdate@claudiux.pot` datoteku (koja se nalazi u `po` direktoriju) u poeditu i stvorite svoj prijevod. Tada nastaje VAŠ_JEZIČNI_KÔD.po datoteka.
  7. Na Githubu, pošaljite `VAŠ_JEZIČNI_KÔD.po` datoteku na pravo mjesto u vaš ogranak (branch) zatim načinite zahtjev za povlačenjem (Pull Request).

## Instalacija

### Automatska instalacija

Koristite izbornik _ApletI_ u Cinnamon postavkama, ili _Apleti_ u sadržajnom izborniku (desni klik) vašeg panela radne površine. Zatim idite u karticu preuzimanja za instalaciju apleta Nadopune dodataka.

### Ručna instalacija:

   * Instalirajte dodatne potrebne programe.
   * Preuzmite **[najnoviju inačicu apleta Nadopune dodataka](https://cinnamon-spices.linuxmint.com/files/applets/SpicesUpdate@claudiux.zip?04831377-cbe4-482d-b035-b8ce9349632e)** s web stranice dodataka.
   * Otpakrajte mapu ```SpicesUpdate@claudiux``` u ```~/.local/share/cinnamon/applets/```
   * Omogućite ovaj aplet u Postavke sustava -> Apleti.
   * Prozoru postavki možete pristupiti i iz Postavke sustava -> Apleti, ili iz sadržajnog izbornika ovog apleta (desni klik na apletovu ikonu).

## Zvijezdica za zahvalu autoru

Ako vam se sviđa ovaj aplet Nadopune dodataka, ne nudite mi novac ili kavu, radije se prijavite i kliknite na zvijezdicu pri vrhu **[ove stranice](https://cinnamon-spices.linuxmint.com/applets/view/309)**.

Puno Vam hvala.
