/*
   marknote-debug.js
   
   Unmimified copy of Marknote - for debugging with a tool such as Firebug.
   For production use, use the minified copy, marknote.js, instead.
   
   This version of marknote has been modified for use in bbcwx, the Cinnamon Weather Desklet
   
   marknote version 0.5.1.bbcwx
   XML DOM/Parser API
   
   Usage:
   <script type="text/javascript" src="path/to/my/javascript/marknote-debug.js"></script>
 
   ------------------------------------------------------------------------------------
 
   Copyright(c) 2011 jbulb.org. 
   http://jbulb.org

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License. 
*/
let marknote = function () {
};
marknote.constants = {DOCTYPE_START:"<!DOCTYPE", CDATA_START:"<![CDATA[", CDATA_END:"]]>", COMMENT_START:"<!--", COMMENT_END:"-->", TAG_OPEN:"<", TAG_CLOSE:">", TAG_CLOSE_SELF_TERMINATING:"/>", ENDTAG_OPEN:"</", EQUALS:"=", SQUOTE:"'", DQUOTE:"\"", PI_START:"<?", PI_END:"?>", BRACKET_OPEN:"[", BRACKET_CLOSE:"]", TOKENTYPE_BRACKET_OPEN:"bracketOpen", TOKENTYPE_TAG_OPEN:"tagOpen", TOKENTYPE_TAG_CLOSE:"tagClose", TOKENTYPE_ENDTAG_OPEN:"endTagOpen", TOKENTYPE_ENDTAG_CLOSE:"endTagClose", TOKENTYPE_SELF_TERMINATING:"closeTagSelfTerminating", TOKENTYPE_WHITESPACE:"whitespace", TOKENTYPE_ATTRIBUTE:"attribute", TOKENTYPE_QUOTE:"quote", TOKENTYPE_QUOTED:"quotedLiteral", TOKENTYPE_NORMAL:"normal", TOKENTYPE_COMMENT_START:"commentStart", TOKENTYPE_COMMENT_END:"commentEnd", TOKENTYPE_CDATA_START:"cdataStart", TOKENTYPE_CDATA_END:"cdataEnd", TOKENTYPE_PI_START:"piStart", TOKENTYPE_PI_END:"piEnd", TOKENTYPE_DOCTYPE_START:"docTypeStart", DATATYPE_ATTRIBUTE:"marknote.Attribute", DATATYPE_CDATA:"marknote.CDATA", DATATYPE_CLONER:"marknote.Cloner", DATATYPE_COMMENT:"marknote.Comment", DATATYPE_DOCTYPE:"marknote.DOCTYPE", DATATYPE_DOCUMENT:"marknote.Document", DATATYPE_ELEMENT:"marknote.Element", DATATYPE_ENTITYREF:"marknote.EntityRef", DATATYPE_XMLENTITYREFS:"marknote.XMLEntityRefs", DATATYPE_ENTITYREFS:"marknote.EntityRefs", DATATYPE_PARSER:"marknote.Parser", DATATYPE_PROCESSINGINSTRUCTION:"marknote.ProcessingInstruction", DATATYPE_QNAME:"marknote.QName", DATATYPE_TEXT:"marknote.Text", DATATYPE_TOKEN:"marknote.Token", DATATYPE_TOKENIZER:"marknote.Tokenizer", DATATYPE_WRITER:"marknote.Writer"};

