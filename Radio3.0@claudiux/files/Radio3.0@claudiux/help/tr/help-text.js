let stations_help_text = `Bu sizin kendi Kategoriler ve Radyo İstasyonları listeniz.
+ düğmesini kullanarak daha fazlasını ekleyebilirsiniz.
Bir kategori için yalnızca adını girin; diğer alanları boş bırakın.
Bir radyo istasyonu için yalnızca adını ve akış URL'sini girin.
Satırları sürükleyip bırakarak veya listenin altındaki butonları ve araçları kullanarak sıralayabilirsiniz.
Listenin sağ altında bulunan 4 düğme, listeye sayfa sayfa bakmak için kullanılır. İstasyonlarınızdan birini aramak için listeye tıklayın ve adını yazmaya başlayın.
İstasyonları listenize kolayca eklemek için şu 2 sekmeyi kullanın: Ara ve İçe Aktar.
Menüde bir istasyonu veya kategoriyi görüntülemek için 'Menü' kutusunu işaretleyin.
İstasyonu dinlemek veya aşağıdaki araçları kullanarak başka bir kategoriye taşımak için ikinci kutuyu işaretleyin.`;

let button_update_help_text = `Az önce oluşturduğunuz kategori açılır listede görünmüyorsa, yukarıdaki düğmeye basın.
Bu pencere kaybolacak ve iki saniye sonra güncellenmiş olarak yeniden görünecektir.`;

let search_help_text = `Burada, internet üzerinden erişilebilen ücretsiz bir radyo veri tabanındaki diğer istasyonları arayabilirsiniz.
Aşağıdaki formun en az birkaç alanını doldurun ve ardından 'Ara ...' düğmesine tıklayın.
Bu butona her tıklandığında, bu sayfanın ikinci bölümünde belirli istasyonları test edebileceğiniz ve menüye ekleyebileceğiniz yeni bir sonuç sayfası görüntülenir.
Zaten menünüzde bulunan bir istasyon, yalnızca akış URL'si değiştiyse arama sonuçlarında görünecektir.
Yeni sayfa görünmemesi, arama kriterlerinize uyan tüm sonuçların görüntülendiği anlamına gelir.`);

let import_help_text = `En az bir radyo istasyonunun adını ve akış URL'sini içeren bir dosyayı içe aktarabilirsiniz.
Bu radyo istasyonları aşağıdaki listede gösterilmektedir. ♪ kutularını işaretleyerek onları test edebilirsiniz.
Ardından bu sekmenin altında bulunan butonlar ile bu listeyi yönetin.`;

let import_shoutcast_help_text = `Shoutcast dizininde, istasyon adının solundaki indirme düğmesine tıklayın.
Açık biçimi (.XSPF) seçin ve dosyayı istasyonla aynı adı vererek kaydedin.
Bu dosya daha sonra buraya aktarılabilir.`;

module.exports = {
  stations_help_text,
  button_update_help_text,
  search_help_text,
  import_help_text,
  import_shoutcast_help_text
}
