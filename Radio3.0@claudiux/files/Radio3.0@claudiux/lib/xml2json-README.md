# xml2json
This function acts as an XML to JSON converter. The function is extremely small and is in pure JavaScript, therefore it has no dependencies. 
The converter takes XML attributes into consideration. 
## Installation
```
Download and use the function directly in your code!

or

npm install xml2json-light
```
## Online Demo
Here's a [JSFiddle demo](https://jsfiddle.net/enkidootech/ogsousqd/29/)
## Usage
### Without XML attributes
```javascript
var parser = require('xml2json-light');
var xml = ‘<person><name>John Doe</name></person>’;
var json = parser.xml2json(xml); 

console.log(json); 
// prints ‘{"person": {"name": "John Doe"}}’
```
### With XML attributes
#### Single attribute
```javascript
var parser = require('xml2json-light');
var xml = ‘<person id="1234"><name>John Doe</name></person>’;
var json = parser.xml2json(xml); 

console.log(json); 
// prints ‘{“person”: {"id": "1234", "name": "John Doe"}}’
```
#### Multiple attributes
```javascript
var parser = require('xml2json-light');
var xml = ‘<person id="1234" age="30"><name>John Doe</name></person>’;
var json = parser.xml2json(xml); 

console.log(json); 
// prints ‘{“person”: {“id”: “1234”, “age”: “30”, “name”: “John Doe”}}’
```
### Special cases
#### Orphan values
```javascript
var parser = require('xml2json-light');
var xml = ‘<person id="1234">Something</person>’;

// The xml string is converted to : 
// <person><id>1234</id>Something</person>’
//
// This line now contains an orphan value
// the xml string is then converted to :
// ‘<person><id>1234</id><_@ttribute>Something</_@ttribute></person>’

var json = parser.xml2json(xml); 
console.log(json); 
// prints ‘{"person": {"id": "1234", "_@ttribute": "Something"}}’
```
#### Comments
```javascript
var parser = require('xml2json-light');
var xml = '<name> <!-- some comment --> Jane Doe </name>';

// The xml string is converted to : 
// <name> Jane Doe </name>
// All comments will be removed 

var json = parser.xml2json(xml); 
console.log(json); 
// prints ‘{"name": "Jane Doe"}’
```
## License
The MIT License (MIT)

Copyright (c) 2016 Société Enkidoo Technologies Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
