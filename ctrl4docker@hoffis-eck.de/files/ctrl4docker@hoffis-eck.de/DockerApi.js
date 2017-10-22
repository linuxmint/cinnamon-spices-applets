const HttpSocket = imports.HttpSocket;

function DockerApi() {
    this._init();
}

DockerApi.prototype = {
    _httpSocket: null,

    _init: function () {
        this._httpSocket = new HttpSocket.HttpSocket('/var/run/docker.sock');
    },

    verbose: function() {
        this._httpSocket.verbose.apply(this._httpSocket, arguments);
    },

    _lastCode: null,
    _lastMessage: null,

    getLastResult: function() {
        return [this._lastCode, this._lastMessage];
    },

    listContainers: function(parameter) {
        let [code, result] = this._httpSocket.GET('/containers/json', parameter);
        if (code == 200) {
            return JSON.parse(result);
        }
        return [];
    },

    runContainer: function(parameter) {
        let id = this.createContainer(parameter);
        if (id == null) {
            return false;
        }
        return this.startContainer(id);
    },

    createContainer: function(parameter) {
        let getParameters = undefined;
        if ('name' in parameter) {
            getParameters = {'name': parameter['name']};
            delete parameter['name'];
        }
        [this._lastCode, this._lastMessage] = this._httpSocket.POST('/containers/create', parameter, getParameters);
        if (this._lastCode != 201) {
            return false;
        }
        return JSON.parse(this._lastMessage).Id;
    },

    startContainer: function(id) {
        [this._lastCode, this._lastMessage] = this._httpSocket.POST('/containers/' + id + '/start');
        if (this._lastCode != 204) {
            return false;
        }
        return id;
    },

    stopContainer: function(id) {
        [this._lastCode, this._lastMessage] = this._httpSocket.POST('/containers/' + id + '/stop');
        if (this._lastCode != 204) {
            return false;
        }
        return id;
    },

    renameContainer: function(id, name) {
        [this._lastCode, this._lastMessage] = this._httpSocket.POST('/containers/' + id + '/rename', {}, {'name': name});
        if (this._lastCode != 204) {
            return false;
        }
        return id;
    },

    inspectContainer: function(id) {
        [this._lastCode, this._lastMessage] = this._httpSocket.GET('/containers/' + id + '/json');
        if (this._lastCode == 200) {
            return JSON.parse(this._lastMessage);
        }
        return {};
    }
};

function isImage(image) {
    return function (container) {
        return container.Image == image;
    }
}

function isName(name) {
    return function (container) {
        return container.Names.indexOf('/' + name) != -1;
    }
}
