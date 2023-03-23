'use strict';

const UUID = 'ratecurrency@magner';
const modules = imports.ui.appletManager.applets[UUID].modules;
const periodFormat = modules.helpers.periodFormat;

function fetchEUFiat(currency) {
  return `https://api.ratesapi.io/api/latest?base=EUR&symbols=${currency}`;
}

function fetchPrevEUFiat(lastDate, currency) {
  return `https://api.ratesapi.io/api/${lastDate}?base=EUR&symbols=${currency}`;
}

function fetchEUFiatHistory(currency) {
  return `https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/${currency.toLowerCase()}.xml`;
}

function fetchRUFiat() {
  return 'https://www.cbr-xml-daily.ru/daily_json.js';
}

function fetchRUFiatHistory(id, duration) {
  const [start, end] = periodFormat(duration, 'D/M/Y');

  return `https://www.cbr.ru/scripts/XML_dynamic.asp?date_req1=${start}&date_req2=${end}&VAL_NM_RQ=${id}`;
}

function fetchCrypto(cryptoID, currency) {
  return `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=${cryptoID}&convert=${currency}`;
}

function fetchCryptoHistory(cryptoSymbol, currency, duration) {
  return `https://min-api.cryptocompare.com/data/histoday?fsym=${cryptoSymbol}&tsym=${currency}&limit=${duration}`;
}
