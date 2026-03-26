'use srtict';

const UUID = 'ratecurrency@magner';
const helpers = imports.ui.appletManager.applets[UUID].modules.helpers;

function cleanXML(xmlStr) {
  if (!xmlStr) {
    return;
  }

  xmlStr = xmlStr.replace(/\n|\t|\r/g, ''); // remove special characters (line feed, tab, carriage return)
  xmlStr = xmlStr.replace(/"/g, "'"); // raplace all `"` -> `'`
  xmlStr = xmlStr.replace(/,/g, "."); // raplace all `,` -> `.`
  xmlStr = xmlStr.replace(/<Nominal>\d+<\/Nominal>/g, '');
  xmlStr = xmlStr.replace(/ Id='[^>]\w+'/g, '');
  xmlStr = xmlStr.match(/<Record \w+='[\d.]+'>.*<\/Record>/g).toString();

  // Replaces all the tags with attributes
  const tags = xmlStr.match(/<[^>][^<]+\s+.[^<]+[=][^<]+>/g);

  if (tags) {
    for (const tag of tags) {
      const tagName = tag.match(/[^<][\w:+$]*/)[0];
      const attrs = tag.match(/(\S+)='?((?:.(?!'?\s+(?:\S+)=|[>']))+.)'?/g);

      let newTag = `<${tagName}>`;

      if (attrs) {
        for (const attr of attrs) {
          const attrName = attr.substring(0, attr.indexOf('='));
          const attrValue = attr.substring(attr.indexOf("'") + 1, attr.lastIndexOf("'"));
          
          newTag += `<${attrName}>${attrValue}</${attrName}>`;
        }
      }

      xmlStr = xmlStr.replace(tag, newTag);
    }
  }

  return xmlStr;
}

function parseData(xmlStr) {
  xmlStr = cleanXML(xmlStr);
  
  return helpers.toJSON(xmlStr, 'Value');
}
