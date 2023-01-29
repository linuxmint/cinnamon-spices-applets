Radio3.0 - Klavuz
Yazar: Claudiux (@claudiux Github'da)
Son revizyon tarihi: 19 Aralık 2022
Genel bakış
Radio3.0 Cinnamon için İnternet Radyo Alıcısı & Kaydedicisidir.

Radio3.0 ile şunları yapabilirsiniz:

Her türlü radyo akışını dinleyin (MP3, AAC, AAC+, OGG, FLAC, FLV...)

Genel ses seviyesinden bağımsız olarak radyonun ses seviyesini değiştirin.

On binlerce radyo istasyonunu referans alan bir internet veritabanında araştırma yapın.

SHOUTcast gibi internet dizinlerinden alınan radyo istasyonu akışlarının URL'sini içeren dosyaları içe aktarın.

Bu uygulamanın menüsünden erişilebilen favori radyo istasyonları listenizi oluşturun.

Favori radyolar listenizi yönetin: listenizdeki her bir radyoyu ekleyin, taşıyın, kaldırın, değiştirin.

Kategoriler oluşturun ve kendinize en sevdiğiniz radyoları sıralayın.

Tüm radyo listelerini kaydedin ve geri yükleyin.

Şarkıları veya programları dinlerken kaydedin.

Arka plan kayıtlarını planlayın.

O anda çalan şarkıyı YouTube'dan kaydetmeyi deneyin. (Güvenli değil; başka bir şarkı kaydedilebilir.)

Çalınan şarkıyla ilgili YouTube'daki videoları izleyin.

Bir YouTube videosunun müziğini çıkarın.

Harika bir ses deneyimi için Pulse Effects'i (kuruluysa) başlatın ve kullanın.

Screenshots of Menu and Contextual menu


İçindekiler
Bağımlılıklar

Bağımlılıkların elle kurulumu

Linux Mint, Ubuntu, Debian
Arch
Fedora
Radio3.0 uygulaması nasıl kurulur?

Radio3.0 uygulama simgesi nereye yerleştirilir?

Radio3.0 uygulamasını kullanma

Radyo istasyonlarını listeme nasıl ekleyebilirim?
Radyo dinleme
En son dinlenen radyoyu dinle
Cinnamon başlangıcında en son dinlediğiniz radyoyu dinleyin
Radyoyu durdur
Radyo akışının sesini ayarlayın
Radyolarımın listesini yönet
Şarkı veya radyo programı kaydetme
Bir YouTube videosunun müziğini çıkarın
Kayıtlarımı içeren klasörü aç
Kayıtlarımı değiştir
Ayarlar

Radyolar
Menüdeki İstasyonlar ve Kategoriler
Seçilen istasyonları/kategoriyi taşıma
Kaydet ve geri yükle
Radyo Veritabanını kullanarak listenizi güncelleyin
Arama
Arama Formu
Arama Sonuçları
İçe aktarma
Menü
Ağ
Davranış
Kayıt
YT
planlama
İsteğe bağlı: PulseEffects'i yükleyin

Ek

Bağımlılıklar
Radio3.0'ın kullanım alanları:

mpv radyo akışlarını oynatmak için (verimli bir Medya Oynatıcı).

sox radyo akışını veya daha doğrusu ses kartınızdan çıkan sesi bir dosyaya kaydetmek için (Ses Değişimi).

pacmd (PulseAudio Komutu) bir pulseaudio aracıdır.

at kayıtları planlamak için.

libnotify-bin bildirimleri görüntülemek için.

youtube-dl veya yt-dlp (youtube-dl 'den daha hızlı) YOUTUBE'dan video indirmek için.

ffmpeg ve ffmpegthumbnailer Film müziğini indirilen videodan çıkarmak için.

python3-polib varsa çevirileri yüklemek için.

python3-brotli yt-dlp için gerekli.

Bu araçları ve kitaplıkları içeren paketler önceden kurulu değilse, Radio3.0'ı ilk kez kullanırken bunları kurmanız istenir.

Birkaç ses efektini kullanmak için (yankı vb.) Pulse Effects de yükleyebilirsiniz, ancak bu isteğe bağlıdır.

İçindekiler Tablosuna Dön


Bağımlılıkların elle kurulumu

Linux Mint, Ubuntu, Debian
sudo apt update

sudo apt install mpv libmpv1 libmpv-dev sox libsox-fmt-all pulseaudio pulseaudio-utils at libnotify-bin youtube-dl ffmpeg ffmpegthumbnailer python3-polib python3-brotli

İsteğe bağlı:

sudo apt install pulseeffects


Arch
sudo pacman -Syu mpv sox pulseaudio at libnotify youtube-dl ffmpeg ffmpegthumbnailer python-brotli

yay -S python-polib

To install Yay on in Arch Linux and other Arch-based systems, run the following commands one by one:

sudo pacman -S --needed git base-devel

git clone https://aur.archlinux.org/yay.git

cd yay

makepkg -si


Fedora
sudo dnf install mpv sox pulseaudio at libnotify yt-dlp ffmpeg gstreamer1-libav python3-brotli python3-polib

İçindekiler Tablosuna Dön

yt-dlp'nin en son sürümü nasıl kurulur?
yt-dlp Radio3.0 tarafından YouTube'dan video indirmek için kullanılır.

yt-dlp 'nin en son sürümü hataları düzeltir ve özellikle yaş sınırlaması nedeniyle sizi video indirme hakkından mahrum bırakmamak için tarayıcınızın çerezlerini daha iyi hesaba katar.

En son sürümünü nasıl yükleyeceğiniz aşağıda açıklanmıştır:

Tüm bağımlılıklarını da yüklediğinden, dağıtımınızın paket havuzlarında bulunan yt-dlp sürümünü yükleyerek başlayın. Örneğin: sudo apt install yt-dlp
Bu yeni sürümü içerecek $HOME/bin dizinini oluşturun: mkdir -p $HOME/bin
Linux için en son sürümü https://github.com/yt-dlp/yt-dlp/releases/latest adresinden indirin ve az önce oluşturduğunuz $HOME/bin dizinine kaydedin.
Çalıştırılabilir yapın: chmod +x $HOME/bin/yt-dlp
Oturumunuzdan çıkış yapın.
Giriş yapın. Artık $HOME/bin dizininizdeki herhangi bir komut dosyası, sisteminizde aynı ada sahip diğer tüm komut dizilerinden önceliklidir.

Radio3.0 uygulaması nasıl kurulur?
Radio3.0 - Installing applet and dependencies


Bir panele sağ tıklayın -> Uygulamacıklar -> İndirme sekmesi: Radio3.0'ı İndirin. Ardından Yönet sekmesini açın ve panele Radio3.0'ı ekleyin.


Radio3.0 uygulama simgesi nereye yerleştirilir?
En iyi yer Ses uygulamasının yanındadır. Böylece Ses uygulaması ile genel ses seviyesini, Radio3.0 uygulaması ile radyo sesini kolayca kontrol edebilirsiniz..

(Uygulamaları taşımak için panelin bağlamsal menüsündeki "Panel düzenleme modu"nu kullanın. Simgeleri sürükleyip bırakın. Uygulama simgeleriniz doğru yerdeyken bu "Panel düzenleme modundan" çıkın.)

İçindekiler Tablosuna Dön


Radio3.0 uygulamasını kullanma
Bu uygulamanın bir menüsü (sol tıklama) ve bir bağlamsal menüsü (sağ tıklama) vardır.

Bazı eylemler, simge üzerinde orta tıklama veya kaydırma kullanılarak yapılabilir.


Radyo istasyonlarını listeme nasıl ekleyebilirim?
Listenize en az bir radyo istasyonu eklemenin dört yolu vardır.

Menüde "Yeni istasyon ara..." seçeneğini seçin. (Ayrıca bağlamsal menüdeki "Yapılandır..." seçeneğini kullanabilir ve ardından "Ara" sekmesini seçebilirsiniz.) On binlerce referans içeren internet veritabanını sorgulamak için formu kullanın.

"İçe Aktar" sekmesini kullanarak (içerik menüsündeki aynı "Yapılandır..." seçeneğiyle) radyo istasyonu verilerini içeren dosyaları içe aktarabilirsiniz.

Akış URL'sini biliyorsanız, bir radyo istasyonunu doğrudan listenize ekleyebilirsiniz. Listeniz "Radyolar" sekmesindedir ("Yapılandır..." seçeneğini seçtiğinizde açılan ilk sekme). Bir radyo istasyonu eklemek için [+] düğmesini kullanın. Yalnızca "Ad" ve "Akış URL'si" alanları gereklidir; diğerleri isteğe bağlıdır. Radyo durdurulduktan sonra "Codek" ve "Bit hızı" alanları otomatik olarak doldurulacaktır.

Bu uygulama ayarlarının ilk sekmesinde bulunan düğmeyi kullanarak Radio3.0_EXAMPLES.json listesini geri yükleyin. Dikkat edin, istasyon listeniz bununla değiştirilecek; bunu yapmadan önce kendi istasyon listenizi kaydetmeyi düşünün!

Bu sekmelerin her biri, kullanımıyla ilgili bazı açıklamalar içerir. Bunlar, "Davranış" sekmesindeki uygun kutucuğun işareti kaldırılarak atlanabilir.


Radyo dinle
Radio3.0 menüsünü açın (simgesine tıklayarak).

"Tüm radyolarım" alt menüsünü açın..

Bir radyo istasyonu seçin ve birkaç saniye bekleyin. Bekleme süresi, sizi yayın sunucusundan ayıran mesafeye ve bu yayının kalitesine bağlıdır.

Lütfen en son seçilen radyo istasyonlarının, hızlı erişim sağlamak için menünün Son Çalınan İstasyonlar bölümünde göründüğünü unutmayın.

Bir radyo dinlerken sembolik simgenin rengi değişir (varsayılan olarak yeşil; başka bir renk seçebilirsiniz).


Dinlenen son radyo istasyonunu aç
Hiçbir radyo çalmıyorken simgeye orta tıklayın.

(Başka bir yol: Menünün Son Çalınan İstasyonlar bölümündeki ilk radyoya tıklayın.)


Cinnamon başlangıcında dinlediğiniz son radyoyu çalın
Bağlamsal menüde "Başlangıçta Radyo AÇIK" seçeneğini işaretleyin.


Radyoyu durdur
Radyoyu durdurmanın iki yolu vardır:

Menüde Durdur'u seçerek.

Simgeye orta tıklama (yani fare tekerleği ile tıklama) yapma.

Radyo KAPALI iken, sembolik renk varsayılandır (varsayılan olarak gri; başka bir renk seçebilirsiniz).


Radyo akışının sesini ayarlayın
Simge üzerinde yukarı veya aşağı kaydırmak, mevcut radyo akışının ses seviyesini ayarlar.

Bağlamsal menüde ses kaydırıcısını kullanmak aynı etkiye sahiptir.

Lütfen bu eylemlerin genel ses düzeyi üzerinde herhangi bir etkisinin olmadığını unutmayın; genel ses düzeyini ayarlamak için Ses uygulamasının simgesini kullanın.


Radyolarımın listesini yönet
Ayarlara erişmek için menüde veya bağlamsal menüde Yapılandır... öğesini seçin (aşağıya bakın).


Bir şarkı veya radyo programı kaydedin
Durum: Bu uygulamanın ayarlarındaki Kayıtlar sekmesinin Onay bölümündeki kutuyu işaretleyin.

İlk yol: Bağlamsal menüde Kaydı Başlat'ı seçin.

İkinci yol: Ekranda görünürken bildirimin Şu andan itibaren kaydet düğmesini tıklayın. Fareyi bu düğmenin üzerine getirmek, bildirim kaybolmadan şarkının başlamasını beklemenizi sağlar. Bildirim siz bu düğmeyi tıklayamadan kaybolursa, içerik menüsünden Kaydı Başlat seçeneğini kullanmanız gerekir.

Bu ikinci yol, akışınızın şarkının veya şovun adını verme yeteneğine bağlıdır..

Kayıt sırasında sembolik simgenin rengi değişir (varsayılan olarak kırmızıdır; başka bir renk seçebilirsiniz)

Lütfen aklınızda bulundurun:

Radyo akışı şarkının veya programın adını verirse, kayıt bu şarkının veya programın sonunda otomatik olarak duracaktır. Yayında duyurulan reklam aralarına dikkat!

Aksi takdirde kaydı kendiniz durdurmanız gerekir (bağlamsal menüyü kullanarak).

Kayıt tıklama anında başlar; daha önce başlatmak mümkün değildir. Çok az sayıda istasyon bir sonraki şarkıyı birkaç saniye önceden duyurur.

Önbellek boşalırken devam ettiği için kayıt genellikle şarkı bittikten birkaç saniye sonra sona erer.


Film müziğini YouTube videosundan çıkarın
Bağlamsal menüde: Film müziğini YouTube videosundan çıkarın...

Ardından, yeni açılan pencerenin en altına gidin, YouTube videosunun URL'sini uygun alana yapıştırın ve "Müzik parçasını çıkar" seçeneğini tıklayın.


Kayıtlarımı içeren klasörü aç
Bağlamsal menüde: Kayıtlar Klasörünü açın.


Kayıtlarımı değiştir
Kayıtlarınızı değiştirmek için Audacity gibi harici bir program kullanabilirsiniz.

İçindekiler Tablosuna Dön


Ayarlar
Ayarlara menüden veya bağlamsal menüden Yapılandır... seçeneği kullanılarak erişilebilir.

Settings Tabs

Radio3.0 Ayarlarında 9 sekme vardır:

Radyolar	Ara	İçe aktar	Menü	Davranış	Ağ	Kayıt	YT	Planlama
İçindekiler Tablosuna Dön


Radyolar

Menüdeki İstasyonlar ve Kategoriler
Radios Settings Screenshot

Bu, radyo istasyonları listesi örneğidir.

Üç Kategori görünür: Hard Rock & Metal, Reggae ve Techno / Dance. Akış URL'leri boş..

Diğerleri radyo istasyonlarıdır. Menü kutusu işaretli olanlar bu uygulamanın menüsünde görünür (Radyo İstasyonlarım alt menüsünde; aşağıya bakın). ♪/➟ kutusu işaretli olanlar, ♪ Test etmek için sonraki istasyonu çal düğmesi kullanılarak hemen (birbiri ardına) çalınabilir.

Her Kategori veya İstasyon,sürükle ve bırak yöntemiyle taşınabilir.

Bu listenin altında, sol kısım listenin içeriğini değiştirmek için araçları içerir:

Plus button bir Kategori (yalnızca adını girin) veya İstasyon (en azından adını ve akış URL'sini girin) eklemek için. Eklenen öğe listenin en üstündedir.

Minus button seçili öğeyi kaldırmak için. (Üzerine tıklayarak bir öğe seçersiniz.)

Pencil button seçili öğeyi düzenlemek için.

Unchecked button herhangi bir öğenin seçimini kaldırmak için.

Move up button seçili öğeyi yukarı taşımak için.

Move down button seçili öğeyi aşağı taşımak için.

Sağ kısım, listenizi keşfetmek için araçlar içerir:

Top button listenizin başına gitmek için.

Move up button önceki sayfaya gitmek için.

Move down button sonraki sayfaya gitmek için.

Bottom button listenizin en altına gitmek için.

Previous Category button önceki Kategoriye (veya sağdan sola yazan okuyucular için sonraki Kategoriye) gitmek için.

Next Category button sonraki Kategoriye (veya sağdan sola yazan okuyucular için önceki Kategoriye) gitmek için.

Sub-menu My Radio Stations


Seçilen istasyonları/kategoriyi taşıma
Radios Settings Screenshot 2

Belirli öğelerin kategorisini değiştirmek için ♪/➟ kutularını işaretleyerek seçin, açılır listeden kategoriyi seçin ve "Seçili istasyonları bu kategoriye taşı" düğmesine tıklayın.

Sonucu görmek ve herhangi bir ayar yapmak için "Bu kategoriye git"e tıklayın.

İpucu: Geçici bir kategori oluşturabilir ve onu doğru yere taşıyabilir, ardından seçili öğeleri silmeden önce o kategoriye taşıyabilirsiniz.


Kaydet ve geri yükle
Radios Settings Screenshot 3

Düzenlemeden veya güncellemeden önce istasyon listenizi kaydedin (yedekleyin). Bu, istasyonlarınızın ve kategorilerinizin tüm ayrıntılarını içeren bir .json dosyası oluşturur. Bu .json dosyasının adı, yedeklemenin tarihini ve saatini tanımlar; örnek: Radios_2022-02-21_22-23-55.json 21 Şubat 2022 saat 22:23:55'te oluşturuldu.

Önceden kaydedilmiş bir istasyon listesini geri yükleyin. Dikkat: Listeniz tamamen geri yüklenen listeyle değiştirilecektir.

Bu listeleri içeren klasörü açarak yönetebilirsiniz. Özellikle, bunları istediğiniz zaman yeniden adlandırabilirsiniz.


Radyo Veritabanını kullanarak listenizi güncelleyin
Radios Settings Screenshot 4

İstasyon listemi Radyo Veritabanı verileriyle güncelle düğmesinin amacı, radyolarınızın boş alanlarını mümkün olduğunca doldurmaktır.

Danışılan veri tabanı, bir istasyon için bildirdiğiniz akış URL'sini içeriyorsa, bu istasyona bir UUID (Evrensel Benzersiz Tanımlayıcı) atanacaktır.

İstasyonlarınızdan birine artık ulaşılamıyorsa, listenizi güncellemeyi deneyin. Bu istasyonun yayın URL'si değişmiş olabilir ve bir UUID'si varsa yeni URL'si ona atanabilir.

Güncelleme bir istasyona verdiğiniz adı değiştirmez.

Notlar:

Veritabanından (Arama sekmesi) bir istasyon gelirse, zaten bir UUID'si vardır.

Başka bir kaynaktan geliyorsa veritabanı tarafından bilinmiyor olabilir; daha sonra bir UUID atanmaz.

Tüm Sekmeler


Arama
Bu sekmeye, menüdeki Yeni istasyon ara seçeneğiyle doğrudan erişilebilir.


Arama Formu
Search Form Screenshot

Bu formun en az birkaç alanını doldurup ardından 'Ara ...' düğmesine tıklayarak, İnternet üzerinden erişilebilen ücretsiz bir radyo veri tabanındaki diğer istasyonları arayabilirsiniz.

'Ara ...' düğmesine her tıklandığında, bu sekmenin ikinci bölümünde belirli istasyonları test edebileceğiniz ve menüye dahil edebileceğiniz yeni bir sonuç sayfası görüntülenir.

Zaten menünüzde bulunan bir istasyon, yalnızca akış URL'si değiştiyse arama sonuçlarında görünür.

Yeni bir sayfanın görünmemesi, arama kriterlerinize uyan tüm sonuçların görüntülendiği anlamına gelir.

Kriterlerinizden en az birini değiştirirseniz, 'Sonraki sayfa numarası' alanını 1 olarak ayarlamayı unutmayın.

Her zamanki gibi, 'Sıfırla' düğmesi bu formdaki her alanı varsayılan değerine sıfırlar


Arama sonuçları
Bu sonuçları elde etmek için, arama formu sıfırlandı ve ardından aşağıdakilerle dolduruldu:

Etiket: metal
Kodlayıcı: AAC
Emir: bit hızı
Search Results Screenshot

'TheBlast.fm'i test etmek için ♪ kutusunu işaretleyin ve ardından ♪ Test edilecek sonraki istasyonu çal düğmesini tıklayın. Lütfen unutmayın: Bir radyo istasyonunu test etmek, onu bu uygulama menüsünde "Son Çalınan İstasyonlar"a ekler, ancak istasyon listenize eklemez.

Bu istasyonlardan bir veya daha fazlasını kendi listenizin en üstüne almak için Seç kutularını işaretleyin ve Seçili istasyonları kendi listeme aktar'ı tıklayın. Ardından, Radyolar sekmesini kullanarak listenizi yönetin.

Seç kutularını işaretleyip Kaldır... düğmesini tıklayarak bu arama sonuçlarından satırları kaldırabilirsiniz. Bu eylem, veritabanının içeriğini etkilemez.

Tüm öğeleri seç ve Tüm öğelerin seçimini kaldır düğmeleri, Seç kutularını etkiler.

Uyarı: Bu uygulamanın yazarı, bir aramadan sonra görüntülenen sonuçlardan sorumlu değildir ve veritabanlarının içeriğini kontrol etmez. Radyo istasyonları sizi rahatsız eden mesajlar veya ideolojiler yayınlıyorsa, lütfen sahiplerine veya yayın yaptıkları eyalete/ülkeye şikayet edin.

Tüm Sekmeler


İçe aktar
Bu sekme, özellikle Shoutcast dizinindekiler olmak üzere M3U, PLS veya XSPF formatındaki dosyalardan radyo istasyonlarını içe aktarmanıza olanak tanır.

Buraya içe aktarmak için Shoutcast'teki dosyaları alın
Import Settings Screenshot 1

Bu düğme, tarayıcınızda Shoutcast dizinini açar.

Shoutcast Baroque

Yukarıdaki örnekte, bir radyo istasyonunun XSPF dosyasına nasıl erişileceğini görüyoruz. Bu dosyayı, .xspf uzantısını koruyarak radyonun adını vererek kaydedin.

Shoutcast Save


İçe aktarılacak dosya
Import Settings Screenshot 2

Bu düğme, radyo istasyonları verilerini içeren bir dosyayı içe aktarmanızı sağlar.

Farklı içe aktarılabilir dosya biçimlerinin açıklaması Ek 1'de verilmiştir.

All Tabs


Menu
Menu Settings Screenshot

Bu sekme, bu uygulama menüsünde belirli öğelerin görüntülenip görüntülenmeyeceğini seçmenizi sağlar:

Bu uygulamanın adı ve sürümü, örneğin: Radio3.0 v1.0.0.
Son Oynatılan İstasyonların sayısı. 0 değeri, bu listenin görüntülenmesini devre dışı bırakır.
Yapılandır... ve Ses Ayarları gibi sistem öğeleri (zaten bağlamsal menüdedir).
Gizlilik: Son Çalınan İstasyonlar listenizi başlangıçta veya şimdi boşaltmak istiyorsanız, kutuyu işaretleyin veya düğmesine tıklayın.

Yalnızca geliştiriciler için kullanışlıdır: Bağlamsal menüde Bu uygulamayı yeniden yükle öğesinin görüntülenip görüntülenmeyeceği.

Tüm Sekmeler


Davranış
Behavior1 Settings Screenshot

Cinnamon başladığında radyoyu aç: İşaretlendiğinde, dinlenen son istasyon Cinnamon başladığında çalınacaktır.

Yeni bir radyo başlatmak için ses seviyesi: Bu sesi seçin. Sesi son değerinde bırakmak için '(Tanımsız)' olarak ayarlayın.

Bağımlılıkları kontrol etme: Tüm bağımlılıklar kurulu olduğunda veya belirli bağımlılıklar kullanışsız olduğunda (çünkü alternatifleriniz var) bu kutuyu işaretleyin.

Behavior2 Settings Screenshot

Simge üzerinde kayan ses düzeyi adımı: Bu adımı seçin. %0, simge üzerinde kaydırılan ses değişikliğini devre dışı bırakır.

Behavior3 Settings Screenshot

Görüntülemek istediğiniz yardımı seçin.

Behavior4 Settings Screenshot

Hangi bildirimleri görüntülemek istediğinizi seçin; ayrıca ikinci tür bildirimin süresi.

Behavior5 Settings Screenshot

Menü ve bildirimlerde Kodec ve Bit Hızının gösterilip gösterilmeyeceği.

Behavior6 Settings Screenshot

Radyo açıkken, radyo kapalıyken ve kayıt sırasında sembolik simgenin rengini seçin.

Tüm Sekmeler


Ağ
Network Settings Screenshot

Ağ Kalitesi:

Yüksek: Kayıtlar, en iyi kaliteyi garanti eden akışın bir kopyasından yapılacaktır.
Düşük: Bant genişliğinizden tasarruf etmek için, ses çıkışınızdan kayıtlar yapılır; ancak bazı sesler kayıtlarınızı kirletebilir.
Ağı izle: İşaretlendiğinde, ağ değiştirildikten sonra çalınan istasyon devam edecektir (VPN, Wifi...)

Proxy: Varsayılan olarak boştur. Biçim: http://[kullanıcı:pass@]URL[:bağlantı noktası]. Boşsa, http_proxy ve ALL_PROXY ortam değişkenleri varsa kullanılacaktır. Ayarlanırsa, bu proxy https istekleri için kullanılmaz.

Veritabanı Bilgisi (salt okunur): Gerçekte kullanılan radyo veritabanının URL'si.

All Tabs


Kayıt
Recording Settings Screenshot

Gelecekteki kayıtlarınızı içerecek klasörün yolu: Bu klasörü seçin.

Bu yolu varsayılan olarak ~/Music/Radio3.0 olarak ayarlayın. (Müzik yerelleştirilmiştir.)

Kayıt formatı: FLAC, MP3 (varsayılan), OGG, RAW veya WAV.

Kaydı durdurmanın yolu (lütfen bu seçimin herhangi bir mevcut kayıt üzerinde etkisi olmayacağını, ancak sonraki kayıtlar üzerinde etkili olacağını unutmayın.):

otomatik olarak, mevcut şarkı bittiğinde: yalnızca akış geçerli şarkının adını içeriyorsa doğru çalışır.
elle; bu şekilde, birkaç kayıt birbirini takip edebilir: kendiniz tüm kaydı durdurmalısınız.
Tüm Sekmeler


YT
Bu sekmeye, içerik menüsündeki Bir YouTube videosundan film müziği çıkar... seçeneği aracılığıyla doğrudan erişilebilir.

YT Settings Screenshot

Kayıt formatı: FLAC, MP3, OGG, RAW ve WAV mevcut formatlardır. MP3 (192 kbps) varsayılan olarak seçilidir.

Şuradaki çerezleri kullan: YouTube'u ziyaret etmek için genellikle kullandığınız tarayıcıyı seçin.

Film müziğini YouTube videosundan çıkarın: YouTube'u ziyaret ederek bir video (veya oynatma listesi) bağlantısını sağ tıklayın ve Bağlantıyı kopyala'yı seçin. Ardından, Kopyaladığınız YouTube bağlantısının üzerine yapıştır düğmesini tıklayın. YouTube video bağlantısı görünür. v= içeriyorsa, bu tek videonun film müziğini çıkarabilirsiniz. list= içeriyorsa, oynatma listesindeki her bir videodan film müziğini çıkarabilirsiniz. Bu müzikleri, adını belirttiğiniz bir alt dizine kaydetmeye de karar verebilirsiniz. Müzik parçasını çıkar düğmesi işlemi çalıştırır:

Videoyu indirin.
Film müziği ve resmi ayıklayın. Dosyayı yukarıda seçilen Kayıt biçiminde oluşturmak için bunları kullanın.
Videoyu kaldır.
(Oynatma listesindeki her video için tekrarlayın.)
Bu dosyaları içeren dizini açmanıza izin veren bildirim gönder.
Tüm Sekmeler


Planlama
Bu sekmeye, içerik menüsündeki Arkaplan kaydı planla... seçeneği aracılığıyla doğrudan erişilebilir.

Scheduling Settings1 Screenshot

Programlamak istediğiniz kaydın radyosunu, tarihini, saatini ve süresini seçin ve ardından düğmesine tıklayın.

Kaydın gerçekleşmesi için Cinnamon oturumunuzun açık olması gerekmez; ama tabii ki bilgisayarınız açık olmalı.

Her kaydın başlangıcı ve bitişi size bildirilecektir.

Programlanmış kayıtların listesi aşağıdaki listede görünür. Kaldırılsın mı? kutusunu işaretleyerek ve Seçili öğeleri kaldır düğmesini tıklayarak bunlardan herhangi birini iptal edebilirsiniz.

Scheduling Settings2 Screenshot

Tüm Sekmeler


İsteğe bağlı: PulseEffects'i yükleyin
PulseEffects, sistem çapında gelişmiş bir ekolayzırdır PulseAudio. Çalışan tüm uygulamalara sistem çapında efektler uygulayabilir veya seçili uygulamalar.

apt install libpulse-mainloop-glib0 libpulse0 libpulsedsp pulseaudio-equalizer pulseaudio-module-bluetooth pulseaudio-utils pulseaudio pavumeter pavucontrol paprefs gstreamer1.0-adapter-pulseeffects gstreamer1.0-autogain-pulseeffects gstreamer1.0-crystalizer-pulseeffects gstreamer1.0-convolver-pulseeffects pulseeffects

Kurulduktan sonra PulseEffects'e Radio3.0 uygulamasının bağlamsal menüsünden erişilebilir.

İçindekiler Tablosuna Dön


Ek

Ek 1: İçe aktarılabilir dosya biçimlerinin açıklaması
Bir .csv dosyasının içeriği (örnek):
INC;NAME;URL
true;Radio BluesFlac;https://streams.radiomast.io/radioblues-flac
true;Digital Impulse - Blues;http://5.39.71.159:8990/stream

Her satır, onu üç alana ayıran tam olarak iki noktalı virgül içermelidir.

İlk satır, aşağıdaki alanlarda bulunan alanları tanımlar.
INC alanı bir boole içerir. Değeri (true veya false) içe aktarma için önemli değildir, ancak mevcut olması gerekir.
NAME alanı, radyo istasyonunun adını içerir. Noktalı virgül içermemelidir.
URL alanı, bu istasyonun akışının URL'sini içerir.

Bir .m3u dosyasının içeriği (örnek):
#EXTM3U
#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)
http://185.33.21.111:80/baroque_64
#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)
http://185.33.21.111:80/baroque_mobile_aac
#EXTINF:-1,1.FM - Otto's Baroque Music (www.1.fm)
http://185.33.21.111:80/baroque_128
...v.b...

İlk satır #EXTM3U olmalıdır.
Ardından, her istasyon bir çift satırla tanımlanır. "#EXTINF:-1" ile başlayan ve istasyon adıyla biten bir ilk satır. Akış URL'sini içeren ikinci bir satır.

Not: #EXTINF:'den sonraki -1, parçanın süresinin bilinmediği anlamına gelir, bu bir radyo yayını için normaldir.

Bir .xpfs dosyasının içeriği (örnek):
<?xml version="1.0" encoding="utf-8"?><playlist version="1" xmlns="http://xspf.org/ns/0/"><title>1.FM - Otto's Baroque Music (www.1.fm)</title><trackList><track><location>http://185.33.21.111:80/baroque_128</location><title>1.FM - Otto's Baroque Music (www.1.fm)</title></track><track><location>http://185.33.21.111:80/baroque_64</location><title>1.FM - Otto's Baroque Music (www.1.fm)</title></track>...other tracks...</trackList></playlist>
Tüm veriler tek bir satıra kaydedilir. Burada daha anlaşılır bir şekilde sunulmuştur:

<?xml version="1.0" encoding="utf-8"?>
<playlist version="1" xmlns="http://xspf.org/ns/0/">
    <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
    <trackList>

        <track>
            <location>http://185.33.21.111:80/baroque_128</location>
            <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
        </track>

        <track>
            <location>http://185.33.21.111:80/baroque_64</location>
            <title>1.FM - Otto's Baroque Music (www.1.fm)</title>
        </track>

        ...diğer parçalar...
    </trackList>
</playlist>
İlk satır, XML sürümünü ve kullanılan karakter kodlamasını açıklar. XPFS biçimindeki tüm dosyalar bununla başlar.

Oynatma listesi, <playlist> ve </playlist> işaretlemeleri arasında tanımlanır.

İlk başlık (<title> ile </title> arasında), oynatma listesininkidir. (Bu durumda radyonun adıdır.)

Parça listesi, <tracklist> ve </tracklist> işaretlemeleri arasında bulunur.

Her parça, bu sırayla bir konum - yani akışın URL'si - ve burada daha açık olabilecek bir başlık içerir. akışın bit hızını ve biçimini belirterek.

Bir .pls dosyasının içeriği (örnek):
[playlist]
numberofentries=8
File1=http://185.33.21.111:80/baroque_mobile_aac
Title1=1.FM - Otto's Baroque Music (www.1.fm)
Length1=-1
File2=http://185.33.21.111:80/baroque_64
Title2=1.FM - Otto's Baroque Music (www.1.fm)
Length2=-1
...6 diğer girdiler...
Bir .pls dosyası, yalnızca [playlist] içeren bir satırla başlar.
İkinci satır, bu dosyanın 1'den 8'e kadar numaralandırılmış 8 giriş içerdiğini gösterir.

Her giriş, birbirini izleyen 3 satırlık bir dizi ile tanımlanır. Her birinin rolü kolayca anlaşılabilir.

"İçe aktarılacak dosya" bölümüne dönün

^
