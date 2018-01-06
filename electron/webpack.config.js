const path = require('path');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const webpack = require('webpack');
const UglifyPlugin = require('uglifyjs-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const fs = require('fs');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const exportLoader = require('../export-loader');

const mainConfig = {
    entry: [path.join(__dirname, 'main.ts'), path.join(__dirname, 'application.json')],
    output: {
        path: __dirname + '/app',
        filename: 'main.js'
    },
    context: __dirname,
    target: 'electron-main',
    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    configFile: __dirname + '/tsconfig.json',
                    transpileOnly: true
                }
            },
            {test: /application.json$/, loader: 'file-loader?name=package.json'},
            {test: /\.(png|html)$/, loader: 'file-loader?name=[name].[ext]'}
        ]
    },
    node: {
        __dirname: false,
        __filename: false
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({workers: 2, async: false, tslint: path.join(__dirname, '../tslint.json')}),
        exportLoader.delayTypecheck
    ],
    resolve: {
        extensions: ['.ts', '.js']
    },
    resolveLoader: {
        modules: [
            'node_modules', path.join(__dirname, '../')
        ]
    }
}, rendererConfig = {
    entry: {
        chat: [path.join(__dirname, 'chat.ts'), path.join(__dirname, 'index.html')],
        window: [path.join(__dirname, 'window.ts'), path.join(__dirname, 'window.html')]
    },
    output: {
        path: __dirname + '/app',
        filename: '[name].js'
    },
    context: __dirname,
    target: 'electron-renderer',
    module: {
        loaders: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    preLoaders: {ts: 'export-loader'},
                    preserveWhitespace: false
                }
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    appendTsSuffixTo: [/\.vue$/],
                    configFile: __dirname + '/tsconfig.json',
                    transpileOnly: true
                }
            },
            {test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader'},
            {test: /\.(woff|woff2)$/, loader: 'url-loader?prefix=font/&limit=5000'},
            {test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=10000&mimetype=application/octet-stream'},
            {test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=10000&mimetype=image/svg+xml'},
            {test: /\.(wav|mp3|ogg)$/, loader: 'file-loader?name=sounds/[name].[ext]'},
            {test: /\.(png|html)$/, loader: 'file-loader?name=[name].[ext]'}
        ]
    },
    node: {
        __dirname: false,
        __filename: false
    },
    plugins: [
        new webpack.ProvidePlugin({
            '$': 'jquery/dist/jquery.slim.js',
            'jQuery': 'jquery/dist/jquery.slim.js',
            'window.jQuery': 'jquery/dist/jquery.slim.js'
        }),
        new ForkTsCheckerWebpackPlugin({workers: 2, async: false, tslint: path.join(__dirname, '../tslint.json')}),
        new CommonsChunkPlugin({name: 'common', minChunks: 2}),
        exportLoader.delayTypecheck
    ],
    resolve: {
        extensions: ['.ts', '.js', '.vue', '.css'],
        alias: {qs: path.join(__dirname, 'qs.ts')}
    },
    resolveLoader: {
        modules: [
            'node_modules', path.join(__dirname, '../')
        ]
    }
};

module.exports = function(env) {
    const dist = env === 'production';
    const themesDir = path.join(__dirname, '../less/themes/chat');
    const themes = fs.readdirSync(themesDir);
    const cssOptions = {use: [{loader: 'css-loader', options: {minimize: dist}}, 'less-loader']};
    for(const theme of themes) {
        if(!theme.endsWith('.less')) continue;
        const absPath = path.join(themesDir, theme);
        rendererConfig.entry.chat.push(absPath);
        const plugin = new ExtractTextPlugin('themes/' + theme.slice(0, -5) + '.css');
        rendererConfig.plugins.push(plugin);
        rendererConfig.module.loaders.push({test: absPath, use: plugin.extract(cssOptions)});
    }
    if(dist) {
        mainConfig.devtool = rendererConfig.devtool = 'source-map';
        const plugins = [new UglifyPlugin({sourceMap: true}),
            new webpack.DefinePlugin({'process.env.NODE_ENV': JSON.stringify('production')}),
            new webpack.LoaderOptionsPlugin({minimize: true})];
        mainConfig.plugins.push(...plugins);
        rendererConfig.plugins.push(...plugins);
    } else {
        //config.devtool = 'cheap-module-eval-source-map';
    }
    return [mainConfig, rendererConfig];
};