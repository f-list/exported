var key = 0;
var handlers = {};

function sendMessage(handler, type, data) {
    return new Promise(function(resolve, reject) {
        data._id = "m" + key++;
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
    readFile: function(name, start, length) {
        return sendMessage('File', 'readFile', {name: name, start: start, length: length});
    },
    writeFile: function(name, data) {
        return sendMessage('File', 'writeFile', {name: name, data: data});
    },
    append: function(name, data) {
        return sendMessage('File', 'append', {name: name, data: data});
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
    notify: function(title, text, icon, data) {
        return sendMessage('Notification', 'notify', {title: title, text: text, icon: icon, data: data});
    },
    requestPermission: function() {
        return sendMessage('Notification', 'requestPermission', {});
    }
};

window.NativeView = {
    setTheme: function(theme) {
        return sendMessage('View', 'setTheme', {theme: theme})
    }
};
