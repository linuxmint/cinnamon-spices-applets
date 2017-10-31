const Gio = imports.gi.Gio;

function HttpSocket(path) {
    this._init(path);
}

HttpSocket.prototype = {
    _HttpVersion: '1.1',

    _client: null,
    _addr: null,

    _init: function(path) {
        this._client = new Gio.SocketClient();
        this._addr = Gio.UnixSocketAddress.new(path);
    },

    _verbose: false,

    verbose: function(verbose) {
        if (verbose === undefined) {
            verbose = true;
        }
        this._verbose = !!verbose;
    },

    _method: '',
    _location: '',
    _getParameter: {},

    _postParameter: {},

    GET: function(location, get_parameter) {
        this._method = 'GET';
        this._location = location;
        if (get_parameter == undefined) {
            get_parameter = {};
        }
        this._getParameter = get_parameter;
        this._postParameter = {};
        return this._transact();
    },

    POST: function(location, post_parameter, get_parameter) {
        this._method = 'POST';
        this._location = location;
        if (post_parameter == undefined) {
            post_parameter = {};
        }
        this._postParameter = post_parameter;
        if (get_parameter == undefined) {
            get_parameter = {};
        }
        this._getParameter = get_parameter;
        return this._transact();
    },

    _transact: function() {
        this._generateRequest();
        let connection = this._client.connect(this._addr, null);
        this._sendRequest(connection.get_output_stream(null));
        this._parseResponse(connection.get_input_stream(null));
        connection.close(null);
        return [
            this._response.status,
            this._response.body
        ]
    },

    _request: {
        startLine: '',
        headers: {},
        body: null,
        head: null
    },

    _sendRequest: function(client_output) {
        let request = '';
        request += this._request.startLine;
        request += this._request.head;
        request += "\r\n";
        if (this._request.body !== null) {
            request += this._request.body;
        }
        if (this._verbose) {
            print("<<<<<");
            print(request);
            print("=====");
        }
        client_output.write(request, null);
    },

    _generateRequest: function() {
        this._generateStartLine();
        this._generateHead();
        this._generateBody();
    },

    _generateStartLine: function() {
        let query_string = '';
        for (let param_name in this._getParameter) {
            let parameter = this._getParameter[param_name];
            query_string += param_name + '=' + encodeURIComponent(parameter)
        }
        this._request.startLine = this._method + ' ' +
            this._location + (query_string.length > 0 ? '?': '') +
            query_string + ' ' +
            'HTTP/' + this._HttpVersion + "\r\n";
    },

    _generateHead: function () {
        let head = '';
        for (let field in this._request.headers) {
            let value = this._request.headers[field];
            head += field + ': ' + value + "\r\n";
        }
        this._request.head = head;
    },

    _generateBody: function() {
        let body = JSON.stringify(this._postParameter);
        if (body.length > 2) {
            this._request.headers['Content-Type'] = 'application/json';
            this._request.headers['Content-Length'] = body.length;
            this._generateHead();
            this._request.body = body;
        }
    },

    _response: {
        response: [],
        version: null,
        status: null,
        headers: {},
        body: '',
    },

    _parseResponse: function(client_input) {
        let input = Gio.DataInputStream.new(client_input);
        this._parseStartLine(input);
        this._parseHeader(input);
        // Cases of no body: see RFC7230 3.3.3 §2.1
        if ((this._response.status[0] != '1') &&
            (this._response.status != '204') &&
            (this._response.status[0] != '3')) {
            this._parseBody(input);
        }
        if (this._verbose) {
            print("=====");
            print(this._response.response.join("\n"));
            print(">>>>>");
        }
    },

    _parseStartLine: function(input) {
        input.set_newline_type(Gio.DataStreamNewlineType.CR_LF);
        let line;
        let length = 0;
        while (length == 0) {
            [line, length] = input.read_line(null);
        }
        this._response.response = [line];
        let [version, status_code, reason] = String(line).split(' ', 3);
        this._response.version = version;
        this._response.status = status_code;
    },

    _parseHeader: function(input) {
        let headers = {};
        let line;
        input.set_newline_type(Gio.DataStreamNewlineType.CR_LF);
        while (true) {
            [line, length] = input.read_line(null);
            this._response.response.push(line);
            if (length == 0) {
                break;
            }
            let [Field, value] = String(line).split(':');
            // I only save the lowercase field-name which is kinda lazy
            let field = Field.toLowerCase();

            // Exception for the Set-Cookie-Header, see RFC7230 3.2.2 §4
            if (field == 'set-cookie') {
                if (!(field in headers)) {
                    headers[field] = [value];
                } else {
                    headers[field].push(value);
                }
                continue;
            }
            headers[field] = value.trim();
        }
        this._response.headers = headers;
        return true;
    },

    _parseBody: function(input) {
        let body;
        if (('transfer-encoding' in this._response.headers) &&
            (this._response.headers['transfer-encoding'].substr(-7) == 'chunked')) {
            body = this._readChunks(input);
        } else if ('content-length' in this._response.headers) {
            body = this._readLength(input, this._response.headers['content-length']);
        } else {
            body = this._readUntilClosed(input);
        }
        body = String.fromCharCode.apply(null, body);
        this._response.response.push(body);
        this._response.body = body
    },

    _readChunks: function(input) {
        let chunks = [];
        while (true) {
            let length = parseInt(input.read_line(null), 16);
            if (length == 0) {
                break;
            }
            chunks.push(this._readLength(input, length));
        }
        return Array.concat.apply([], chunks);
    },

    _readLength: function(input, length) {
        let body = [];
        while (body.length < length) {
            body.push(input.read_byte(null));
        }
        return body;
    },

    _readUntilClosed: function(input) {
        let body = [];
        while (true) {
            let byte = input.read_byte(null);
            if (byte == null) {
                break;
            }
            body.push(byte);
        }
    }
};