marknote.Attribute = function (name, value) {
    this.dataType = marknote.constants.DATATYPE_ATTRIBUTE;
    this.isSw8tXmlContent = false;
    this.name = name;
    this.value = marknote.Util.erefEncode(marknote.Util.nothingToBlank(value));
};
marknote.Attribute.prototype.getName = function () {
    return this.name;
};
marknote.Attribute.prototype.setName = function (name) {
    this.name = name;
};
marknote.Attribute.prototype.getValue = function () {
    return marknote.Util.erefDecode(marknote.Util.nothingToBlank(this.value));
};
marknote.Attribute.prototype.setValue = function (value) {
    this.value = marknote.Util.erefEncode(marknote.Util.nothingToBlank(value));
};
marknote.Attribute.prototype.toString = function () {
    return this.getName() + "=\"" + this.getValue() + "\"";
};
marknote.Attribute.prototype.clone = function () {
    return new marknote.Attribute(this.getName(), this.getValue());
};
marknote.CDATA = function (text) {
    this.dataType = marknote.constants.DATATYPE_CDATA;
    this.isSw8tXmlContent = true;
    this.text = marknote.Util.nothingToBlank(text);
};
marknote.CDATA.prototype.getText = function () {
    return marknote.Util.nothingToBlank(this.text);
};
marknote.CDATA.prototype.setText = function (text) {
    this.text = marknote.Util.nothingToBlank(text);
};
marknote.CDATA.prototype.toString = function () {
    return this.getText();
};
marknote.CDATA.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.clone(this);
};
marknote.Cloner = function () {
    this.dataType = marknote.constants.DATATYPE_CLONER;
    this.isSw8tXmlContent = false;
};
marknote.Cloner.prototype.cloneDocument = function (doc) {
    var outDoc = new marknote.Document();
    var pis = doc.getProcessingInstructions();
    var root = doc.getRootElement();
    var clonedPI;
    for (var p = 0; p < pis.length; p++) {
        clonedPI = this.cloneProcessingInstruction(pis[p]);
        outDoc.addProcessingInstruction(clonedPI);
    }
    var outRoot = this.cloneElement(root);
    outDoc.setRootElement(outRoot);
    return outDoc;
};
marknote.Cloner.prototype.cloneProcessingInstruction = function (pi) {
    var data = pi.getData();
    var outTarget = pi.getTarget().slice(0);
    var outData = this.cloneArray(data);
    return new marknote.ProcessingInstruction(outTarget, outData);
};
marknote.Cloner.prototype.cloneElement = function (elem) {
    var outElem = new marknote.Element();
    var outName = elem.getName().slice(0);
    var outAttributes = this.cloneArray(elem.getAttributes());
    outElem.setName(outName);
    outElem.setAttributes(outAttributes);
    if (elem.isSelfTerminated) {
        outElem.isSelfTerminated = true;
        return outElem;
    }
    var outContents = this.cloneContents(elem);
    outElem.setContents(outContents);
    return outElem;
};
marknote.Cloner.prototype.cloneContents = function (elem) {
    var outContents = new Array();
    var outContent, dataType;
    for (var c = 0; c < elem.getContents().length; c++) {
        var content = elem.getContentAt(c);
        dataType = marknote.Util.dataType(content);
        switch (dataType) {
          case marknote.constants.DATATYPE_ELEMENT:
            outContent = this.cloneElement(content);
            outContents.push(outContent);
            break;
          default:
            outContent = this.clone(content);
            outContents.push(outContent);
            break;
        }
    }
    return outContents;
};
marknote.Cloner.prototype.clone = function (inObj) {
    var isValidObj = (inObj.dataType && inObj.dataType.indexOf("marknote.") > 0) || typeof inObj == "object";
    if (!isValidObj) {
        return inObj;
    }
    var outObj = new Object();
    for (var i in inObj) {
        outObj[i] = this.clone(inObj[i]);
    }
    return outObj;
};
marknote.Cloner.prototype.cloneArray = function (inArray) {
    var outArray = new Array();
    var outObj;
    for (var i = 0; i < inArray.length; i++) {
        outObj = this.clone(inArray[i]);
        outArray.push(outObj);
    }
    return outArray;
};
marknote.Comment = function (text) {
    this.dataType = marknote.constants.DATATYPE_COMMENT;
    this.isSw8tXmlContent = true;
    this.text = marknote.Util.erefEncode(marknote.Util.nothingToBlank(text));
};
marknote.Comment.prototype.getText = function () {
    return marknote.Util.erefDecode(marknote.Util.nothingToBlank(this.text));
};
marknote.Comment.prototype.setText = function (text) {
    this.text = marknote.Util.erefEncode(marknote.Util.nothingToBlank(text));
};
marknote.Comment.prototype.toString = function () {
    return this.getText();
};
marknote.Comment.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.clone(this);
};
marknote.FPI = function (registration, organization, publicTextClass, publicTextDescription, publicTextLanguage) {
    this.registration = registration;
    this.organization = organization;
    this.publicTextClass = publicTextClass;
    this.publicTextDescription = publicTextDescription;
    this.publicTextLanguage = publicTextLanguage;
};
marknote.FPI.prototype.toString = function () {
    return "\"" + this.getRegistration() + "//" + this.getOrganization() + "//" + this.getPublicTextClass() + " " + this.getPublicTextDescription() + "//" + this.getPublicTextLanguage() + "\"";
};
marknote.FPI.prototype.getRegistration = function () {
    return this.registration;
};
marknote.FPI.prototype.setRegistration = function (registration) {
    this.registration = registration;
};
marknote.FPI.prototype.getOrganization = function () {
    return this.organization;
};
marknote.FPI.prototype.setOrganization = function (organization) {
    this.organziation = organization;
};
marknote.FPI.prototype.getPublicTextClass = function () {
    return this.publicTextClass;
};
marknote.FPI.prototype.setPublicTextClass = function (publicTextClass) {
    this.publicTextClass = publicTextClass;
};
marknote.FPI.prototype.getPublicTextDescription = function () {
    return this.publicTextDescription;
};
marknote.FPI.prototype.setPublicTextDescription = function (publicTextDescription) {
    this.publicTextDescription = publicTextDescription;
};
marknote.FPI.prototype.getPublicTextLanguage = function () {
    return this.publicTextLanguage;
};
marknote.FPI.prototype.setPublicTextLanguage = function (publicTextLanguage) {
    this.publicTextLanguage = publicTextLanguage;
};
marknote.DOCTYPE = function (topElement, availability, FPI, URL, internalSubset) {
    this.dataType = marknote.constants.DATATYPE_DOCTYPE;
    this.isSw8tXmlContent = false;
    if (topElement && !availability) {
        var str = new String(topElement);
        var parser = new marknote.Parser();
        var doctype = parser.parseDOCTYPE(str);
        this.topElement = doctype.getTopElement();
        this.availability = doctype.getAvailability();
        this.FPI = doctype.getFPI();
        this.URL = doctype.getURL();
        this.internalSubset = doctype.getInternalSubset();
    } else {
        this.setTopElement(topElement);
        this.setAvailability(availability);
        this.setFPI(FPI);
        this.setURL(URL);
        this.setInternalSubset(internalSubset);
    }
};
marknote.DOCTYPE.prototype.toString = function () {
    var fpi = this.getAvailability() == "PUBLIC" && this.getFPI() ? " " + this.getFPI() : "";
    var url = this.getURL() ? " " + this.getURL() : "";
    var internalSubset = this.getInternalSubset() ? " " + this.getInternalSubset() : "";
    return "<!DOCTYPE " + this.getTopElement() + " " + this.getAvailability() + fpi + url + internalSubset + ">";
};
marknote.DOCTYPE.prototype.getTopElement = function () {
    return this.topElement;
};
marknote.DOCTYPE.prototype.setTopElement = function (topElement) {
    this.topElement = topElement;
};
marknote.DOCTYPE.prototype.getAvailability = function () {
    return this.availability;
};
marknote.DOCTYPE.prototype.setAvailability = function (availability) {
    this.availability = availability;
};
marknote.DOCTYPE.prototype.getFPI = function () {
    return this.FPI;
};
marknote.DOCTYPE.prototype.setFPI = function (FPI) {
    this.FPI = FPI;
};
marknote.DOCTYPE.prototype.getURL = function () {
    return this.URL;
};
marknote.DOCTYPE.prototype.setURL = function (URL) {
    var formattedURL = marknote.Util.trim(URL);
    if (formattedURL === "") {
        this.URL = "";
        return;
    }
    if (formattedURL.charAt(0) != "\"") {
        formattedURL = "\"" + formattedURL;
    }
    if (formattedURL.charAt(formattedURL.length - 1) != "\"") {
        formattedURL += "\"";
    }
    this.URL = formattedURL;
};
marknote.DOCTYPE.prototype.getInternalSubset = function () {
    return this.internalSubset;
};
marknote.DOCTYPE.prototype.setInternalSubset = function (internalSubset) {
    this.dataType = marknote.constants.DATATYPE_DOCTYPE;
    this.internalSubset = internalSubset;
};
marknote.Document = function () {
    this.dataType = marknote.constants.DATATYPE_DOCUMENT;
    this.isSw8tXmlContent = false;
    this.processingInstructions = new Array();
    this.rootElement = new marknote.Element();
    this.contents = new Array();
};
marknote.Document.prototype.getProcessingInstructions = function () {
    return this.processingInstructions;
};
marknote.Document.prototype.setProcessingInstructions = function (processingInstructions) {
    this.processingInstructions = processingInstructions;
};
marknote.Document.prototype.addProcessingInstruction = function (processingInstruction) {
    this.processingInstructions.push(processingInstruction);
};
marknote.Document.prototype.removeProcessingInstruction = function (target) {
    for (var p = 0; p < this.processingInstructions.length; p++) {
        var currentTarget = this.processingInstructions[p].getTarget();
        if (currentTarget == target) {
            marknote.Util.removeArrayItem(this.processingInstructions, p);
        }
    }
};
marknote.Document.prototype.getRootElement = function () {
    return this.rootElement;
};
marknote.Document.prototype.setRootElement = function (element) {
    if (!(element instanceof marknote.Element)) {
        return;
    }
    this.rootElement = element;
};
marknote.Document.prototype.getDOCTYPE = function () {
    return this.DOCTYPE;
};
marknote.Document.prototype.setDOCTYPE = function (docType) {
    this.DOCTYPE = docType;
};
marknote.Document.prototype.getBaseURI = function () {
    return this.baseURI;
};
marknote.Document.prototype.setBaseURI = function (baseURI) {
    this.baseURI = baseURI;
};
marknote.Document.prototype.toString = function (indent, filterDocType, filterComments, filterProcessingInstructions) {
    var writer = new marknote.Writer();
    return writer.outputDocument(this, indent);
};
marknote.Document.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.cloneDocument(this);
};
marknote.Element = function (name) {
    this.dataType = marknote.constants.DATATYPE_ELEMENT;
    this.isSw8tXmlContent = true;
    this.contents = new Array();
    this.attributes = new Array();
    this.qname = new marknote.QName();
    this.isSelfTerminated = false;
    if (name) {
        if (name instanceof marknote.QName) {
            this.setQName(name);
        } else {
            this.setName(name);
        }
    }
};
marknote.Element.prototype.getName = function () {
    return this.qname.getName();
};
marknote.Element.prototype.setName = function (name) {
    this.qname.setName(name);
};
marknote.Element.prototype.getQName = function () {
    return this.qname;
};
marknote.Element.prototype.setQName = function (qname) {
    this.qname = qname;
};
marknote.Element.prototype.hasContents = function () {
    return this.contents && this.contents.length > 0;
};
marknote.Element.prototype.getContents = function () {
    return this.contents;
};
marknote.Element.prototype.getContentAt = function (index) {
    return this.getContents()[index];
};
marknote.Element.prototype.addContent = function (content) {
    if (content && content.isSw8tXmlContent) {
        this.getContents().push(content);
    }
};
marknote.Element.prototype.removeContent = function (index) {
    marknote.Util.removeArrayItem(this.contents, index);
};
marknote.Element.prototype.setContents = function (contents) {
    this.contents = contents;
};
marknote.Element.prototype.getText = function (decode) {
    var text = "";
    if (typeof decode == "undefined") {
        decode = true;
    }
    for (var i = 0; i < this.contents.length; i++) {
        var content = this.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType == marknote.constants.DATATYPE_TEXT) {
            text += content.getText(decode);
        } else {
            if (dataType == marknote.constants.DATATYPE_CDATA) {
                text += content.getText();
            }
        }
    }
    return text;
};
marknote.Element.prototype.setText = function (text) {
    var newContent = new Array();
    for (var i = 0; i < this.contents.length; i++) {
        var content = this.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType == marknote.constants.DATATYPE_COMMENT) {
            newContent.push(content);
        }
    }
    this.contents = newContent;
    text = text ? "" + text : "";
    this.contents.push(new marknote.Text(text));
};
marknote.Element.prototype.setCDATAText = function (text) {
    var newContent = new Array();
    for (var i = 0; i < this.contents.length; i++) {
        var content = this.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType == marknote.constants.DATATYPE_COMMENT) {
            newContent.push(content);
        }
    }
    this.contents = newContent;
    text = text ? "" + text : "";
    this.contents.push(new marknote.CDATA(text));
};
marknote.Element.prototype.removeText = function () {
    for (var i = this.contents.length - 1; i >= 0; i--) {
        var content = this.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType == marknote.constants.DATATYPE_TEXT || dataType == marknote.constants.DATATYPE_CDATA) {
            marknote.Util.removeArrayItem(this.contents, i);
        }
    }
};
marknote.Element.prototype.getCommentText = function () {
    var text = "";
    for (var i = 0; i < this.contents.length; i++) {
        var content = this.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType == marknote.constants.DATATYPE_COMMENT) {
            text += content.getText();
        }
    }
    return text;
};
marknote.Element.prototype.setCommentText = function (text) {
    this.removeComments();
    text = text ? "" + text : "";
    this.addContent(new marknote.Comment(text));
};
marknote.Element.prototype.removeComments = function () {
    for (var i = this.contents.length - 1; i >= 0; i--) {
        var content = this.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType == marknote.constants.DATATYPE_COMMENT) {
            marknote.Util.removeArrayItem(this.contents, i);
        }
    }
};
marknote.Element.prototype.addChildElement = function (element) {
    var dataType = marknote.Util.dataType(element);
    if (!dataType == marknote.constants.DATATYPE_ELEMENT) {
        return;
    }
    this.getContents().push(element);
};
marknote.Element.prototype.removeChildElements = function (elemName) {
    var total = 0;
    if (!elemName) {
        total = this.contents.length;
        this.contents = new Array();
        return total;
    }
    var compareName = elemName.dataType == marknote.constants.DATATYPE_QNAME ? elemName.getName() : elemName;
    var clonedContents = marknote.Cloner.cloneArray(this.contents);
    for (var i = clonedContents.length - 1; i >= 0; i--) {
        var dataType = marknote.Util.dataType(clonedContents[i]);
        if (dataType != marknote.constants.DATATYPE_ELEMENT) {
            continue;
        }
        if (this.clonedContents[i].getName() == compareName) {
            marknote.Util.removeArrayItem(this.contents, i);
            total++;
        }
    }
    return total;
};
marknote.Element.prototype.getChildElements = function (elemName) {
    var compareName = false;
    var selectedElements = new Array();
    if (elemName) {
        compareName = elemName.dataType == marknote.constants.DATATYPE_QNAME ? elemName.getName() : elemName;
    }
    for (var i = 0; i < this.contents.length; i++) {
        var content = this.contents[i];
        var dataType = marknote.Util.dataType(content);
        if (dataType != marknote.constants.DATATYPE_ELEMENT) {
            continue;
        }
        if (compareName) {
            if (content.getName() == compareName) {
                selectedElements.push(content);
            }
        } else {
            selectedElements.push(content);
        }
    }
    return selectedElements;
};
marknote.Element.prototype.getChildElement = function (elemName) {
    var compareName = elemName.dataType == marknote.constants.DATATYPE_QNAME ? elemName.getName() : elemName;
    if (compareName) {
        var elemContents = this.getContents();
        for (var c = 0; c < elemContents.length; c++) {
            var elemContent = elemContents[c];
            var dataType = marknote.Util.dataType(elemContent);
            if (dataType == marknote.constants.DATATYPE_ELEMENT) {
                var contentName = elemContent.getName();
                if (contentName === compareName) {
                    return elemContent;
                }
            }
        }
    }
    return false;
};
marknote.Element.prototype.removeChildElement = function (elemName) {
    var compareName = elemName.dataType == marknote.constants.DATATYPE_QNAME ? elemName.getName() : elemName;
    if (compareName) {
        var elemContents = this.getContents();
        for (var c = 0; c < elemContents.length; c++) {
            var elemContent = elemContents[c];
            var dataType = marknote.Util.dataType(elemContent);
            if (dataType == marknote.constants.DATATYPE_ELEMENT) {
                var contentName = elemContent.getName();
                if (contentName === compareName) {
                    marknote.Util.removeArrayItem(this.contents, c);
                    return;
                }
            }
        }
    }
};
marknote.Element.prototype.getChildElementAt = function (index) {
    try {
        return this.getChildElements()[index];
    }
    catch (err) {
        return false;
    }
};
marknote.Element.prototype.removeChildElementAt = function (index) {
    var childElemIndex = -1;
    var isElement;
    for (var c = 0; c < this.contents.length; c++) {
        isElement = marknote.Util.dataType(this.contents[c]) == marknote.constants.DATATYPE_ELEMENT;
        if (isElement) {
            childElemIndex++;
            if (index == childElemIndex) {
                marknote.Util.removeArrayItem(this.contents, c);
                return;
            }
        }
    }
};
marknote.Element.prototype.getAttributes = function () {
    return this.attributes;
};
marknote.Element.prototype.setAttributes = function (attributes) {
    this.attributes = attributes;
};
marknote.Element.prototype.getAttribute = function (name) {
    for (var i = 0; i < this.getAttributes().length; i++) {
        var attribute = this.getAttributes()[i];
        if (attribute.getName() == name) {
            return attribute;
        }
    }
    return false;
};
marknote.Element.prototype.getAttributeValue = function (name) {
    var attrib = this.getAttribute(name);
    return attrib ? attrib.getValue() : "";
};
marknote.Element.prototype.getAttributeAt = function (index) {
    return this.getAttributes()[index];
};
marknote.Element.prototype.setAttribute = function (name, value) {
    if (marknote.Util.dataType(name) == marknote.constants.DATATYPE_ATTRIBUTE) {
        this.putAttribute(name);
    } else {
        for (var i = 0; i < this.getAttributes().length; i++) {
            var attribute = this.getAttributes()[i];
            if (attribute.getName() == name) {
                attribute.setValue(value);
                return;
            }
        }
        this.putAttribute(new marknote.Attribute(name, value));
    }
};
marknote.Element.prototype.putAttribute = function (attribute) {
    if (attribute && this.getAttribute(attribute.getName())) {
        this.removeAttribute(attribute.getName());
    }
    this.getAttributes().push(attribute);
};
marknote.Element.prototype.removeAttribute = function (name) {
    var newAttributes = new Array();
    for (var i = 0; i < this.getAttributes().length; i++) {
        var attribute = this.getAttributes()[i];
        if (attribute.getName() != name) {
            newAttributes.push(attribute);
        }
    }
    this.setAttributes(newAttributes);
};
marknote.Element.prototype.removeAllAttributes = function () {
    this.setAttributes(new Array());
};
marknote.Element.prototype.toString = function (indent) {
    var writer = new marknote.Writer();
    return writer.outputElement(this, 0, indent);
};
marknote.Element.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.cloneElement(this);
};
marknote.EntityRef = function (name, character) {
    this.dataType = marknote.constants.DATATYPE_ENTITYREF;
    this.name = name;
    this.character = character;
};
marknote.EntityRef.prototype.getName = function () {
    return this.name;
};
marknote.EntityRef.prototype.setName = function (name) {
    this.name = name;
};
marknote.EntityRef.prototype.getName = function () {
    return this.name;
};
marknote.EntityRef.prototype.setName = function (character) {
    this.dataType = marknote.constants.DATATYPE_ENTITYREF;
    this.isSw8tXmlContent = false;
    this.character = character;
};
marknote.EntityRef.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.clone(this);
};
marknote.XMLEntityRefs = function () {
    this.dataType = marknote.constants.DATATYPE_XMLENTITYREFS;
    this.isSw8tXmlContent = false;
    this.refs = new Array();
    this.pushRef("quot", 34);
    this.pushRef("amp", 38);
    this.pushRef("apos", 39);
    this.pushRef("lt", 60);
    this.pushRef("gt", 62);
};
marknote.XMLEntityRefs.prototype.getRefs = function () {
    return this.refs;
};
marknote.XMLEntityRefs.prototype.pushRef = function (name, charCode) {
    this.refs.push(new marknote.EntityRef(name, String.fromCharCode(charCode)));
};
marknote.EntityRefs = function () {
    this.dataType = marknote.constants.DATATYPE_ENTITYREFS;
    this.isSw8tXmlContent = false;
    this.refs = new Array().concat(new marknote.XMLEntityRefs().getRefs());
    this.pushRef("nbsp", 160);
    this.pushRef("iexcl", 161);
    this.pushRef("cent", 162);
    this.pushRef("pound", 163);
    this.pushRef("curren", 164);
    this.pushRef("yen", 165);
    this.pushRef("brvbar", 166);
    this.pushRef("sect", 167);
    this.pushRef("uml", 168);
    this.pushRef("copy", 169);
    this.pushRef("ordf", 170);
    this.pushRef("laquo", 171);
    this.pushRef("not", 172);
    this.pushRef("shy", 173);
    this.pushRef("reg", 174);
    this.pushRef("macr", 175);
    this.pushRef("deg", 176);
    this.pushRef("plusmn", 177);
    this.pushRef("sup2", 178);
    this.pushRef("sup3", 179);
    this.pushRef("acute", 180);
    this.pushRef("micro", 181);
    this.pushRef("para", 182);
    this.pushRef("middot", 183);
    this.pushRef("cedil", 184);
    this.pushRef("sup1", 185);
    this.pushRef("ordm", 186);
    this.pushRef("raquo", 187);
    this.pushRef("frac14", 188);
    this.pushRef("frac12", 189);
    this.pushRef("frac34", 190);
    this.pushRef("iquest", 191);
    this.pushRef("Agrave", 192);
    this.pushRef("Aacute", 193);
    this.pushRef("Acirc", 194);
    this.pushRef("Atilde", 195);
    this.pushRef("Auml", 196);
    this.pushRef("Aring", 197);
    this.pushRef("AElig", 198);
    this.pushRef("Ccedil", 199);
    this.pushRef("Egrave", 200);
    this.pushRef("Eacute", 201);
    this.pushRef("Ecirc", 202);
    this.pushRef("Euml", 203);
    this.pushRef("Igrave", 204);
    this.pushRef("Iacute", 205);
    this.pushRef("Icirc", 206);
    this.pushRef("Iuml", 207);
    this.pushRef("ETH", 208);
    this.pushRef("Ntilde", 209);
    this.pushRef("Ograve", 210);
    this.pushRef("Oacute", 211);
    this.pushRef("Ocirc", 212);
    this.pushRef("Otilde", 213);
    this.pushRef("Ouml", 214);
    this.pushRef("times", 215);
    this.pushRef("Oslash", 216);
    this.pushRef("Ugrave", 217);
    this.pushRef("Uacute", 218);
    this.pushRef("Ucirc", 219);
    this.pushRef("Uuml", 220);
    this.pushRef("Yacute", 221);
    this.pushRef("THORN", 222);
    this.pushRef("szlig", 223);
    this.pushRef("agrave", 224);
    this.pushRef("aacute", 225);
    this.pushRef("acirc", 226);
    this.pushRef("atilde", 227);
    this.pushRef("auml", 228);
    this.pushRef("aring", 229);
    this.pushRef("aelig", 230);
    this.pushRef("ccedil", 231);
    this.pushRef("egrave", 232);
    this.pushRef("eacute", 233);
    this.pushRef("ecirc", 234);
    this.pushRef("euml", 235);
    this.pushRef("igrave", 236);
    this.pushRef("iacute", 237);
    this.pushRef("icirc", 238);
    this.pushRef("iuml", 239);
    this.pushRef("eth", 240);
    this.pushRef("ntilde", 241);
    this.pushRef("ograve", 242);
    this.pushRef("oacute", 243);
    this.pushRef("ocirc", 244);
    this.pushRef("otilde", 245);
    this.pushRef("ouml", 246);
    this.pushRef("divide", 247);
    this.pushRef("oslash", 248);
    this.pushRef("ugrave", 249);
    this.pushRef("uacute", 250);
    this.pushRef("ucirc", 251);
    this.pushRef("uuml", 252);
    this.pushRef("yacute", 253);
    this.pushRef("thorn", 254);
    this.pushRef("yuml", 255);
    this.pushRef("OElig", 338);
    this.pushRef("oelig", 339);
    this.pushRef("Scaron", 352);
    this.pushRef("scaron", 353);
    this.pushRef("Yuml", 376);
    this.pushRef("fnof", 402);
    this.pushRef("circ", 710);
    this.pushRef("tilde", 732);
    this.pushRef("Alpha", 913);
    this.pushRef("Beta", 914);
    this.pushRef("Gamma", 915);
    this.pushRef("Delta", 916);
    this.pushRef("Epsilon", 917);
    this.pushRef("Zeta", 918);
    this.pushRef("Eta", 919);
    this.pushRef("Theta", 920);
    this.pushRef("Iota", 921);
    this.pushRef("Kappa", 922);
    this.pushRef("Lambda", 923);
    this.pushRef("Mu", 924);
    this.pushRef("Nu", 925);
    this.pushRef("Xi", 926);
    this.pushRef("Omicron", 927);
    this.pushRef("Pi", 928);
    this.pushRef("Rho", 929);
    this.pushRef("Sigma", 931);
    this.pushRef("Tau", 932);
    this.pushRef("Upsilon", 933);
    this.pushRef("Phi", 934);
    this.pushRef("Chi", 935);
    this.pushRef("Psi", 936);
    this.pushRef("Omega", 937);
    this.pushRef("alpha", 945);
    this.pushRef("beta", 946);
    this.pushRef("gamma", 947);
    this.pushRef("delta", 948);
    this.pushRef("epsilon", 949);
    this.pushRef("zeta", 950);
    this.pushRef("eta", 951);
    this.pushRef("theta", 952);
    this.pushRef("iota", 953);
    this.pushRef("kappa", 954);
    this.pushRef("lambda", 955);
    this.pushRef("mu", 956);
    this.pushRef("nu", 957);
    this.pushRef("xi", 958);
    this.pushRef("omicron", 959);
    this.pushRef("pi", 960);
    this.pushRef("rho", 961);
    this.pushRef("sigmaf", 962);
    this.pushRef("sigma", 963);
    this.pushRef("tau", 964);
    this.pushRef("upsilon", 965);
    this.pushRef("phi", 966);
    this.pushRef("chi", 967);
    this.pushRef("psi", 968);
    this.pushRef("omega", 969);
    this.pushRef("thetasym", 977);
    this.pushRef("upish", 978);
    this.pushRef("piv", 982);
    this.pushRef("ensp", 8194);
    this.pushRef("emsp", 8195);
    this.pushRef("thinsp", 8201);
    this.pushRef("zwnj", 8204);
    this.pushRef("zwj", 8205);
    this.pushRef("lrm", 8206);
    this.pushRef("rlm", 8207);
    this.pushRef("ndash", 8211);
    this.pushRef("mdash", 8212);
    this.pushRef("lsquo", 8216);
    this.pushRef("rsquo", 8217);
    this.pushRef("sbquo", 8218);
    this.pushRef("ldquo", 8220);
    this.pushRef("rdquo", 8221);
    this.pushRef("bdquo", 8222);
    this.pushRef("dagger", 8224);
    this.pushRef("Dagger", 8225);
    this.pushRef("bull", 8226);
    this.pushRef("hellip", 8230);
    this.pushRef("permil", 8240);
    this.pushRef("prime", 8242);
    this.pushRef("Prime", 8243);
    this.pushRef("lsaquo", 8249);
    this.pushRef("rsaquo", 8250);
    this.pushRef("oline", 8254);
    this.pushRef("frasl", 8260);
    this.pushRef("euro", 8364);
    this.pushRef("image", 8465);
    this.pushRef("weierp", 8472);
    this.pushRef("real", 8476);
    this.pushRef("trade", 8482);
    this.pushRef("alefsym", 8501);
    this.pushRef("larr", 8592);
    this.pushRef("uarr", 8593);
    this.pushRef("rarr", 8594);
    this.pushRef("darr", 8595);
    this.pushRef("harr", 8596);
    this.pushRef("crarr", 8629);
    this.pushRef("lArr", 8656);
    this.pushRef("uArr", 8657);
    this.pushRef("rArr", 8658);
    this.pushRef("dArr", 8659);
    this.pushRef("hArr", 8660);
    this.pushRef("forall", 8704);
    this.pushRef("part", 8706);
    this.pushRef("exist", 8707);
    this.pushRef("empty", 8709);
    this.pushRef("nabla", 8711);
    this.pushRef("isin", 8712);
    this.pushRef("notin", 8713);
    this.pushRef("ni", 8715);
    this.pushRef("prod", 8719);
    this.pushRef("sum", 8721);
    this.pushRef("minus", 8722);
    this.pushRef("lowast", 8727);
    this.pushRef("radic", 8730);
    this.pushRef("prop", 8733);
    this.pushRef("infin", 8734);
    this.pushRef("ang", 8736);
    this.pushRef("and", 8743);
    this.pushRef("or", 8744);
    this.pushRef("cap", 8745);
    this.pushRef("cup", 8746);
    this.pushRef("int", 8747);
    this.pushRef("there4", 8756);
    this.pushRef("sim", 8764);
    this.pushRef("cong", 8773);
    this.pushRef("asymp", 8776);
    this.pushRef("ne", 8800);
    this.pushRef("equiv", 8801);
    this.pushRef("le", 8804);
    this.pushRef("ge", 8805);
    this.pushRef("sub", 8834);
    this.pushRef("sup", 8835);
    this.pushRef("nsub", 8836);
    this.pushRef("sube", 8838);
    this.pushRef("supe", 8839);
    this.pushRef("oplus", 8853);
    this.pushRef("otimes", 8855);
    this.pushRef("perp", 8869);
    this.pushRef("sdot", 8901);
    this.pushRef("lceil", 8968);
    this.pushRef("rceil", 8969);
    this.pushRef("lfloor", 8970);
    this.pushRef("rfloor", 8971);
    this.pushRef("lang", 9001);
    this.pushRef("rang", 9002);
    this.pushRef("loz", 9674);
    this.pushRef("spades", 9824);
    this.pushRef("clubs", 9827);
    this.pushRef("hearts", 9829);
    this.pushRef("diams", 9830);
};
marknote.EntityRefs.prototype.getRefs = function () {
    return this.refs;
};
marknote.EntityRefs.prototype.pushRef = function (name, charCode) {
    this.refs.push(new marknote.EntityRef(name, String.fromCharCode(charCode)));
};
marknote.Parser = function () {
    this.dataType = marknote.constants.DATATYPE_PARSER;
    this.isSw8tXmlContent = false;
    this.doc = new marknote.Document();
    this.status = 0;
    this.statusMessage = "success";
    this.xhr = null;
    this.xhrStatus = null;
    this.xhrStatusText = null;
    this.xhrResponseText = null;
};
marknote.Parser.prototype.getDocument = function () {
    return this.doc;
};
marknote.Parser.prototype.getXHR = function () {
    return this.xhr;
};
marknote.Parser.prototype.getXHRStatus = function () {
    return this.xhrStatus;
};
marknote.Parser.prototype.getXHRStatusText = function () {
    return this.xhrStatusText;
};
marknote.Parser.prototype.getXHRResponseText = function () {
    return this.xhrResponseText;
};
marknote.Parser.prototype.getStatus = function () {
    return this.status;
};
marknote.Parser.prototype.setStatus = function (status) {
    this.status = status;
};
marknote.Parser.prototype.getStatusMessage = function () {
    return this.statusMessage;
};
marknote.Parser.prototype.setStatusMessage = function (statusMessage) {
    this.statusMessage = statusMessage;
};
marknote.Parser.prototype.parseProcessingInstructions = function (str, doc) {
    var tokenizer = new marknote.Tokenizer(str);
    var tokens = tokenizer.tokenize();
    var startPosition = 0, endPosition = 0;
    var isInPI = false;
    var pi, target, data, attr, name, value, tokenType;
    for (var t = 0; t < tokens.length; t++) {
        tokenType = tokens[t].getType();
        switch (tokenType) {
          case marknote.constants.TOKENTYPE_PI_START:
            startPosition = tokens[t].getPosition();
            target = "";
            data = new Array();
            isInPI = true;
            target = tokens[t + 1].getContent();
            t++;
            break;
          case marknote.constants.TOKENTYPE_PI_END:
            if (isInPI) {
                if (marknote.Util.isUndefinedNullOrBlank(target)) {
                    target = "xml";
                }
            }
            isInPI = false;
            endPosition = tokens[t].getPosition() + 2;
            pi = new marknote.ProcessingInstruction(target, data);
            doc.addProcessingInstruction(pi);
            break;
          case marknote.constants.TOKENTYPE_ATTRIBUTE:
            if (isInPI) {
                name = tokens[t - 1].getContent();
                value = tokens[t + 1].getContent();
                value = value.slice(1, value.length - 1);
                attr = new marknote.Attribute(name, value);
                data.push(attr);
            }
            t++;
            break;
          default:
            break;
        }
    }
    if (endPosition > startPosition) {
        var str1 = startPosition > 0 ? str.slice(0, startPosition) : "";
        var str2 = str.slice(endPosition + 1);
        return marknote.Util.trim(str1 + str2);
    } else {
        return str;
    }
};
marknote.Parser.prototype.parseProcessingInstructions = function (str, doc) {
    var tokenizer = new marknote.Tokenizer(str);
    var tokens = tokenizer.tokenize();
    var startPosition = 0, endPosition = 0;
    var isInPI = false;
    var pi, target, data, attr, name, value, tokenType;
    for (var t = 0; t < tokens.length; t++) {
        tokenType = tokens[t].getType();
        switch (tokenType) {
          case marknote.constants.TOKENTYPE_PI_START:
            startPosition = tokens[t].getPosition();
            target = "";
            data = new Array();
            isInPI = true;
            target = tokens[t + 1].getContent();
            t++;
            break;
          case marknote.constants.TOKENTYPE_PI_END:
            if (isInPI) {
                if (marknote.Util.isUndefinedNullOrBlank(target)) {
                    target = "xml";
                }
            }
            isInPI = false;
            endPosition = tokens[t].getPosition() + 2;
            pi = new marknote.ProcessingInstruction(target, data);
            doc.addProcessingInstruction(pi);
            break;
          case marknote.constants.TOKENTYPE_ATTRIBUTE:
            if (isInPI) {
                name = tokens[t - 1].getContent();
                value = tokens[t + 1].getContent();
                value = value.slice(1, value.length - 1);
                attr = new marknote.Attribute(name, value);
                data.push(attr);
            }
            t++;
            break;
          default:
            break;
        }
    }
    if (endPosition > startPosition) {
        var str1 = startPosition > 0 ? str.slice(0, startPosition) : "";
        var str2 = str.slice(endPosition + 1);
        return marknote.Util.trim(str1 + str2);
    } else {
        return str;
    }
};
marknote.Parser.prototype.parseDOCTYPE = function (str, doc) {
    var tokenizer = new marknote.Tokenizer(str);
    var tokens = tokenizer.tokenize();
    var docType = new marknote.DOCTYPE();
    var tokenType, availability;
    try {
        for (var t = 0; t < tokens.length; t++) {
            tokenType = tokens[t].getType();
            switch (tokenType) {
              case marknote.constants.TOKENTYPE_DOCTYPE_START:
                if (doc) {
                    doc.setDOCTYPE(docType);
                }
                if (tokens[++t].isTagClose()) {
                    return docType;
                }
                docType.setTopElement(tokens[t].getContent());
                availability = tokens[++t].getContent().toUpperCase();
                docType.setAvailability(availability);
                if ("SYSTEM" == availability) {
                    if (tokens[++t].isTagClose()) {
                        return docType;
                    }
                    docType.setURL(tokens[t].getContent());
                } else {
                    if ("PUBLIC" == availability) {
                        if (tokens[++t].isTagClose()) {
                            return docType;
                        }
                        docType.setFPI(tokens[t].getContent());
                        if (tokens[++t].isTagClose()) {
                            return docType;
                        }
                        docType.setURL(tokens[t].getContent());
                        if (tokens[++t].isTagClose()) {
                            return docType;
                        }
                        docType.setInternalSubset(tokens[t].getContent());
                    }
                }
                break;
              case marknote.constants.TOKENTYPE_TAG_CLOSE:
                return docType;
              default:
                break;
            }
        }
    }
    catch (err) {
        window.alert(err);
    }
    return docType;
};
marknote.Parser.prototype.parse = function (str) {
    this.xhr = null;
    this.xhrStatus = null;
    this.xhrStatusText = null;
    this.xhrResponseText = null;
    this.doc = new marknote.Document();
    this.setStatus(0);
    str = this.parseProcessingInstructions(str, this.doc);
    this.parseDOCTYPE(str, this.doc);
    this.parseElement(str, this.doc);
    return this.doc;
};
marknote.Parser.prototype.parseURL = function (url, params, method) {
    var sjax = new marknote.SJAX();
    var doc = sjax.read(url, params, method);
    this.xhr = sjax.getRequest();
    this.xhrStatus = sjax.getStatus();
    this.xhrStatusText = sjax.getStatusText();
    this.xhrResponseText = sjax.getResponseText();
    return doc;
};
marknote.Parser.prototype.parseComment = function (parentElem, tokens, t) {
    var text = tokens[t + 1].content == marknote.constants.COMMENT_START ? "" : tokens[t + 1].content;
    var comment = new marknote.Comment(text);
    if (parentElem) {
        parentElem.addContent(comment);
    }
    t = tokens[t + 1].content == marknote.constants.COMMENT_START ? t + 1 : t + 2;
    return t;
};
marknote.Parser.prototype.parseElement = function (markup, doc, parentElem) {
    var tokenizer = new marknote.Tokenizer(markup);
    var tokens = tokenizer.tokenize();
    var tokenPosition = 0, endTokenPosition = 0;
    var isCommentNext = false;
    for (var t = 0; t < tokens.length; t++) {
        if (tokens[t].isCommentStart()) {
            t = this.parseComment(parentElem, tokens, t);
            continue;
        }
        for (; t < tokens.length; t++) {
            if (tokens[t].isTagOpen()) {
                tokenPosition = t;
                break;
            }
        }
        if (tokenPosition != t) {
            return;
        }
        var elem = new marknote.Element(tokens[tokenPosition + 1].content);
        if (!parentElem) {
            doc.setRootElement(elem);
        } else {
            parentElem.addContent(elem);
        }
        for (t = tokenPosition + 1; t < tokens.length; t++) {
            switch (tokens[t].getType()) {
              case marknote.constants.TOKENTYPE_SELF_TERMINATING:
                elem.isSelfTerminated = true;
                tokenPosition = t;
                break;
              case marknote.constants.TOKENTYPE_TAG_CLOSE:
                elem.isSelfTerminated = false;
                tokenPosition = t;
                break;
              case marknote.constants.TOKENTYPE_ATTRIBUTE:
                try {
                    var attribName = tokens[t - 1].content;
                    var valueToken = tokens[t + 1].content;
                    var attribValue = valueToken.slice(1, valueToken.length - 1);
                    var attrib = new marknote.Attribute(attribName, attribValue);
                    elem.putAttribute(attrib);
                }
                catch (err) {
                }
                break;
              default:
                break;
            }
            if (tokenPosition == t) {
                break;
            }
        }
        if (!tokenPosition == t) {
            return;
        }
        switch (tokens[tokenPosition].content) {
          case marknote.constants.TAG_CLOSE_SELF_TERMINATING:
            isCommentNext = tokens[tokenPosition + 1] && tokens[tokenPosition + 1].content == marknote.constants.COMMENT_START;
            if (isCommentNext) {
                endTokenPosition = tokenPosition + 1;
                while (isCommentNext) {
                    endTokenPosition = this.parseComment(parentElem, tokens, endTokenPosition);
                    isCommentNext = tokens[endTokenPosition + 1] && tokens[endTokenPosition + 1].content == marknote.constants.COMMENT_START;
                    if (isCommentNext) {
                        endTokenPosition++;
                    }
                }
            } else {
                endTokenPosition = tokenPosition;
            }
            break;
          case marknote.constants.TAG_CLOSE:
            if (tokens[tokenPosition + 1]) {
                if (tokens[tokenPosition + 1].isCDATAStart()) {
                    var cdataContent = tokens[t + 2].content;
                    var cdataEnd = t + 3;
                    if (tokens[t + 2].isCDATAEnd()) {
                        cdataContent = "";
                        cdataEnd = t + 2;
                    }
                    var cdata = new marknote.CDATA(cdataContent);
                    elem.addContent(cdata);
                    tokenPosition = cdataEnd;
                } else {
                    if (tokens[tokenPosition + 1].isLiteral) {
                        elem.setText(tokens[tokenPosition + 1].getContent());
                    }
                }
            } else {
                endTokenPosition = tokenPosition;
            }
            for (t = tokenPosition + 1; t < tokens.length; t++) {
                var isEndOfElementFound = tokens[t].getContent() == marknote.constants.ENDTAG_OPEN && tokens[t + 1].getContent() == elem.getName() ? true : false;
                if (isEndOfElementFound) {
                    endTokenPosition = t;
                    isCommentNext = tokens[endTokenPosition + 3] && tokens[endTokenPosition + 3].content == marknote.constants.COMMENT_START;
                    if (isCommentNext) {
                        endTokenPosition = this.parseComment(parentElem, tokens, endTokenPosition + 3);
                    }
                    var hasChildren = endTokenPosition == tokenPosition + 1 || (tokens[tokenPosition + 1].isLiteral && endTokenPosition == tokenPosition + 2) ? false : true;
                    if (!hasChildren) {
                        break;
                    }
                    var start = tokens[tokenPosition + 1].getPosition();
                    var end = tokens[endTokenPosition].getPosition();
                    var childMarkup = markup.slice(start, end);
                    this.parseElement(childMarkup, doc, elem);
                    break;
                }
            }
            if (!isEndOfElementFound) {
                return;
            }
            break;
          default:
            return;
        }
        t = endTokenPosition;
    }
};
marknote.ProcessingInstruction = function (target, data) {
    this.dataType = marknote.constants.DATATYPE_PROCESSINGINSTRUCTION;
    this.isSw8tXmlContent = false;
    this.target = target ? target : "xml";
    if (target && !data) {
        this.data = new Array();
    } else {
        if (!data) {
            this.data = [new marknote.Attribute("version", "1.0"), new marknote.Attribute("encoding", "UTF-8")];
        } else {
            this.data = data;
        }
    }
};
marknote.ProcessingInstruction.prototype.getData = function () {
    return this.data;
};
marknote.ProcessingInstruction.prototype.setData = function (data) {
    this.data = data;
};
marknote.ProcessingInstruction.prototype.getTarget = function () {
    return this.target;
};
marknote.ProcessingInstruction.prototype.setTarget = function (target) {
    this.target = target;
};
marknote.ProcessingInstruction.prototype.setAttribute = function (attribute) {
    var data = this.getData();
    if (marknote.Util.dataType(attribute) == marknote.constants.DATATYPE_ATTRIBUTE) {
        for (var a = 0; a < data.length; a++) {
            if (data[a].getName() == attribute.getName()) {
                data[a].setValue(attribute.getValue());
                return;
            }
        }
    }
};
marknote.ProcessingInstruction.prototype.getAttributeValue = function (attributeName) {
    var data = this.getData();
    for (var a = 0; a < data.length; a++) {
        if (data[a].getName() == attributeName) {
            return data[a];
        }
    }
    return false;
};
marknote.ProcessingInstruction.prototype.setAttributeValue = function (attributeName, value) {
    var data = this.getData();
    if (attributeName) {
        if (typeof value == "undefined") {
            value = "";
        }
        for (var a = 0; a < data.length; a++) {
            if (data[a].getName() == attributeName) {
                data[a].setValue(value);
                return;
            }
        }
        data.push(new marknote.Attribute(attributeName, value));
    }
};
marknote.ProcessingInstruction.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.cloneProcessingInstruction(this);
};
marknote.QName = function (prefix, localPart) {
    this.dataType = marknote.constants.DATATYPE_QNAME;
    this.isSw8tXmlContent = false;
    this.prefix = marknote.Util.nothingToBlank(prefix);
    this.localPart = marknote.Util.nothingToBlank(localPart);
};
marknote.QName.prototype.getName = function () {
    var output = "";
    if (marknote.Util.hasValue(this.prefix)) {
        output += this.prefix + ":";
    }
    if (marknote.Util.hasValue(this.localPart)) {
        output += this.localPart;
    }
    return output;
};
marknote.QName.prototype.setName = function (name) {
    var normalizedName = marknote.Util.nothingToBlank(name);
    var nameParts = normalizedName.split(":");
    if (nameParts.length > 1) {
        this.prefix = nameParts[0];
        this.localPart = nameParts[1];
    } else {
        this.prefix = "";
        this.localPart = normalizedName;
    }
};
marknote.QName.prototype.getPrefix = function () {
    return marknote.Util.nothingToBlank(this.prefix);
};
marknote.QName.prototype.setPrefix = function (prefix) {
    this.prefix = marknote.Util.nothingToBlank(prefix);
};
marknote.QName.prototype.getLocalPart = function () {
    return marknote.Util.nothingToBlank(this.localPart);
};
marknote.QName.prototype.setLocalPart = function (localPart) {
    this.localPart = marknote.Util.nothingToBlank(localPart);
};
marknote.QName.prototype.toString = function () {
    return this.getName();
};
marknote.QName.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.clone(this);
};
marknote.Text = function (text) {
    this.dataType = marknote.constants.DATATYPE_TEXT;
    this.isSw8tXmlContent = true;
    this.text = marknote.Util.erefEncode(marknote.Util.nothingToBlank(text));
};
marknote.Text.prototype.getText = function (decode) {
    if (marknote.Util.isEmpty(decode)) {
        decode = true;
    }
    var normalizedText = marknote.Util.nothingToBlank(this.text);
    return decode ? marknote.Util.erefDecode(normalizedText) : normalizedText;
};
marknote.Text.prototype.setText = function (text) {
    this.text = marknote.Util.erefEncode(marknote.Util.nothingToBlank(text));
};
marknote.Text.prototype.toString = function () {
    return this.getText();
};
marknote.Text.prototype.clone = function () {
    var cloner = new marknote.Cloner();
    return cloner.clone(this);
};
marknote.Token = function (content, position) {
    this.dataType = marknote.constants.DATATYPE_TOKEN;
    this.isSwt8XmlContent = false;
    this.content = typeof (content) == "undefined" ? new String() : content;
    this.isLiteral = false;
    this.position = position ? position : 0;
};
marknote.Token.prototype.getContent = function () {
    return this.content;
};
marknote.Token.prototype.setContent = function (content) {
    this.content = content;
};
marknote.Token.prototype.getPosition = function () {
    return this.position;
};
marknote.Token.prototype.setPosition = function (position) {
    this.position = position;
};
marknote.Token.prototype.hasValue = function () {
    try {
        return marknote.Util.hasValue(this.content);
    }
    catch (err) {
        return false;
    }
};
marknote.Token.prototype.isDOCTYPEStart = function () {
    return this.content == marknote.constants.DOCTYPE_START;
};
marknote.Token.prototype.isPIStart = function () {
    return this.content == marknote.constants.PI_START;
};
marknote.Token.prototype.isPIEnd = function () {
    return this.content == marknote.constants.PI_END;
};
marknote.Token.prototype.isSelfTerminating = function () {
    return this.content == marknote.constants.TAG_CLOSE_SELF_TERMINATING;
};
marknote.Token.prototype.isEndTag = function () {
    return this.content == marknote.constants.ENDTAG_OPEN;
};
marknote.Token.prototype.isCommentStart = function () {
    return this.content == marknote.constants.COMMENT_START;
};
marknote.Token.prototype.isCommentEnd = function () {
    return this.content == marknote.constants.COMMENT_END;
};
marknote.Token.prototype.isAttribute = function () {
    return this.content == marknote.constants.EQUALS;
};
marknote.Token.prototype.isCDATAStart = function () {
    return this.content == marknote.constants.CDATA_START;
};
marknote.Token.prototype.isCDATAEnd = function () {
    return this.content == marknote.constants.CDATA_END;
};
marknote.Token.prototype.isTagOpen = function () {
    return this.content == marknote.constants.TAG_OPEN;
};
marknote.Token.prototype.isTagClose = function () {
    return this.content == marknote.constants.TAG_CLOSE;
};
marknote.Token.prototype.isQuote = function () {
    return this.content == marknote.constants.SQUOTE || this.content == marknote.constants.DQUOTE;
};
marknote.Token.prototype.isQuoted = function () {
    return this.content.charAt(0) == "\"" && this.content.charAt(this.content.length - 1) == "\"";
};
marknote.Token.prototype.getType = function () {
    if (this.isDOCTYPEStart()) {
        return marknote.constants.TOKENTYPE_DOCTYPE_START;
    }
    if (this.isPIStart()) {
        return marknote.constants.TOKENTYPE_PI_START;
    }
    if (this.isPIEnd()) {
        return marknote.constants.TOKENTYPE_PI_END;
    }
    if (this.isSelfTerminating()) {
        return marknote.constants.TOKENTYPE_SELF_TERMINATING;
    }
    if (this.isEndTag()) {
        return marknote.constants.TOKENTYPE_ENDTAG_OPEN;
    }
    if (this.isCommentStart()) {
        return marknote.constants.TOKENTYPE_COMMENT_START;
    }
    if (this.isCommentEnd()) {
        return marknote.constants.TOKENTYPE_COMMENT_END;
    }
    if (this.isAttribute()) {
        return marknote.constants.TOKENTYPE_ATTRIBUTE;
    }
    if (this.isCDATAStart()) {
        return marknote.constants.TOKENTYPE_CDATA_START;
    }
    if (this.isCDATAEnd()) {
        return marknote.constants.TOKENTYPE_CDATA_END;
    }
    if (this.isTagOpen()) {
        return marknote.constants.TOKENTYPE_TAG_OPEN;
    }
    if (this.isTagClose()) {
        return marknote.constants.TOKENTYPE_TAG_CLOSE;
    }
    if (this.isQuote()) {
        return marknote.constants.TOKENTYPE_QUOTE;
    }
    if (this.isQuoted()) {
        return marknote.constants.TOKENTYPE_QUOTED;
    }
    return marknote.constants.TOKENTYPE_NORMAL;
};
marknote.Tokenizer = function (markup) {
    this.dataType = marknote.constants.DATATYPE_TOKENIZER;
    this.isSw8tXmlContent = false;
    this.setMarkup(markup);
    this.tokens = new Array();
};
marknote.Tokenizer.prototype.getMarkup = function () {
    return this.markup;
};
marknote.Tokenizer.prototype.setMarkup = function (markup) {
    this.markup = markup ? markup : "";
};
marknote.Tokenizer.prototype.determineTokenType = function (c, isInTag, isInEndTag) {
    var ch = this.markup.charAt(c);
    var beforeCh = c > 0 ? this.markup.charAt(c - 1) : null;
    if (marknote.Util.hasWhitespace(ch)) {
        return marknote.constants.TOKENTYPE_WHITESPACE;
    }
    if (this.markup.slice(c, c + 9) == marknote.constants.DOCTYPE_START) {
        return marknote.constants.TOKENTYPE_DOCTYPE_START;
    }
    if (this.markup.slice(c, c + 9) == marknote.constants.CDATA_START) {
        return marknote.constants.TOKENTYPE_CDATA_START;
    }
    if (this.markup.slice(c, c + 4) == marknote.constants.COMMENT_START) {
        return marknote.constants.TOKENTYPE_COMMENT_START;
    }
    if (this.markup.slice(c, c + 3) == marknote.constants.CDATA_END) {
        return marknote.constants.TOKENTYPE_CDATA_END;
    }
    if (this.markup.slice(c, c + 2) == marknote.constants.PI_START) {
        return marknote.constants.TOKENTYPE_PI_START;
    }
    if (this.markup.slice(c, c + 2) == marknote.constants.PI_END) {
        return marknote.constants.TOKENTYPE_PI_END;
    }
    if (this.markup.slice(c, c + 2) == marknote.constants.TAG_CLOSE_SELF_TERMINATING) {
        return marknote.constants.TOKENTYPE_SELF_TERMINATING;
    }
    if (this.markup.slice(c, c + 2) == marknote.constants.ENDTAG_OPEN) {
        return marknote.constants.TOKENTYPE_ENDTAG_OPEN;
    }
    if (ch == marknote.constants.EQUALS && isInTag) {
        return marknote.constants.TOKENTYPE_ATTRIBUTE;
    }
    if (ch == marknote.constants.TAG_OPEN) {
        return marknote.constants.TOKENTYPE_TAG_OPEN;
    }
    if (ch == marknote.constants.TAG_CLOSE && (isInTag || isInEndTag)) {
        return marknote.constants.TOKENTYPE_TAG_CLOSE;
    }
    if (ch == marknote.constants.SQUOTE && isInTag) {
        return marknote.constants.TOKENTYPE_QUOTE;
    }
    if (ch == marknote.constants.DQUOTE && isInTag) {
        if (beforeCh !== null || beforeCh != "\\") {
            return marknote.constants.TOKENTYPE_QUOTE;
        }
    }
    if (ch == marknote.constants.BRACKET_OPEN) {
        return marknote.constants.TOKENTYPE_BRACKET_OPEN;
    }
    return marknote.constants.TOKENTYPE_NORMAL;
};
marknote.Tokenizer.prototype.isQuote = function (ch) {
    return ch == marknote.constants.SQUOTE || ch == marknote.constants.DQUOTE;
};
marknote.Tokenizer.prototype.toString = function () {
    var tokens = this.tokens;
    var str = new String();
    for (var t = 0; t < tokens.length; t++) {
        if (t > 0) {
            str += ",";
        }
        str += tokens[t].content;
    }
    return str;
};
marknote.Tokenizer.prototype.tokenizeTagContent = function (tokens, c) {
    var isCDATA = false;
    var endMarker, token;
    for (var d = c + 1; d < this.markup.length; d++) {
        if (this.markup.slice(d, d + 9) == marknote.constants.CDATA_START) {
            isCDATA = true;
            break;
        } else {
            if (this.markup.charAt(d) == marknote.constants.TAG_OPEN) {
                break;
            }
        }
    }
    if (isCDATA) {
        token = new marknote.Token(marknote.constants.CDATA_START, d);
        tokens.push(token);
        token = new marknote.Token("", d + 9);
        token.isLiteral = true;
        endMarker = marknote.constants.CDATA_END;
        for (c = d + 9; c < this.markup.length; c++) {
            if (this.markup.slice(c, c + 3) == endMarker) {
                tokens.push(token);
                token = new marknote.Token(endMarker, c);
                tokens.push(token);
                c += 2;
                token = new marknote.Token("", c + 3);
                break;
            } else {
                token.content += this.markup.charAt(c);
            }
        }
    } else {
        token = new marknote.Token("", c + 1);
        token.isLiteral = true;
    }
    return {token:token, c:c};
};
marknote.Tokenizer.prototype.tokenize = function () {
    var tokens = new Array();
    this.tokens = tokens;
    var token = new marknote.Token();
    var isInTag = false, isInDocType = false, isTagText = false, isInEndTag = false;
    var endMarker, start, ch, chars;
    for (var c = 0; c < this.markup.length; c++) {
        var tokenType = this.determineTokenType(c, isInTag, isInEndTag);
        switch (tokenType) {
          case marknote.constants.TOKENTYPE_DOCTYPE_START:
            isInDocType = true;
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(marknote.constants.DOCTYPE_START, c);
            c += 8;
            break;
          case marknote.constants.TOKENTYPE_BRACKET_OPEN:
            if (isInDocType) {
                if (token.hasValue()) {
                    tokens.push(token);
                }
                token = new marknote.Token(this.markup.charAt(c), c);
                token.isLiteral = true;
                endMarker = marknote.constants.BRACKET_CLOSE;
                for (++c; c < this.markup.length; c++) {
                    token.content += this.markup.charAt(c);
                    if (this.markup.charAt(c) == endMarker) {
                        if (token.hasValue()) {
                            tokens.push(token);
                        }
                        token = new marknote.Token("", c + 1);
                        break;
                    }
                }
            } else {
                token.content += this.markup.charAt(c);
            }
            break;
          case marknote.constants.TOKENTYPE_PI_START:
            var piTokenType;
            var piTarget = "";
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(marknote.constants.PI_START, c);
            tokens.push(token);
            start = c + 2;
            isInTag = true;
            for (c = start; c < this.markup.length; c++) {
                piTokenType = this.determineTokenType(c, isInTag);
                if (piTokenType == marknote.constants.TOKENTYPE_PI_END) {
                    piTarget = this.markup.slice(start, c);
                    if (marknote.Util.isUndefinedNullOrBlank(piTarget)) {
                        piTarget = "xml";
                    }
                    token = new marknote.Token(piTarget, c);
                    tokens.push(token);
                    token = new marknote.Token(marknote.constants.PI_END, c);
                    tokens.push(token);
                    isInTag = false;
                    break;
                } else {
                    if (piTokenType == marknote.constants.TOKENTYPE_WHITESPACE) {
                        if (piTarget === "") {
                            piTarget = this.markup.slice(start, c);
                            if (marknote.Util.isUndefinedNullOrBlank(piTarget)) {
                                piTarget = "xml";
                            }
                            token = new marknote.Token(piTarget, c);
                            tokens.push(token);
                        }
                        break;
                    }
                }
            }
            token = new marknote.Token("", c);
            break;
          case marknote.constants.TOKENTYPE_PI_END:
            token = new marknote.Token(marknote.constants.PI_END, c);
            tokens.push(token);
            isInTag = false;
            c += 2;
            token = new marknote.Token("", c);
            break;
          case marknote.constants.TOKENTYPE_WHITESPACE:
            if (token.isLiteral) {
                token.content += this.markup.charAt(c);
                break;
            }
            for (++c; c < this.markup.length; c++) {
                if (marknote.Util.hasWhitespace(this.markup.charAt(c))) {
                    continue;
                } else {
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    tokenType = this.determineTokenType(c, isInTag);
                    if (tokenType == marknote.constants.TOKENTYPE_NORMAL) {
                        ch = this.markup.charAt(c);
                        token = new marknote.Token(ch, c);
                    } else {
                        c--;
                        token = new marknote.Token("", c + 1);
                    }
                    break;
                }
            }
            break;
          case marknote.constants.TOKENTYPE_SELF_TERMINATING:
          case marknote.constants.TOKENTYPE_ENDTAG_OPEN:
            isInTag = false;
            isInEndTag = true;
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(this.markup.slice(c, c + 2), c);
            if (token.hasValue()) {
                tokens.push(token);
            }
            c++;
            token = new marknote.Token("", c + 1);
            break;
          case marknote.constants.TOKENTYPE_TAG_CLOSE:
            isInTag = false;
            isInEndTag = false;
            isInDocType = false;
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(marknote.constants.TAG_CLOSE, c);
            tokens.push(token);
            var tagContentResult = this.tokenizeTagContent(tokens, c);
            token = tagContentResult.token;
            c = tagContentResult.c;
            break;
          case marknote.constants.TOKENTYPE_ATTRIBUTE:
          case marknote.constants.TOKENTYPE_TAG_OPEN:
            if (this.markup.charAt(c) == marknote.constants.TAG_OPEN) {
                isInTag = true;
            }
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(this.markup.charAt(c), c);
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token("", c + 1);
            break;
          case marknote.constants.TOKENTYPE_QUOTE:
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(this.markup.charAt(c), c);
            token.isLiteral = true;
            endMarker = this.markup.charAt(c);
            for (++c; c < this.markup.length; c++) {
                token.content += this.markup.charAt(c);
                if (this.markup.charAt(c) == endMarker) {
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new marknote.Token("", c + 1);
                    break;
                }
            }
            break;
          case marknote.constants.TOKENTYPE_COMMENT_START:
            if (token.hasValue()) {
                tokens.push(token);
            }
            token = new marknote.Token(marknote.constants.COMMENT_START, c);
            tokens.push(token);
            endMarker = marknote.constants.COMMENT_END;
            start = c + 4;
            for (c = start; c < this.markup.length; c++) {
                if (this.markup.slice(c, c + 3) == endMarker) {
                    chars = this.markup.slice(start, c);
                    token = new marknote.Token(chars, start);
                    token.isLiteral = true;
                    tokens.push(token);
                    token = new marknote.Token(endMarker, c);
                    tokens.push(token);
                    c = c + 2;
                    break;
                }
            }
            token = new marknote.Token("", c);
            break;
          default:
            token.content += this.markup.charAt(c);
            break;
        }
    }
    if (token.hasValue()) {
        tokens.push(token);
    }
    return tokens;
};
marknote.Util = new Object();
marknote.Util.hasWhitespace = function (str) {
    if (typeof str == "undefined" || str === null) {
        return false;
    }
    var strToTest = str + "";
    var whitespace = new RegExp(/^\s+$/);
    for (var c = 0; c < strToTest.length; c++) {
        var ch = strToTest.charAt(c);
        if (whitespace.test(ch)) {
            return true;
        }
    }
    return false;
};
marknote.Util.isUndefinedNullOrBlank = function (str) {
    return !marknote.Util.hasValue(str);
};
marknote.Util.isEmpty = marknote.Util.isUndefinedNullOrBlank;
marknote.Util.nothingToBlank = function (str) {
    return marknote.Util.isEmpty(str) ? "" : str;
};
marknote.Util.isAllWhitespace = function (str) {
    if (typeof (str) == "undefined" || str === null) {
        return false;
    }
    var strToTest = str + "";
    for (var c = 0; c < strToTest.length; c++) {
        var ch = strToTest.charAt(c);
        if (!marknote.Util.hasWhitespace(ch)) {
            return false;
        }
    }
    return true;
};
marknote.Util.hasValue = function (str) {
    if (typeof str == "undefined" || str === null) {
        return false;
    }
    var strToTest = str + "";
    return !(strToTest.length === 0 || marknote.Util.isAllWhitespace(strToTest));
};
marknote.Util.trim = function (str) {
    var originalStr = str + "";
    return originalStr.replace(/^\s+|\s+$/g, "");
};
marknote.Util.leftTrim = function (str) {
    var originalStr = str + "";
    return originalStr.replace(/^\s+/, "");
};
marknote.Util.rightTrim = function (str) {
    var originalStr = str + "";
    return originalStr.replace(/\s+$/, "");
};
marknote.Util.splitByWhitespace = function (str) {
    if (typeof str == "undefined" || str === null) {
        return str;
    }
    var originalStr = marknote.Util.trim(str) + "";
    return originalStr.split(/\s+/);
};
marknote.Util.removeArrayItem = function (array, index) {
    try {
        for (var i = 0; i < array.length; i++) {
            if (i == index) {
                array.splice(i, 1);
            }
        }
    }
    catch (err) {
    }
    return array;
};
marknote.Util.dataType = function (item) {
    return typeof item != "undefined" && item !== null && item.dataType && typeof item.dataType == "string" && item.dataType.length > 9 && item.dataType.slice(0, 9) == "marknote." ? item.dataType : typeof item;
};
marknote.Util.replaceAll = function (str, findStr, replaceStr) {
    var originalStr = str + "";
    var i = 0;
    var newStr = "";
    while (originalStr.indexOf(findStr, i) != -1) {
        newStr += originalStr.substring(i, originalStr.indexOf(findStr, i));
        newStr += replaceStr;
        i = (originalStr.indexOf(findStr, i) + findStr.length);
    }
    newStr += str.substring(i, str.length);
    return newStr;
};
marknote.Util.erefEncode = function (str) {
    var originalStr = str + "";
    return marknote.Util.erefTransform(originalStr, true);
};
marknote.Util.erefXMLEncode = function (str) {
    var originalStr = str + "";
    return marknote.Util.erefTransform(originalStr, true, true);
};
marknote.Util.erefDecode = function (str) {
    var originalStr = str + "";
    return marknote.Util.erefTransform(originalStr, false);
};
marknote.Util.erefXMLDecode = function (str) {
    var originalStr = str + "";
    return marknote.Util.erefTransform(originalStr, false, true);
};
marknote.Util.erefTransform = function (str, isEncoding, isXMLOnly) {
    var refs = isXMLOnly ? new marknote.XMLEntityRefs().getRefs() : new marknote.EntityRefs().getRefs();
    var outStr = new String();
    outStr += str;
    for (var i = 0; i < refs.length; i++) {
        var code = "&" + refs[i].name + ";";
        var ch = refs[i].character;
        var fromStr = isEncoding ? ch : code;
        var toStr = isEncoding ? code : ch;
        outStr = marknote.Util.replaceAll(outStr, fromStr, toStr);
    }
    return marknote.Util.replaceAll(outStr, "&quot;", "\"");
};
marknote.Writer = function () {
    this.dataType = marknote.constants.DATATYPE_WRITER;
    this.isSw8tXmlContent = false;
};
marknote.Writer.prototype.outputDocument = function (doc, indent) {
    var output = new String();
    var processingInstructions = doc.getProcessingInstructions();
    var docType = doc.getDOCTYPE();
    for (var p = 0; p < processingInstructions.length; p++) {
        if (p > 0) {
            output += "\n";
        }
        output += marknote.constants.PI_START;
        var pi = processingInstructions[p];
        output += pi.getTarget();
        var piAttributes = pi.getData();
        for (var a = 0; a < piAttributes.length; a++) {
            var attr = piAttributes[a];
            output += " " + attr.getName() + "=\"" + attr.getValue() + "\"";
        }
        output += " " + marknote.constants.PI_END;
    }
    if (docType) {
        output += "\n" + docType.toString();
    }
    var root = doc.getRootElement();
    output += this.outputElement(root, 0, indent);
    return output;
};
marknote.Writer.prototype.outputElement = function (elem, level, indent) {
    var output, childOutput, indentStr;
    output = "\n" + this.calculateIndent(level, indent) + marknote.constants.TAG_OPEN + elem.getName();
    for (var a = 0; a < elem.getAttributes().length; a++) {
        var attrib = elem.getAttributeAt(a);
        output += " " + attrib.getName() + marknote.constants.EQUALS + marknote.constants.DQUOTE + attrib.getValue(false) + marknote.constants.DQUOTE;
    }
    if (elem.isSelfTerminated || !elem.hasContents()) {
        output += " " + marknote.constants.TAG_CLOSE_SELF_TERMINATING;
        return output;
    }
    output += marknote.constants.TAG_CLOSE;
    if (level === 0) {
        level = 1;
    }
    childOutput = this.outputContents(elem, level, indent);
    indentStr = elem.contents.length == 1 && elem.getText().length > 0 && this.hasStrictText(elem) ? "" : this.calculateIndent(level, indent);
    var tagCloseOutput = indentStr + marknote.constants.ENDTAG_OPEN + elem.getName() + marknote.constants.TAG_CLOSE;
    return output + childOutput + tagCloseOutput;
};
marknote.Writer.prototype.hasStrictText = function (elem) {
    var hasPureText = true;
    for (var i = 0; i < elem.contents.length; i++) {
        var content = elem.getContentAt(i);
        var dataType = marknote.Util.dataType(content);
        if (dataType != marknote.constants.DATATYPE_TEXT) {
            return false;
        }
    }
    return hasPureText;
};
marknote.Writer.prototype.calculateIndent = function (level, indent) {
    if (level === 0) {
        return "";
    }
    var appliedIndent = "";
    indent = indent && marknote.Util.isAllWhitespace(indent) ? indent : "\t";
    for (var i = 1; i < level; i++) {
        appliedIndent += indent;
    }
    return appliedIndent;
};
marknote.Writer.prototype.outputContents = function (parentElem, level, indent) {
    var appliedIndent1 = this.calculateIndent(level + 1, indent);
    var appliedIndent2 = this.calculateIndent(level + 2, indent);
    var output = new String();
    var dataType = "";
    var t, text, textLines;
    for (var c = 0; c < parentElem.getContents().length; c++) {
        var content = parentElem.getContentAt(c);
        dataType = marknote.Util.dataType(content);
        switch (dataType) {
          case marknote.constants.DATATYPE_COMMENT:
            output += "\n" + appliedIndent1 + marknote.constants.COMMENT_START;
            text = content.getText();
            textLines = text.split("\n");
            for (t = 0; t < textLines.length; t++) {
                output += "\n" + appliedIndent2 + marknote.Util.leftTrim(textLines[t]);
            }
            output += "\n" + appliedIndent1 + marknote.constants.COMMENT_END;
            break;
          case marknote.constants.DATATYPE_ELEMENT:
            output += this.outputElement(content, level + 1, indent);
            break;
          case marknote.constants.DATATYPE_TEXT:
            output += content.getText(false);
            break;
          case marknote.constants.DATATYPE_CDATA:
            output += "\n" + appliedIndent1 + marknote.constants.CDATA_START + "\n" + appliedIndent2 + content.getText() + "\n" + appliedIndent1 + marknote.constants.CDATA_END;
            break;
        }
    }
    if (dataType != marknote.constants.DATATYPE_TEXT) {
        output += "\n";
    }
    return output;
};
