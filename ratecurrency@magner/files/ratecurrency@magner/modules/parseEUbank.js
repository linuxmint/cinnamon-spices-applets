'use srtict';

const UUID = 'ratecurrency@magner';
const helpers = imports.ui.appletManager.applets[UUID].modules.helpers;

function cleanXML(xmlStr) {
  if (!xmlStr) {
    return;
  }

  xmlStr = xmlStr.replace(/"/g, "'"); // raplace all `"` -> `'`
  xmlStr = xmlStr.replace(/\n|\t|\r/g, ''); // remove special characters (line feed, tab, carriage return)

  const tags = xmlStr.match(/<[^/][^>]*\/>/g);

  if (tags) {
    for (const tag of tags) {
      const tagName = tag.match(/[^<][\w:+$]*/)[0];
      const closingTag = `</${tagName}>`;

      let tempTag = tag.substring(0, tag.length - 2);
      const attrs = tempTag.match(/(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g);

      let newTag = `<${tagName}>`;

      tempTag += '>';

      if (attrs) {
        for (const attr of attrs) {
          let attrName = attr.substring(0, attr.indexOf('=')).toLowerCase();
          let attrValue = attr.substring(attr.indexOf("'") + 1, attr.lastIndexOf("'"));

          attrName = attrName.replace(/.*_/, '');

          if (attrName === 'status' || attrName === 'conf') {
            continue;
          }

          if (attrName === 'value') {
            attrValue = parseFloat(attrValue);
          }

          newTag += `<${attrName}>${attrValue}</${attrName}>`;
        }
      }

      newTag += closingTag;
      xmlStr = xmlStr.replace(tag, newTag);
    }

    xmlStr = xmlStr.replace(/>,</g, '><');
  }

  return xmlStr;
}

function parseData(interval, xmlData) {
  const [start, end] = helpers.periodFormat(interval, 'YMD');
  const range = xmlData.match(/<Obs[^/][^>]*\/>/g); // Find all Obs tags with currency value

  let startIndex;
  let endIndex;
  let xml = xmlData;

  if (range) {
    for (const index of range) {
      let date = index.match(/[\d+-]+/)[0];
      date = parseInt(date.replace(/-/g, ''));

      if (+start >= date) {
        startIndex = index;
      }

      if (+end >= date) {
        endIndex = index;
      }
    }

    xml = xmlData.slice(xmlData.indexOf(startIndex), xmlData.lastIndexOf(endIndex) + endIndex.length);
  }

  xml = cleanXML(xml);

  return helpers.toJSON(xml, 'value');
}
