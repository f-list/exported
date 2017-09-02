const fs = require('fs');
module.exports = function(source) {
    fs.writeFileSync(this.resourcePath + '.ts', source);
    return source;
};

module.exports.delayTypecheck = function() {
    let callback;
    this.plugin('fork-ts-checker-service-before-start', (c) => callback = c);
    this.plugin('after-compile', (compilation, c) => {
        if(compilation.compiler.parentCompilation) return c();
        callback();
        c();
    });
};