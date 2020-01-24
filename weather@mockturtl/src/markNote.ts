export {};

/*
   marknote-debug.js
   
   Unmimified copy of Marknote - for debugging with a tool such as Firebug.
   For production use, use the minified copy, js, instead.
   
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

    const constants = {DOCTYPE_START:"<!DOCTYPE", CDATA_START:"<![CDATA[", CDATA_END:"]]>", COMMENT_START:"<!--", COMMENT_END:"-->", TAG_OPEN:"<", TAG_CLOSE:">", TAG_CLOSE_SELF_TERMINATING:"/>", ENDTAG_OPEN:"</", EQUALS:"=", SQUOTE:"'", DQUOTE:"\"", PI_START:"<?", PI_END:"?>", BRACKET_OPEN:"[", BRACKET_CLOSE:"]", TOKENTYPE_BRACKET_OPEN:"bracketOpen", TOKENTYPE_TAG_OPEN:"tagOpen", TOKENTYPE_TAG_CLOSE:"tagClose", TOKENTYPE_ENDTAG_OPEN:"endTagOpen", TOKENTYPE_ENDTAG_CLOSE:"endTagClose", TOKENTYPE_SELF_TERMINATING:"closeTagSelfTerminating", TOKENTYPE_WHITESPACE:"whitespace", TOKENTYPE_ATTRIBUTE:"attribute", TOKENTYPE_QUOTE:"quote", TOKENTYPE_QUOTED:"quotedLiteral", TOKENTYPE_NORMAL:"normal", TOKENTYPE_COMMENT_START:"commentStart", TOKENTYPE_COMMENT_END:"commentEnd", TOKENTYPE_CDATA_START:"cdataStart", TOKENTYPE_CDATA_END:"cdataEnd", TOKENTYPE_PI_START:"piStart", TOKENTYPE_PI_END:"piEnd", TOKENTYPE_DOCTYPE_START:"docTypeStart", DATATYPE_ATTRIBUTE:"Attribute", DATATYPE_CDATA:"CDATA", DATATYPE_CLONER:"Cloner", DATATYPE_COMMENT:"Comment", DATATYPE_DOCTYPE:"DOCTYPE", DATATYPE_DOCUMENT:"Document", DATATYPE_ELEMENT:"Element", DATATYPE_ENTITYREF:"EntityRef", DATATYPE_XMLENTITYREFS:"XMLEntityRefs", DATATYPE_ENTITYREFS:"EntityRefs", DATATYPE_PARSER:"Parser", DATATYPE_PROCESSINGINSTRUCTION:"ProcessingInstruction", DATATYPE_QNAME:"QName", DATATYPE_TEXT:"Text", DATATYPE_TOKEN:"Token", DATATYPE_TOKENIZER:"Tokenizer", DATATYPE_WRITER:"Writer"};

    class Attribute {
        dataType: string;
        isSw8tXmlContent: boolean;
        name: any;
        value: any;
        Util: any;

        constructor(name: string, value: string) {
            this.dataType = constants.DATATYPE_ATTRIBUTE;
            this.isSw8tXmlContent = false;
            this.name = name;
            this.value = Util.erefEncode(Util.nothingToBlank(value));
        }

        getName(): string {
            return this.name;
        };

        setName(name: string): void {
            this.name = name;
        };

        getValue(flag?: boolean): string {
            return Util.erefDecode(Util.nothingToBlank(this.value));
        };

        setValue(value: string) {
            this.value = Util.erefEncode(Util.nothingToBlank(value));
        };

        toString = function () {
            return this.getName() + "=\"" + this.getValue() + "\"";
        };

        clone = function () {
            return new Attribute(this.getName(), this.getValue());
        };
    }

    class CDATA {
        dataType: any;
        isSw8tXmlContent: boolean;
        text: string;

        constructor(text: string) {
            this.dataType = constants.DATATYPE_CDATA;
            this.isSw8tXmlContent = true;
            this.text = Util.nothingToBlank(text);
        }

        getText(): string {
            return Util.nothingToBlank(this.text);
        };

        setText(text: string): void {
            this.text = Util.nothingToBlank(text);
        };

        toString(): string {
            return this.getText();
        };

        clone = function () {
            var cloner = new Cloner();
            return cloner.clone(this);
        };
    }
    
    class Cloner {
        dataType: any;
        isSw8tXmlContent: boolean;

        constructor() {
            this.dataType = constants.DATATYPE_CLONER;
            this.isSw8tXmlContent = false;
        }

        cloneDocument(doc: any): Document {
            var outDoc = new Document();
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

        cloneProcessingInstruction(pi: any): any{
            var data = pi.getData();
            var outTarget = pi.getTarget().slice(0);
            var outData = this.cloneArray(data);
            return new ProcessingInstruction(outTarget, outData);
        };

        cloneElement = function(elem: Element): Element {
            var outElem = new Element();
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

        cloneContents = function (elem: Element): any[] {
            var outContents = new Array();
            var outContent, dataType;
            for (var c = 0; c < elem.getContents().length; c++) {
                var content = elem.getContentAt(c);
                dataType = Util.dataType(content);
                switch (dataType) {
                  case constants.DATATYPE_ELEMENT:
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

        cloneArray(inArray: any[]): any[] {
            var outArray = new Array();
            var outObj;
            for (var i = 0; i < inArray.length; i++) {
                outObj = this.clone(inArray[i]);
                outArray.push(outObj);
            }
            return outArray;
        };

        clone(inObj: any): any {
            var isValidObj = (inObj.dataType && inObj.dataType.indexOf("") > 0) || typeof inObj == "object";
            if (!isValidObj) {
                return inObj;
            }
            var outObj: any = {};
            for (var i in inObj) {
                outObj[i] = this.clone(inObj[i]);
            }
            return outObj;
        };
    }

    class Comment {
        dataType: any;
        isSw8tXmlContent: boolean;
        text: string;

        constructor(text: string) {
            this.dataType = constants.DATATYPE_COMMENT;
            this.isSw8tXmlContent = true;
            this.text = Util.erefEncode(Util.nothingToBlank(text));
        }

        getText(): string {
            return Util.erefDecode(Util.nothingToBlank(this.text));
        };

        setText(text: string): void {
            this.text = Util.erefEncode(Util.nothingToBlank(text));
        };

        toString(): string {
            return this.getText();
        };

        clone(): Comment {
            var cloner = new Cloner();
            return cloner.clone(this);
        };
    }

    class FPI {
        registration: any;
        organization: any;
        publicTextClass: any;
        publicTextDescription: any;
        publicTextLanguage: any;

        constructor(registration: any, organization: any, publicTextClass: any, publicTextDescription: any, publicTextLanguage: any) {
            this.registration = registration;
            this.organization = organization;
            this.publicTextClass = publicTextClass;
            this.publicTextDescription = publicTextDescription;
            this.publicTextLanguage = publicTextLanguage;
        };

        toString(): string {
            return "\"" + this.getRegistration() + "//" + this.getOrganization() + "//" + this.getPublicTextClass() + " " + this.getPublicTextDescription() + "//" + this.getPublicTextLanguage() + "\"";
        };

        getRegistration(): any {
            return this.registration;
        };

        setRegistration(registration: any): void {
            this.registration = registration;
        };

        getOrganization(): any {
            return this.organization;
        };

        setOrganization(organization: any): void {
            this.organization = organization;
        };

        getPublicTextClass(): any {
            return this.publicTextClass;
        };

        setPublicTextClass(publicTextClass: any): void {
            this.publicTextClass = publicTextClass;
        };

        getPublicTextDescription(): any {
            return this.publicTextDescription;
        };

        setPublicTextDescription(publicTextDescription: any): void {
            this.publicTextDescription = publicTextDescription;
        };

        getPublicTextLanguage(): any {
            return this.publicTextLanguage;
        };

        setPublicTextLanguage(publicTextLanguage: any): void {
            this.publicTextLanguage = publicTextLanguage;
        };
    }

    class DOCTYPE {
        dataType: any;
        isSw8tXmlContent: boolean;
        topElement: any;
        availability: any;
        FPI: FPI;
        URL: any;
        internalSubset: any;

        constructor (topElement?: string, availability?: any, FPI?: FPI, URL?: any, internalSubset?: any) {
            this.dataType = constants.DATATYPE_DOCTYPE;
            this.isSw8tXmlContent = false;
            if (topElement && !availability) {
                var str = topElement;
                var parser = new Parser();
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

        toString(): string {
            var fpi = this.getAvailability() == "PUBLIC" && this.getFPI() ? " " + this.getFPI() : "";
            var url = this.getURL() ? " " + this.getURL() : "";
            var internalSubset = this.getInternalSubset() ? " " + this.getInternalSubset() : "";
            return "<!DOCTYPE " + this.getTopElement() + " " + this.getAvailability() + fpi + url + internalSubset + ">";
        };

        getTopElement(): any {
            return this.topElement;
        };

        setTopElement(topElement: any): void {
            this.topElement = topElement;
        };

        getAvailability(): any {
            return this.availability;
        };

        setAvailability(availability: any): void {
            this.availability = availability;
        };

        getFPI(): FPI {
            return this.FPI;
        };

        setFPI(FPI: any): void {
            this.FPI = FPI;
        };

        getURL(): any {
            return this.URL;
        };

        setURL(URL: any): void {
            var formattedURL = Util.trim(URL);
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

        getInternalSubset(): any {
            return this.internalSubset;
        };

        setInternalSubset(internalSubset: any) {
            this.dataType = constants.DATATYPE_DOCTYPE;
            this.internalSubset = internalSubset;
        };
    }

    class Document {
        dataType: any;
        isSw8tXmlContent: boolean;
        processingInstructions: any;
        rootElement: Element;
        contents: any[];
        DOCTYPE: DOCTYPE;
        baseURI: any;

        constructor() {
            this.dataType = constants.DATATYPE_DOCUMENT;
            this.isSw8tXmlContent = false;
            this.processingInstructions = new Array();
            this.rootElement = new Element();
            this.contents = new Array();
        };

        getProcessingInstructions(): any {
            return this.processingInstructions;
        };

        setProcessingInstructions(processingInstructions: any): void {
            this.processingInstructions = processingInstructions;
        };

        addProcessingInstruction(processingInstruction: any): void {
            this.processingInstructions.push(processingInstruction);
        };

        removeProcessingInstruction(target: any): void {
            for (var p = 0; p < this.processingInstructions.length; p++) {
                var currentTarget = this.processingInstructions[p].getTarget();
                if (currentTarget == target) {
                    Util.removeArrayItem(this.processingInstructions, p);
                }
            }
        };

        getRootElement(): Element {
            return this.rootElement;
        };

        setRootElement(element: Element): void {
            if (!(element instanceof Element)) {
                return;
            }
            this.rootElement = element;
        };

        getDOCTYPE(): any {
            return this.DOCTYPE;
        };

        setDOCTYPE(docType: DOCTYPE): void {
            this.DOCTYPE = docType;
        };

        getBaseURI(): any {
            return this.baseURI;
        };

        setBaseURI(baseURI: any): void {
            this.baseURI = baseURI;
        };

        toString(indent: string, filterDocType: any, filterComments: any, filterProcessingInstructions: any): string {
            var writer = new Writer();
            return writer.outputDocument(this, indent);
        };

        clone(): Document {
            var cloner = new Cloner();
            return cloner.cloneDocument(this);
        };
    }

    class Element {
        dataType: any;
        isSw8tXmlContent: boolean;
        contents: any[];
        attributes: any[];
        qname: QName;
        isSelfTerminated: boolean;
        clonedContents: any;

        constructor(name?: string | QName) {
            this.dataType = constants.DATATYPE_ELEMENT;
            this.isSw8tXmlContent = true;
            this.contents = new Array();
            this.attributes = new Array();
            this.qname = new QName();
            this.isSelfTerminated = false;
            if (name) {
                if (name instanceof QName) {
                    this.setQName(name);
                } else {
                    this.setName(name);
                }
            }
        };

        getName(): string {
            return this.qname.getName();
        };

        setName(name: string): void {
            this.qname.setName(name);
        };

        getQName(): QName {
            return this.qname;
        };

        setQName(qname: QName): void {
            this.qname = qname;
        };

        hasContents(): boolean {
            return this.contents && this.contents.length > 0;
        };

        getContents(): any[] {
            return this.contents;
        };

        getContentAt(index: number): any {
            return this.getContents()[index];
        };

        addContent(content: any): void {
            if (content && content.isSw8tXmlContent) {
                this.getContents().push(content);
            }
        };

        removeContent(index: number): void {
            Util.removeArrayItem(this.contents, index);
        };

        setContents(contents: any): void {
            this.contents = contents;
        };

        getText(decode?: boolean): string {
            var text = "";
            if (typeof decode == "undefined") {
                decode = true;
            }
            for (var i = 0; i < this.contents.length; i++) {
                var content = this.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType == constants.DATATYPE_TEXT) {
                    text += content.getText(decode);
                } else {
                    if (dataType == constants.DATATYPE_CDATA) {
                        text += content.getText();
                    }
                }
            }
            return text;
        };

        setText(text: string): void {
            var newContent = new Array();
            for (var i = 0; i < this.contents.length; i++) {
                var content = this.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType == constants.DATATYPE_COMMENT) {
                    newContent.push(content);
                }
            }
            this.contents = newContent;
            text = text ? "" + text : "";
            this.contents.push(new Text(text));
        };

        setCDATAText(text: any): void {
            var newContent = new Array();
            for (var i = 0; i < this.contents.length; i++) {
                var content = this.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType == constants.DATATYPE_COMMENT) {
                    newContent.push(content);
                }
            }
            this.contents = newContent;
            text = text ? "" + text : "";
            this.contents.push(new CDATA(text));
        };

        removeText(): void {
            for (var i = this.contents.length - 1; i >= 0; i--) {
                var content = this.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType == constants.DATATYPE_TEXT || dataType == constants.DATATYPE_CDATA) {
                    Util.removeArrayItem(this.contents, i);
                }
            }
        };

        getCommentText(): string {
            var text = "";
            for (var i = 0; i < this.contents.length; i++) {
                var content = this.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType == constants.DATATYPE_COMMENT) {
                    text += content.getText();
                }
            }
            return text;
        };

        setCommentText(text: string): void {
            this.removeComments();
            text = text ? "" + text : "";
            this.addContent(new Comment(text));
        };

        removeComments(): void {
            for (var i = this.contents.length - 1; i >= 0; i--) {
                var content = this.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType == constants.DATATYPE_COMMENT) {
                    Util.removeArrayItem(this.contents, i);
                }
            }
        };

        addChildElement(element: Element | string): void {
            var dataType = Util.dataType(element);
            if (!(dataType == constants.DATATYPE_ELEMENT)) {
                return;
            }
            this.getContents().push(element);
        };

        removeChildElements(elemName: Element | string): number {
            var total = 0;
            if (!elemName) {
                total = this.contents.length;
                this.contents = new Array();
                return total;
            }
            var compareName = (elemName  as Element).dataType == constants.DATATYPE_QNAME ? (elemName as Element).getName() : elemName;
            let cloner = new Cloner();
            var clonedContents = cloner.cloneArray(this.contents);
            for (var i = clonedContents.length - 1; i >= 0; i--) {
                var dataType = Util.dataType(clonedContents[i]);
                if (dataType != constants.DATATYPE_ELEMENT) {
                    continue;
                }
                if (this.clonedContents[i].getName() == compareName) {
                    Util.removeArrayItem(this.contents, i);
                    total++;
                }
            }
            return total;
        };

        getChildElements(elemName?: Element | string): Element[] {
            var compareName = null;
            var selectedElements = new Array();
            if (elemName) {
                compareName = (elemName as Element).dataType == constants.DATATYPE_QNAME ? (elemName as Element).getName() : elemName;
            }
            for (var i = 0; i < this.contents.length; i++) {
                var content = this.contents[i];
                var dataType = Util.dataType(content);
                if (dataType != constants.DATATYPE_ELEMENT) {
                    continue;
                }
                if (!!compareName) {
                    if (content.getName() == compareName) {
                        selectedElements.push(content);
                    }
                } else {
                    selectedElements.push(content);
                }
            }
            return selectedElements;
        };

        getChildElement = function (elemName: Element | string): Element {
            var compareName = (elemName as Element).dataType == constants.DATATYPE_QNAME ? (elemName as Element).getName() : elemName;
            if (compareName) {
                var elemContents = this.getContents();
                for (var c = 0; c < elemContents.length; c++) {
                    var elemContent = elemContents[c];
                    var dataType = Util.dataType(elemContent);
                    if (dataType == constants.DATATYPE_ELEMENT) {
                        var contentName = elemContent.getName();
                        if (contentName === compareName) {
                            return elemContent;
                        }
                    }
                }
            }
            return null;
        };

        removeChildElement(elemName: Element | string) {
            var compareName = (elemName as Element).dataType == constants.DATATYPE_QNAME ? (elemName as Element).getName() : elemName;
            if (compareName) {
                var elemContents = this.getContents();
                for (var c = 0; c < elemContents.length; c++) {
                    var elemContent = elemContents[c];
                    var dataType = Util.dataType(elemContent);
                    if (dataType == constants.DATATYPE_ELEMENT) {
                        var contentName = elemContent.getName();
                        if (contentName === compareName) {
                            Util.removeArrayItem(this.contents, c);
                            return;
                        }
                    }
                }
            }
        };

        getChildElementAt(index: number): Element {
            try {
                return this.getChildElements()[index];
            }
            catch (err) {
                return null;
            }
        };

        removeChildElementAt(index: number): void {
            var childElemIndex = -1;
            var isElement;
            for (var c = 0; c < this.contents.length; c++) {
                isElement = Util.dataType(this.contents[c]) == constants.DATATYPE_ELEMENT;
                if (isElement) {
                    childElemIndex++;
                    if (index == childElemIndex) {
                        Util.removeArrayItem(this.contents, c);
                        return;
                    }
                }
            }
        };

        getAttributes(): Attribute[] {
            return this.attributes;
        };

        setAttributes(attributes: Attribute[]) {
            this.attributes = attributes;
        };

        getAttribute(name: string): Attribute {
            for (var i = 0; i < this.getAttributes().length; i++) {
                var attribute = this.getAttributes()[i];
                if (attribute.getName() == name) {
                    return attribute;
                }
            }
            return null;
        };

        getAttributeValue(name: string): string {
            var attrib = this.getAttribute(name);
            return attrib ? attrib.getValue() : "";
        };

        getAttributeAt(index: number): Attribute {
            return this.getAttributes()[index];
        };

        setAttribute(name: string | Attribute, value: string): void {
            if (Util.dataType(name) == constants.DATATYPE_ATTRIBUTE) {
                this.putAttribute(name as Attribute);
            } else {
                for (var i = 0; i < this.getAttributes().length; i++) {
                    var attribute = this.getAttributes()[i];
                    if (attribute.getName() == name) {
                        attribute.setValue(value);
                        return;
                    }
                }
                this.putAttribute(new Attribute(name as string, value));
            }
        };

        putAttribute(attribute: Attribute): void {
            if (attribute && this.getAttribute(attribute.getName())) {
                this.removeAttribute(attribute.getName());
            }
            this.getAttributes().push(attribute);
        };

        removeAttribute(name: string): void {
            var newAttributes = new Array();
            for (var i = 0; i < this.getAttributes().length; i++) {
                var attribute = this.getAttributes()[i];
                if (attribute.getName() != name) {
                    newAttributes.push(attribute);
                }
            }
            this.setAttributes(newAttributes);
        };

        removeAllAttributes(): void {
            this.setAttributes(new Array());
        };

        toString(indent: string): string {
            var writer = new Writer();
            return writer.outputElement(this, 0, indent);
        };

        clone(): Element {
            var cloner = new Cloner();
            return cloner.cloneElement(this);
        };
    }

    class EntityRef {
        dataType: any;
        name: string;
        character: string;
        isSw8tXmlContent: boolean;
        
        constructor(name: string, character: string) {
            this.dataType = constants.DATATYPE_ENTITYREF;
            this.name = name;
            this.character = character;
        };

        /*getName(): string {
            return this.name;
        };

        setName(name: string): void {
            this.name = name;
        };*/

        getName(): string {
            return this.name;
        };

        setName(character: any): void {
            this.dataType = constants.DATATYPE_ENTITYREF;
            this.isSw8tXmlContent = false;
            this.character = character;
        };

        clone(): EntityRef {
            var cloner = new Cloner();
            return cloner.clone(this);
        };
    }

    class XMLEntityRefs {
        dataType: any;
        isSw8tXmlContent: boolean;
        refs: EntityRef[];

        constructor() {
            this.dataType = constants.DATATYPE_XMLENTITYREFS;
            this.isSw8tXmlContent = false;
            this.refs = new Array();
            this.pushRef("quot", 34);
            this.pushRef("amp", 38);
            this.pushRef("apos", 39);
            this.pushRef("lt", 60);
            this.pushRef("gt", 62);
        };

        getRefs = function () {
            return this.refs;
        };

        pushRef = function (name: string, charCode: number) {
            this.refs.push(new EntityRef(name, String.fromCharCode(charCode)));
        };
    }

    class EntityRefs {
        dataType: any;
        isSw8tXmlContent: boolean;
        refs: EntityRef[];


        constructor() {
            this.dataType = constants.DATATYPE_ENTITYREFS;
            this.isSw8tXmlContent = false;
            this.refs = new Array().concat(new XMLEntityRefs().getRefs());
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

        getRefs(): EntityRef[] {
            return this.refs;
        };

        pushRef = function (name: string, charCode: number): void {
            this.refs.push(new EntityRef(name, String.fromCharCode(charCode)));
        };
    }

    class Parser {
        dataType: any;
        isSw8tXmlContent: boolean;
        doc: Document;
        status: number;
        statusMessage: string;
        xhr: any;
        xhrStatus: number;
        xhrStatusText: string;
        xhrResponseText: string;

        constructor() {
            this.dataType = constants.DATATYPE_PARSER;
            this.isSw8tXmlContent = false;
            this.doc = new Document();
            this.status = 0;
            this.statusMessage = "success";
            this.xhr = null;
            this.xhrStatus = null;
            this.xhrStatusText = null;
            this.xhrResponseText = null;
        };

        getDocument(): Document {
            return this.doc;
        };

        getXHR(): any {
            return this.xhr;
        };

        getXHRStatus(): number {
            return this.xhrStatus;
        };

        getXHRStatusText(): string {
            return this.xhrStatusText;
        };

        getXHRResponseText(): string {
            return this.xhrResponseText;
        };

        getStatus(): number {
            return this.status;
        };

        setStatus(status: number): void {
            this.status = status;
        };

        getStatusMessage(): string {
            return this.statusMessage;
        };

        setStatusMessage(statusMessage: string): void {
            this.statusMessage = statusMessage;
        };

        /*parseProcessingInstructions(str: string, doc: Document) {
            var tokenizer = new Tokenizer(str);
            var tokens = tokenizer.tokenize();
            var startPosition = 0, endPosition = 0;
            var isInPI = false;
            var pi, target, data, attr, name, value, tokenType;
            for (var t = 0; t < tokens.length; t++) {
                tokenType = tokens[t].getType();
                switch (tokenType) {
                  case constants.TOKENTYPE_PI_START:
                    startPosition = tokens[t].getPosition();
                    target = "";
                    data = new Array();
                    isInPI = true;
                    target = tokens[t + 1].getContent();
                    t++;
                    break;
                  case constants.TOKENTYPE_PI_END:
                    if (isInPI) {
                        if (Util.isUndefinedNullOrBlank(target)) {
                            target = "xml";
                        }
                    }
                    isInPI = false;
                    endPosition = tokens[t].getPosition() + 2;
                    pi = new ProcessingInstruction(target, data);
                    doc.addProcessingInstruction(pi);
                    break;
                  case constants.TOKENTYPE_ATTRIBUTE:
                    if (isInPI) {
                        name = tokens[t - 1].getContent();
                        value = tokens[t + 1].getContent();
                        value = value.slice(1, value.length - 1);
                        attr = new Attribute(name, value);
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
                return Util.trim(str1 + str2);
            } else {
                return str;
            }
        };*/

        parseProcessingInstructions(str: string, doc: Document) {
            var tokenizer = new Tokenizer(str);
            var tokens = tokenizer.tokenize();
            var startPosition = 0, endPosition = 0;
            var isInPI = false;
            var pi, target, data, attr, name, value, tokenType;
            for (var t = 0; t < tokens.length; t++) {
                tokenType = tokens[t].getType();
                switch (tokenType) {
                  case constants.TOKENTYPE_PI_START:
                    startPosition = tokens[t].getPosition();
                    target = "";
                    data = new Array();
                    isInPI = true;
                    target = tokens[t + 1].getContent();
                    t++;
                    break;
                  case constants.TOKENTYPE_PI_END:
                    if (isInPI) {
                        if (Util.isUndefinedNullOrBlank(target)) {
                            target = "xml";
                        }
                    }
                    isInPI = false;
                    endPosition = tokens[t].getPosition() + 2;
                    pi = new ProcessingInstruction(target, data);
                    doc.addProcessingInstruction(pi);
                    break;
                  case constants.TOKENTYPE_ATTRIBUTE:
                    if (isInPI) {
                        name = tokens[t - 1].getContent();
                        value = tokens[t + 1].getContent();
                        value = value.slice(1, value.length - 1);
                        attr = new Attribute(name, value);
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
                return Util.trim(str1 + str2);
            } else {
                return str;
            }
        };

        parseDOCTYPE(str: string, doc?: Document) {
            var tokenizer = new Tokenizer(str);
            var tokens = tokenizer.tokenize();
            var docType = new DOCTYPE();
            var tokenType, availability;
            try {
                for (var t = 0; t < tokens.length; t++) {
                    tokenType = tokens[t].getType();
                    switch (tokenType) {
                      case constants.TOKENTYPE_DOCTYPE_START:
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
                      case constants.TOKENTYPE_TAG_CLOSE:
                        return docType;
                      default:
                        break;
                    }
                }
            }
            catch (err) {
                global.log(err);
            }
            return docType;
        };

        parse(str: string): Document {
            this.xhr = null;
            this.xhrStatus = null;
            this.xhrStatusText = null;
            this.xhrResponseText = null;
            this.doc = new Document();
            this.setStatus(0);
            str = this.parseProcessingInstructions(str, this.doc);
            this.parseDOCTYPE(str, this.doc);
            this.parseElement(str, this.doc);
            return this.doc;
        };

        /*parseURL(url: string, params: any, method: any): Document {
            var sjax = new SJAX();
            var doc = sjax.read(url, params, method);
            this.xhr = sjax.getRequest();
            this.xhrStatus = sjax.getStatus();
            this.xhrStatusText = sjax.getStatusText();
            this.xhrResponseText = sjax.getResponseText();
            return doc;
        };*/

        parseComment(parentElem: Element, tokens: any, t: any): any {
            var text = tokens[t + 1].content == constants.COMMENT_START ? "" : tokens[t + 1].content;
            var comment = new Comment(text);
            if (parentElem) {
                parentElem.addContent(comment);
            }
            t = tokens[t + 1].content == constants.COMMENT_START ? t + 1 : t + 2;
            return t;
        };

        parseElement(markup: any, doc: Document, parentElem?: Element) {
            var tokenizer = new Tokenizer(markup);
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
                var elem = new Element(tokens[tokenPosition + 1].content);
                if (!parentElem) {
                    doc.setRootElement(elem);
                } else {
                    parentElem.addContent(elem);
                }
                for (t = tokenPosition + 1; t < tokens.length; t++) {
                    switch (tokens[t].getType()) {
                      case constants.TOKENTYPE_SELF_TERMINATING:
                        elem.isSelfTerminated = true;
                        tokenPosition = t;
                        break;
                      case constants.TOKENTYPE_TAG_CLOSE:
                        elem.isSelfTerminated = false;
                        tokenPosition = t;
                        break;
                      case constants.TOKENTYPE_ATTRIBUTE:
                        try {
                            var attribName = tokens[t - 1].content;
                            var valueToken = tokens[t + 1].content;
                            var attribValue = valueToken.slice(1, valueToken.length - 1);
                            var attrib = new Attribute(attribName, attribValue);
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
                if (!(tokenPosition == t)) {
                    return;
                }
                switch (tokens[tokenPosition].content) {
                  case constants.TAG_CLOSE_SELF_TERMINATING:
                    isCommentNext = tokens[tokenPosition + 1] && tokens[tokenPosition + 1].content == constants.COMMENT_START;
                    if (isCommentNext) {
                        endTokenPosition = tokenPosition + 1;
                        while (isCommentNext) {
                            endTokenPosition = this.parseComment(parentElem, tokens, endTokenPosition);
                            isCommentNext = tokens[endTokenPosition + 1] && tokens[endTokenPosition + 1].content == constants.COMMENT_START;
                            if (isCommentNext) {
                                endTokenPosition++;
                            }
                        }
                    } else {
                        endTokenPosition = tokenPosition;
                    }
                    break;
                  case constants.TAG_CLOSE:
                    if (tokens[tokenPosition + 1]) {
                        if (tokens[tokenPosition + 1].isCDATAStart()) {
                            var cdataContent = tokens[t + 2].content;
                            var cdataEnd = t + 3;
                            if (tokens[t + 2].isCDATAEnd()) {
                                cdataContent = "";
                                cdataEnd = t + 2;
                            }
                            var cdata = new CDATA(cdataContent);
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
                        var isEndOfElementFound = tokens[t].getContent() == constants.ENDTAG_OPEN && tokens[t + 1].getContent() == elem.getName() ? true : false;
                        if (isEndOfElementFound) {
                            endTokenPosition = t;
                            isCommentNext = tokens[endTokenPosition + 3] && tokens[endTokenPosition + 3].content == constants.COMMENT_START;
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
    }

    class ProcessingInstruction {
        dataType: any;
        isSw8tXmlContent: boolean;
        target: string;
        data: Attribute[]


        constructor(target: string, data: any) {
            this.dataType = constants.DATATYPE_PROCESSINGINSTRUCTION;
            this.isSw8tXmlContent = false;
            this.target = target ? target : "xml";
            if (target && !data) {
                this.data = new Array();
            } else {
                if (!data) {
                    this.data = [new Attribute("version", "1.0"), new Attribute("encoding", "UTF-8")];
                } else {
                    this.data = data;
                }
            }
        };

        getData(): Attribute[] {
            return this.data;
        };

        setData(data: Attribute[]) {
            this.data = data;
        };

        getTarget(): string {
            return this.target;
        };

        setTarget(target: string): void {
            this.target = target;
        };

        setAttribute(attribute: Attribute): void {
            var data = this.getData();
            if (Util.dataType(attribute) == constants.DATATYPE_ATTRIBUTE) {
                for (var a = 0; a < data.length; a++) {
                    if (data[a].getName() == attribute.getName()) {
                        data[a].setValue(attribute.getValue());
                        return;
                    }
                }
            }
        };

        getAttributeValue(attributeName: string): Attribute {
            var data = this.getData();
            for (var a = 0; a < data.length; a++) {
                if (data[a].getName() == attributeName) {
                    return data[a];
                }
            }
            return null;
        };

        setAttributeValue(attributeName: string, value: string): void {
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
                data.push(new Attribute(attributeName, value));
            }
        };

        clone(): ProcessingInstruction {
            var cloner = new Cloner();
            return cloner.cloneProcessingInstruction(this);
        };
    }

    class QName {
        dataType: string;
        isSw8tXmlContent: boolean;
        prefix: any;
        localPart: any;

        constructor(prefix?: any, localPart?: any) {
            this.dataType = constants.DATATYPE_QNAME;
            this.isSw8tXmlContent = false;
            this.prefix = Util.nothingToBlank(prefix);
            this.localPart = Util.nothingToBlank(localPart);
        };

        getName(): string {
            var output = "";
            if (Util.hasValue(this.prefix)) {
                output += this.prefix + ":";
            }
            if (Util.hasValue(this.localPart)) {
                output += this.localPart;
            }
            return output;
        };

        setName(name: string): void {
            var normalizedName = Util.nothingToBlank(name);
            var nameParts = normalizedName.split(":");
            if (nameParts.length > 1) {
                this.prefix = nameParts[0];
                this.localPart = nameParts[1];
            } else {
                this.prefix = "";
                this.localPart = normalizedName;
            }
        };

        getPrefix(): any {
            return Util.nothingToBlank(this.prefix);
        };

        setPrefix(prefix: any): void {
            this.prefix = Util.nothingToBlank(prefix);
        };

        getLocalPart(): any {
            return Util.nothingToBlank(this.localPart);
        };

        setLocalPart(localPart: any): void {
            this.localPart = Util.nothingToBlank(localPart);
        };

        toString(): string {
            return this.getName();
        };

        clone(): QName {
            var cloner = new Cloner();
            return cloner.clone(this);
        };
    }

    class Text {
        dataType: string;
        isSw8tXmlContent: boolean;
        text: string;


        constructor(text: string) {
            this.dataType = constants.DATATYPE_TEXT;
            this.isSw8tXmlContent = true;
            this.text = Util.erefEncode(Util.nothingToBlank(text));
        };

        getText(decodeStr?: string): string {
            let decode = false;
            if (Util.isEmpty(decodeStr)) {
                decode = true;
            }
            var normalizedText = Util.nothingToBlank(this.text);
            return decode ? Util.erefDecode(normalizedText) : normalizedText;
        };

        setText(text: string): void {
            this.text = Util.erefEncode(Util.nothingToBlank(text));
        };

        toString(): string {
            return this.getText();
        };

        clone(): Text {
            var cloner = new Cloner();
            return cloner.clone(this);
        };
    }

    class Token {
        dataType: string;
        isSwt8XmlContent: boolean;
        content: any;
        isLiteral: boolean;
        position: number;


        constructor(content?: string, position?: number) {
            this.dataType = constants.DATATYPE_TOKEN;
            this.isSwt8XmlContent = false;
            this.content = typeof (content) == "undefined" ? new String() : content;
            this.isLiteral = false;
            this.position = position ? position : 0;
        };

        getContent(): string {
            return this.content;
        };

        setContent = function (content: string): void {
            this.content = content;
        };

        getPosition(): number {
            return this.position;
        };

        setPosition(position: number): void {
            this.position = position;
        };

        hasValue(): boolean {
            try {
                return Util.hasValue(this.content);
            }
            catch (err) {
                return false;
            }
        };

        isDOCTYPEStart(): boolean {
            return this.content == constants.DOCTYPE_START;
        };

        isPIStart(): boolean {
            return this.content == constants.PI_START;
        };

        isPIEnd(): boolean {
            return this.content == constants.PI_END;
        };

        isSelfTerminating(): boolean {
            return this.content == constants.TAG_CLOSE_SELF_TERMINATING;
        };

        isEndTag(): boolean {
            return this.content == constants.ENDTAG_OPEN;
        };

        isCommentStart(): boolean {
            return this.content == constants.COMMENT_START;
        };

        isCommentEnd(): boolean {
            return this.content == constants.COMMENT_END;
        };

        isAttribute(): boolean {
            return this.content == constants.EQUALS;
        };

        isCDATAStart(): boolean {
            return this.content == constants.CDATA_START;
        };

        isCDATAEnd(): boolean {
            return this.content == constants.CDATA_END;
        };

        isTagOpen(): boolean {
            return this.content == constants.TAG_OPEN;
        };

        isTagClose(): boolean {
            return this.content == constants.TAG_CLOSE;
        };

        isQuote(): boolean {
            return this.content == constants.SQUOTE || this.content == constants.DQUOTE;
        };

        isQuoted(): boolean {
            return this.content.charAt(0) == "\"" && this.content.charAt(this.content.length - 1) == "\"";
        };

        getType(): string {
            if (this.isAttribute()) {
                return constants.TOKENTYPE_ATTRIBUTE;
            }
            if (this.isDOCTYPEStart()) {
                return constants.TOKENTYPE_DOCTYPE_START;
            }
            if (this.isPIStart()) {
                return constants.TOKENTYPE_PI_START;
            }
            if (this.isPIEnd()) {
                return constants.TOKENTYPE_PI_END;
            }
            if (this.isSelfTerminating()) {
                return constants.TOKENTYPE_SELF_TERMINATING;
            }
            if (this.isEndTag()) {
                return constants.TOKENTYPE_ENDTAG_OPEN;
            }
            if (this.isCDATAStart()) {
                return constants.TOKENTYPE_CDATA_START;
            }
            if (this.isCDATAEnd()) {
                return constants.TOKENTYPE_CDATA_END;
            }
            if (this.isTagOpen()) {
                return constants.TOKENTYPE_TAG_OPEN;
            }
            if (this.isTagClose()) {
                return constants.TOKENTYPE_TAG_CLOSE;
            }
            if (this.isQuote()) {
                return constants.TOKENTYPE_QUOTE;
            }
            if (this.isQuoted()) {
                return constants.TOKENTYPE_QUOTED;
            }
            if (this.isCommentStart()) {
                return constants.TOKENTYPE_COMMENT_START;
            }
            if (this.isCommentEnd()) {
                return constants.TOKENTYPE_COMMENT_END;
            }
            return constants.TOKENTYPE_NORMAL;
        };


    }

    class Tokenizer {
        dataType: string;
        isSw8tXmlContent: boolean;
        tokens: Token[];
        markup: string;

        constructor(markup: string) {
            this.dataType = constants.DATATYPE_TOKENIZER;
            this.isSw8tXmlContent = false;
            this.setMarkup(markup);
            this.tokens = new Array();
        };

        getMarkup(): string {
            return this.markup;
        };

        setMarkup(markup: string): void {
            this.markup = markup ? markup : "";
        };

        determineTokenType(c: number, isInTag?: boolean, isInEndTag?: boolean) {
            var ch = this.markup.charAt(c);
            var beforeCh = c > 0 ? this.markup.charAt(c - 1) : null;
            if (Util.hasWhitespace(ch)) {
                return constants.TOKENTYPE_WHITESPACE;
            }
            if (this.markup.slice(c, c + 9) == constants.DOCTYPE_START) {
                return constants.TOKENTYPE_DOCTYPE_START;
            }
            if (this.markup.slice(c, c + 9) == constants.CDATA_START) {
                return constants.TOKENTYPE_CDATA_START;
            }
            if (this.markup.slice(c, c + 4) == constants.COMMENT_START) {
                return constants.TOKENTYPE_COMMENT_START;
            }
            if (this.markup.slice(c, c + 3) == constants.CDATA_END) {
                return constants.TOKENTYPE_CDATA_END;
            }
            if (this.markup.slice(c, c + 2) == constants.PI_START) {
                return constants.TOKENTYPE_PI_START;
            }
            if (this.markup.slice(c, c + 2) == constants.PI_END) {
                return constants.TOKENTYPE_PI_END;
            }
            if (this.markup.slice(c, c + 2) == constants.TAG_CLOSE_SELF_TERMINATING) {
                return constants.TOKENTYPE_SELF_TERMINATING;
            }
            if (this.markup.slice(c, c + 2) == constants.ENDTAG_OPEN) {
                return constants.TOKENTYPE_ENDTAG_OPEN;
            }
            if (ch == constants.EQUALS && isInTag) {
                return constants.TOKENTYPE_ATTRIBUTE;
            }
            if (ch == constants.TAG_OPEN) {
                return constants.TOKENTYPE_TAG_OPEN;
            }
            if (ch == constants.TAG_CLOSE && (isInTag || isInEndTag)) {
                return constants.TOKENTYPE_TAG_CLOSE;
            }
            if (ch == constants.SQUOTE && isInTag) {
                return constants.TOKENTYPE_QUOTE;
            }
            if (ch == constants.DQUOTE && isInTag) {
                if (beforeCh !== null || beforeCh != "\\") {
                    return constants.TOKENTYPE_QUOTE;
                }
            }
            if (ch == constants.BRACKET_OPEN) {
                return constants.TOKENTYPE_BRACKET_OPEN;
            }
            return constants.TOKENTYPE_NORMAL;
        };

        isQuote(ch: string): boolean {
            return ch == constants.SQUOTE || ch == constants.DQUOTE;
        };

        toString(): String {
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

        tokenizeTagContent(tokens: Token[], c: number): any {
            var isCDATA = false;
            var endMarker, token;
            for (var d = c + 1; d < this.markup.length; d++) {
                if (this.markup.slice(d, d + 9) == constants.CDATA_START) {
                    isCDATA = true;
                    break;
                } else {
                    if (this.markup.charAt(d) == constants.TAG_OPEN) {
                        break;
                    }
                }
            }
            if (isCDATA) {
                token = new Token(constants.CDATA_START, d);
                tokens.push(token);
                token = new Token("", d + 9);
                token.isLiteral = true;
                endMarker = constants.CDATA_END;
                for (c = d + 9; c < this.markup.length; c++) {
                    if (this.markup.slice(c, c + 3) == endMarker) {
                        tokens.push(token);
                        token = new Token(endMarker, c);
                        tokens.push(token);
                        c += 2;
                        token = new Token("", c + 3);
                        break;
                    } else {
                        token.content += this.markup.charAt(c);
                    }
                }
            } else {
                token = new Token("", c + 1);
                token.isLiteral = true;
            }
            return {token:token, c:c};
        };

        tokenize(): Token[] {
            var tokens = new Array();
            this.tokens = tokens;
            var token = new Token();
            var isInTag = false, isInDocType = false, isTagText = false, isInEndTag = false;
            var endMarker, start, ch, chars;
            for (var c = 0; c < this.markup.length; c++) {
                var tokenType = this.determineTokenType(c, isInTag, isInEndTag);
                switch (tokenType) {
                  case constants.TOKENTYPE_DOCTYPE_START:
                    isInDocType = true;
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(constants.DOCTYPE_START, c);
                    c += 8;
                    break;
                  case constants.TOKENTYPE_BRACKET_OPEN:
                    if (isInDocType) {
                        if (token.hasValue()) {
                            tokens.push(token);
                        }
                        token = new Token(this.markup.charAt(c), c);
                        token.isLiteral = true;
                        endMarker = constants.BRACKET_CLOSE;
                        for (++c; c < this.markup.length; c++) {
                            token.content += this.markup.charAt(c);
                            if (this.markup.charAt(c) == endMarker) {
                                if (token.hasValue()) {
                                    tokens.push(token);
                                }
                                token = new Token("", c + 1);
                                break;
                            }
                        }
                    } else {
                        token.content += this.markup.charAt(c);
                    }
                    break;
                  case constants.TOKENTYPE_PI_START:
                    var piTokenType;
                    var piTarget = "";
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(constants.PI_START, c);
                    tokens.push(token);
                    start = c + 2;
                    isInTag = true;
                    for (c = start; c < this.markup.length; c++) {
                        piTokenType = this.determineTokenType(c, isInTag);
                        if (piTokenType == constants.TOKENTYPE_PI_END) {
                            piTarget = this.markup.slice(start, c);
                            if (Util.isUndefinedNullOrBlank(piTarget)) {
                                piTarget = "xml";
                            }
                            token = new Token(piTarget, c);
                            tokens.push(token);
                            token = new Token(constants.PI_END, c);
                            tokens.push(token);
                            isInTag = false;
                            break;
                        } else {
                            if (piTokenType == constants.TOKENTYPE_WHITESPACE) {
                                if (piTarget === "") {
                                    piTarget = this.markup.slice(start, c);
                                    if (Util.isUndefinedNullOrBlank(piTarget)) {
                                        piTarget = "xml";
                                    }
                                    token = new Token(piTarget, c);
                                    tokens.push(token);
                                }
                                break;
                            }
                        }
                    }
                    token = new Token("", c);
                    break;
                  case constants.TOKENTYPE_PI_END:
                    token = new Token(constants.PI_END, c);
                    tokens.push(token);
                    isInTag = false;
                    c += 2;
                    token = new Token("", c);
                    break;
                  case constants.TOKENTYPE_WHITESPACE:
                    if (token.isLiteral) {
                        token.content += this.markup.charAt(c);
                        break;
                    }
                    for (++c; c < this.markup.length; c++) {
                        if (Util.hasWhitespace(this.markup.charAt(c))) {
                            continue;
                        } else {
                            if (token.hasValue()) {
                                tokens.push(token);
                            }
                            tokenType = this.determineTokenType(c, isInTag);
                            if (tokenType == constants.TOKENTYPE_NORMAL) {
                                ch = this.markup.charAt(c);
                                token = new Token(ch, c);
                            } else {
                                c--;
                                token = new Token("", c + 1);
                            }
                            break;
                        }
                    }
                    break;
                  case constants.TOKENTYPE_SELF_TERMINATING:
                  case constants.TOKENTYPE_ENDTAG_OPEN:
                    isInTag = false;
                    isInEndTag = true;
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(this.markup.slice(c, c + 2), c);
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    c++;
                    token = new Token("", c + 1);
                    break;
                  case constants.TOKENTYPE_TAG_CLOSE:
                    isInTag = false;
                    isInEndTag = false;
                    isInDocType = false;
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(constants.TAG_CLOSE, c);
                    tokens.push(token);
                    var tagContentResult = this.tokenizeTagContent(tokens, c);
                    token = tagContentResult.token;
                    c = tagContentResult.c;
                    break;
                  case constants.TOKENTYPE_ATTRIBUTE:
                  case constants.TOKENTYPE_TAG_OPEN:
                    if (this.markup.charAt(c) == constants.TAG_OPEN) {
                        isInTag = true;
                    }
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(this.markup.charAt(c), c);
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token("", c + 1);
                    break;
                  case constants.TOKENTYPE_QUOTE:
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(this.markup.charAt(c), c);
                    token.isLiteral = true;
                    endMarker = this.markup.charAt(c);
                    for (++c; c < this.markup.length; c++) {
                        token.content += this.markup.charAt(c);
                        if (this.markup.charAt(c) == endMarker) {
                            if (token.hasValue()) {
                                tokens.push(token);
                            }
                            token = new Token("", c + 1);
                            break;
                        }
                    }
                    break;
                  case constants.TOKENTYPE_COMMENT_START:
                    if (token.hasValue()) {
                        tokens.push(token);
                    }
                    token = new Token(constants.COMMENT_START, c);
                    tokens.push(token);
                    endMarker = constants.COMMENT_END;
                    start = c + 4;
                    for (c = start; c < this.markup.length; c++) {
                        if (this.markup.slice(c, c + 3) == endMarker) {
                            chars = this.markup.slice(start, c);
                            token = new Token(chars, start);
                            token.isLiteral = true;
                            tokens.push(token);
                            token = new Token(endMarker, c);
                            tokens.push(token);
                            c = c + 2;
                            break;
                        }
                    }
                    token = new Token("", c);
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
    }

    class Util {
        static hasWhitespace(str: string) {
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

        static isUndefinedNullOrBlank(str: string): boolean {
            return !Util.hasValue(str);
        };

        static isEmpty = Util.isUndefinedNullOrBlank;

        static nothingToBlank(str: string): string {
            return Util.isEmpty(str) ? "" : str;
        };

        static isAllWhitespace(str: string): boolean {
            if (typeof (str) == "undefined" || str === null) {
                return false;
            }
            var strToTest = str + "";
            for (var c = 0; c < strToTest.length; c++) {
                var ch = strToTest.charAt(c);
                if (!Util.hasWhitespace(ch)) {
                    return false;
                }
            }
            return true;
        };

        static hasValue(str: string): boolean {
            if (typeof str == "undefined" || str === null) {
                return false;
            }
            var strToTest = str + "";
            return !(strToTest.length === 0 || Util.isAllWhitespace(strToTest));
        };

        static trim(str: string): string {
            var originalStr = str + "";
            return originalStr.replace(/^\s+|\s+$/g, "");
        };

        static leftTrim(str: string): string {
            var originalStr = str + "";
            return originalStr.replace(/^\s+/, "");
        };

        static rightTrim(str: string): string {
            var originalStr = str + "";
            return originalStr.replace(/\s+$/, "");
        };

        static splitByWhitespace(str: string): string[] | string {
            if (typeof str == "undefined" || str === null) {
                return str;
            }
            var originalStr = Util.trim(str) + "";
            return originalStr.split(/\s+/);
        };

        static removeArrayItem(array: any[], index: number): any[] {
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

        static dataType(item: any): any {
            return typeof item != "undefined" && item !== null && item.dataType && typeof item.dataType == "string" && item.dataType.length > 9 && item.dataType.slice(0, 9) == "" ? item.dataType : typeof item;
        };

        static replaceAll(str: string, findStr: string, replaceStr: string): string {
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

        static erefEncode(str: string): string {
            var originalStr = str + "";
            return Util.erefTransform(originalStr, true);
        };

        static erefXMLEncode(str: string): string {
            var originalStr = str + "";
            return Util.erefTransform(originalStr, true, true);
        };

        static erefDecode(str: string): string {
            var originalStr = str + "";
            return Util.erefTransform(originalStr, false);
        };

        static erefXMLDecode(str: string): string {
            var originalStr = str + "";
            return Util.erefTransform(originalStr, false, true);
        };

        static erefTransform(str: string, isEncoding: boolean, isXMLOnly?: boolean): string {
            var refs = isXMLOnly ? new XMLEntityRefs().getRefs() : new EntityRefs().getRefs();
            var outStr = "";
            outStr += str;
            for (var i = 0; i < refs.length; i++) {
                var code = "&" + refs[i].name + ";";
                var ch = refs[i].character;
                var fromStr = isEncoding ? ch : code;
                var toStr = isEncoding ? code : ch;
                outStr = Util.replaceAll(outStr, fromStr, toStr);
            }
            return Util.replaceAll(outStr, "&quot;", "\"");
        };
    }

    class Writer {
        dataType: string;
        isSw8tXmlContent: boolean;

        constructor() {
            this.dataType = constants.DATATYPE_WRITER;
            this.isSw8tXmlContent = false;
        };

        outputDocument(doc: Document, indent: string): string {
            var output = "";
            var processingInstructions = doc.getProcessingInstructions();
            var docType = doc.getDOCTYPE();
            for (var p = 0; p < processingInstructions.length; p++) {
                if (p > 0) {
                    output += "\n";
                }
                output += constants.PI_START;
                var pi = processingInstructions[p];
                output += pi.getTarget();
                var piAttributes = pi.getData();
                for (var a = 0; a < piAttributes.length; a++) {
                    var attr = piAttributes[a];
                    output += " " + attr.getName() + "=\"" + attr.getValue() + "\"";
                }
                output += " " + constants.PI_END;
            }
            if (docType) {
                output += "\n" + docType.toString();
            }
            var root = doc.getRootElement();
            output += this.outputElement(root, 0, indent);
            return output;
        };

        outputElement(elem: Element, level: number, indent: string): string {
            var output, childOutput, indentStr;
            output = "\n" + this.calculateIndent(level, indent) + constants.TAG_OPEN + elem.getName();
            for (var a = 0; a < elem.getAttributes().length; a++) {
                var attrib = elem.getAttributeAt(a);
                output += " " + attrib.getName() + constants.EQUALS + constants.DQUOTE + attrib.getValue(false) + constants.DQUOTE;
            }
            if (elem.isSelfTerminated || !elem.hasContents()) {
                output += " " + constants.TAG_CLOSE_SELF_TERMINATING;
                return output;
            }
            output += constants.TAG_CLOSE;
            if (level === 0) {
                level = 1;
            }
            childOutput = this.outputContents(elem, level, indent);
            indentStr = elem.contents.length == 1 && elem.getText().length > 0 && this.hasStrictText(elem) ? "" : this.calculateIndent(level, indent);
            var tagCloseOutput = indentStr + constants.ENDTAG_OPEN + elem.getName() + constants.TAG_CLOSE;
            return output + childOutput + tagCloseOutput;
        };

        hasStrictText(elem: Element): boolean {
            var hasPureText = true;
            for (var i = 0; i < elem.contents.length; i++) {
                var content = elem.getContentAt(i);
                var dataType = Util.dataType(content);
                if (dataType != constants.DATATYPE_TEXT) {
                    return false;
                }
            }
            return hasPureText;
        };

        calculateIndent(level: number, indent: string): string {
            if (level === 0) {
                return "";
            }
            var appliedIndent = "";
            indent = indent && Util.isAllWhitespace(indent) ? indent : "\t";
            for (var i = 1; i < level; i++) {
                appliedIndent += indent;
            }
            return appliedIndent;
        };

        outputContents(parentElem: Element, level: number, indent: string): string {
            var appliedIndent1 = this.calculateIndent(level + 1, indent);
            var appliedIndent2 = this.calculateIndent(level + 2, indent);
            var output = "";
            var dataType = "";
            var t, text, textLines;
            for (var c = 0; c < parentElem.getContents().length; c++) {
                var content = parentElem.getContentAt(c);
                dataType = Util.dataType(content);
                switch (dataType) {
                  case constants.DATATYPE_COMMENT:
                    output += "\n" + appliedIndent1 + constants.COMMENT_START;
                    text = content.getText();
                    textLines = text.split("\n");
                    for (t = 0; t < textLines.length; t++) {
                        output += "\n" + appliedIndent2 + Util.leftTrim(textLines[t]);
                    }
                    output += "\n" + appliedIndent1 + constants.COMMENT_END;
                    break;
                  case constants.DATATYPE_ELEMENT:
                    output += this.outputElement(content, level + 1, indent);
                    break;
                  case constants.DATATYPE_TEXT:
                    output += content.getText(false);
                    break;
                  case constants.DATATYPE_CDATA:
                    output += "\n" + appliedIndent1 + constants.CDATA_START + "\n" + appliedIndent2 + content.getText() + "\n" + appliedIndent1 + constants.CDATA_END;
                    break;
                }
            }
            if (dataType != constants.DATATYPE_TEXT) {
                output += "\n";
            }
            return output;
        };
    }
 
