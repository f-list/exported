var key = 0;
var handlers = {};

function sendMessage(handler, type, data) {
    return new Promise(function(resolve, reject) {
        data._id = 'm' + key++;
        data._type = type;
        window.webkit.messageHandlers[handler].postMessage(data);
        handlers[data._id] = {resolve: resolve, reject: reject};
    });
}

window.nativeMessage = function(key, data) {
    handlers[key].resolve(data);
    delete handlers[key];
};

window.nativeError = function(key, error) {
    handlers[key].reject(error);
    delete handlers[key];
};

window.NativeFile = {
    read: function(name) {
        return sendMessage('File', 'read', {name: name});
    },
    write: function(name, data) {
        return sendMessage('File', 'write', {name: name, data: data});
    },
    listDirectories: function(name) {
        return sendMessage('File', 'listDirectories', {name: name});
    },
    listFiles: function(name) {
        return sendMessage('File', 'listFiles', {name: name});
    },
    getSize: function(name) {
        return sendMessage('File', 'getSize', {name: name});
    },
    ensureDirectory: function(name) {
        return sendMessage('File', 'ensureDirectory', {name: name});
    }
};

window.NativeNotification = {
    notify: function(notify, title, text, icon, sound, data) {
        return sendMessage('Notification', 'notify', {notify: notify, title: title, text: text, icon: icon, sound: sound, data: data});
    },
    requestPermission: function() {
        return sendMessage('Notification', 'requestPermission', {});
    }
};

window.NativeBackground = {
    start: function() {
        return sendMessage('Background', 'start', {});
    },
    stop: function(name) {
        return sendMessage('Background', 'stop', {});
    }
};

window.NativeLogs = {
    init: function(character) {
        return sendMessage('Logs', 'init', {character: character});
    },
    logMessage: function(key, c, time, type, sender, message) {
        return sendMessage('Logs', 'logMessage', {key: key, conversation: c, time: time, type: type, sender: sender, message: message});
    },
    getBacklog: function(key) {
        return sendMessage('Logs', 'getBacklog', {key: key});
    },
    getLogs: function(character, key, date) {
        return sendMessage('Logs', 'getLogs', {character: character, key: key, date: date});
    },
    loadIndex: function(character) {
        return sendMessage('Logs', 'loadIndex', {character: character});
    },
    getCharacters: function() {
        return sendMessage('Logs', 'getCharacters', {});
    },
    repair: function(character) {
        return sendMessage('Logs', 'repair', {character: character});
    }
};