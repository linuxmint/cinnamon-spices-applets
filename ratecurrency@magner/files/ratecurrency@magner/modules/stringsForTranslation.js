'use strict';

const getText = imports.gettext;
const GLib = imports.gi.GLib;

function $t(UUID) {
  getText.bindtextdomain(UUID, `${GLib.get_home_dir()}/.local/share/locale`);

  const translate = str => {
    const text = getText.dgettext(UUID, str);

    return (text !== str && text !== '') ? text : getText.gettext(str);
  };

  return {
    fiatName: {
      AUD: translate('Australian dollar'),
      BRL: translate('Brazilian real'),
      BGN: translate('Bulgarian lev'),
      CAD: translate('Canadian dollar'),
      CNY: translate('Chinese yuan renminbi'),
      CZK: translate('Czech koruna'),
      DKK: translate('Danish krone'),
      EUR: translate('Euro'),
      HKD: translate('Hong Kong dollar'),
      HUF: translate('Hungarian forint'),
      INR: translate('Indian rupee'),
      JPY: translate('Japanese yen'),
      NOK: translate('Norwegian krone'),
      PLN: translate('Polish zloty'),
      GBP: translate('Pound sterling'),
      RON: translate('Romanian leu'),
      RUB: translate('Russian rouble'),
      SGD: translate('Singapore dollar'),
      ZAR: translate('South African rand'),
      KRW: translate('South Korean won'),
      SEK: translate('Swedish krona'),
      CHF: translate('Swiss franc'),
      TRY: translate('Turkish lira'),
      USD: translate('US dollar'),
    },
    messages: {
      setKey: translate('Set API key...'),
      error: translate('Error'),
      reconnect: translate('Reconnect'),
      update: translate('Update: '),
      rank: translate('Rank: #'),
      '1h': translate('1H:'),
      '24h': translate('24H:'),
      '7d': translate('7D:'),
      max: translate('Max.: '),
      min: translate('Min.: '),
      ruWait: translate('For the Russian server, try again in 15 seconds.'),
      history: translate('History for '),
      day1: translate(' day'),
      day2: translate(' days'),
      day3: translate(' _days'), // for some countries the third declension of the word
      average: translate('Average:'),
      tooltip: translate('Click to open graph'),
      updateQuote: translate('Update quote'),
    },
  };
}
