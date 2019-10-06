function _formatPeriod(interval) {
	let start = new Date(),
			end = new Date();
	start.setDate(start.getDate() - interval);

  // add leading zeros to a single day/month digit
  let d = [
    '0' + (start.getMonth() + 1),
    '0' + start.getDate(),
    '0' + (end.getMonth() + 1),
    '0' + end.getDate()
  ].map(component => component.slice(-2)); // take the last 2 digits from each component

	return [parseInt(start.getFullYear() + d.slice(0, 2).join('')), parseInt(end.getFullYear() + d.slice(2).join(''))];
}

function _periodFromArray(xmlData, start, end) {
	let range = xmlData.match(/<Obs[^/][^>]*\/>/g), // Find all Obs tags with currency value
			startIndex,
			endIndex;

	if (range) {
		for (let index of range) {
			let date = index.match(/[\d+-]+/)[0];
			date = parseInt(date.replace(/-/g, ''));

			if (start >= date) { startIndex = index; }
			if (end >= date) { endIndex = index; }
		}

		xmlData = xmlData.slice(xmlData.indexOf(startIndex), xmlData.lastIndexOf(endIndex) + endIndex.length);
	}
	return xmlData;
}

function _parseXML(xmlStr) {
	xmlStr = _cleanXML(xmlStr);
	return _toJSON(xmlStr);
}

function _cleanXML(xmlStr) {
	if (!xmlStr) { return; }

	xmlStr = xmlStr.replace(/"/g, "'"); // raplace all `"` -> `'`
	xmlStr = xmlStr.replace(/\n|\t|\r/g, ''); // remove special characters (line feed, tab, carriage return)

	let tags = xmlStr.match(/<[^/][^>]*\/>/g);

	if (tags) {
		for (let tag of tags) {
			let tempTag = tag.substring(0, tag.length - 2),
					tagName = tag.match(/[^<][\w:+$]*/)[0],
					closingTag = `</${tagName}>`,
					newTag = `<${tagName}>`,
					attrs = tempTag.match(/(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g);

			tempTag += '>';

			if (attrs) {
				for (let attr of attrs) {
					let attrName = attr.substring(0, attr.indexOf('=')).toLowerCase(),
							attrValue = attr.substring(attr.indexOf("'") + 1, attr.lastIndexOf("'"));

					attrName = attrName.replace(/.*_/, '');
					if (attrName == 'status' || attrName == 'conf') { continue; }
					if (attrName == 'value') { attrValue = parseFloat(attrValue); }

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

	obj[tagName].forEach(function(data) { data.value = parseFloat(data.value); });

	if (xmlStr.length != 0) { return 'Error'; }
	else { return obj; }
}