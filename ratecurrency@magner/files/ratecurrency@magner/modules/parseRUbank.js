function _formatPeriod(interval) {
	let start = new Date(),
			end = new Date();
	start.setDate(start.getDate() - interval);

	// add leading zeros to a single day/month digit
	let d = [
		'0' + start.getDate() + '/',
		'0' + (start.getMonth() + 1) + '/',
		'0' + end.getDate() + '/',
		'0' + (end.getMonth() + 1) + '/'
	].map(component => component.slice(-3)); // take the last 3 digits from each component

	return '?date_req1=' + d.slice(0, 2).join('') + start.getFullYear() + '&date_req2=' + d.slice(2).join('') + end.getFullYear();
}

function _parseXML(xmlStr) {
	xmlStr = _cleanXML(xmlStr);
	return _toJSON(xmlStr);
}

function _cleanXML(xmlStr) {
	if (!xmlStr) { return; }

	xmlStr = xmlStr.replace(/\n|\t|\r/g, ''); // remove special characters (line feed, tab, carriage return)
	xmlStr = xmlStr.replace(/"/g, "'"); // raplace all `"` -> `'`
	xmlStr = xmlStr.replace(/,/g, "."); // raplace all `,` -> `.`
	xmlStr = xmlStr.replace(/<Nominal>\d+<\/Nominal>/g, '');
	xmlStr = xmlStr.replace(/ Id='[^>]\w+'/g, '');
	xmlStr = xmlStr.match(/<Record \w+='[\d.]+'>.*<\/Record>/g).toString();

	// Replaces all the tags with attributes
	let tags = xmlStr.match(/<[^>][^<]+\s+.[^<]+[=][^<]+>/g);

	if (tags) {
		for (let tag of tags) {
			let tagName = tag.match(/[^<][\w:+$]*/)[0],
					newTag = `<${tagName}>`,
					attrs = tag.match(/(\S+)='?((?:.(?!'?\s+(?:\S+)=|[>']))+.)'?/g);

			if (attrs) {
				for (let attr of attrs) {
					let attrName = attr.substring(0, attr.indexOf('=')),
							attrValue = attr.substring(attr.indexOf("'") + 1, attr.lastIndexOf("'"));

					newTag += `<${attrName}>${attrValue}</${attrName}>`;
				}
			}
			xmlStr = xmlStr.replace(tag, newTag);
		}
	}
	return xmlStr;
}

function _toJSON(xmlStr) {
	if (!xmlStr) { return; }

	let obj = {},
			tag = /<[^>]*>/,
			openingTag, tagName, inner, tmpObj;

	openingTag = xmlStr.match(tag)[0];
	tagName = openingTag.substring(1, openingTag.length - 1);
	obj[tagName] = [];

	while (xmlStr.match(tag)) {
		inner = xmlStr.substring(openingTag.length, xmlStr.indexOf(`</${tagName}>`));
		xmlStr = xmlStr.substring(openingTag.length * 2 + 1 + inner.length);
		tmpObj = {};

		while (inner.match(tag)) {
			let keyTag = inner.match(tag)[0],
					key = keyTag.substring(1, keyTag.length - 1),
					val = inner.substring(keyTag.length, inner.indexOf(`</${key}>`));

			tmpObj[key] = val;
			inner = inner.substring(keyTag.length * 2 + 1 + val.length);
		}
		obj[tagName].push(tmpObj);
	}

	obj[tagName].forEach(function(data) { data.Value = parseFloat(data.Value); });

	if (xmlStr.length != 0) { return 'Error'; }
	else { return obj; }
}
