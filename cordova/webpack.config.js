const path = require('path');
const webpack = require('webpack');
const UglifyPlugin = require('uglifyjs-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const exportLoader = require('../export-loader');

const config = {
    entry: {
        chat: [__dirname + '/chat.ts', __dirname + '/index.html']
    },
    output: {
        path: __dirname + '/www',
        filename: '[name].js'
    },
    context: __dirname,
    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    appendTsSuffixTo: [/\.vue$/],
                    configFile: __dirname + '/tsconfig.json',
                    transpileOnly: true
                }
            },
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    preLoaders: {ts: 'export-loader'},
                    preserveWhitespace: false
                }
            },
            {test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader'},
            {test: /\.(woff|woff2)$/, loader: 'url-loader?prefix=font/&limit=5000'},
            {test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=10000&mimetype=application/octet-stream'},
            {test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=10000&mimetype=image/svg+xml'},
            {test: /\.(wav|mp3|ogg)$/, loader: 'file-loader?name=sounds/[name].[ext]'},
            {test: /\.(png|html)$/, loader: 'file-loader?name=[name].[ext]'},
            {test: /\.less/, use: ['css-loader', 'less-loader']}
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            '$': 'jquery/dist/jquery.slim.js',
            'jQuery': 'jquery/dist/jquery.slim.js',
            'window.jQuery': 'jquery/dist/jquery.slim.js'
        }),
        new ForkTsCheckerWebpackPlugin({workers: 2, async: false, tslint: path.join(__dirname, '../tslint.json')}),
        exportLoader.delayTypecheck
    ],
    resolve: {
        'extensions': ['.ts', '.js', '.vue', '.css']
    },
    resolveLoader: {
        modules: [
            'node_modules', path.join(__dirname, '../')
        ]
    }
};

module.exports = function(env) {
    const dist = env === 'production';
    config.plugins.push(new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(dist ? 'production' : 'development')
    }));
    if(dist) {
        config.devtool = 'source-map';
        config.plugins.push(new UglifyPlugin({sourceMap: true}));
    }
    return config;
};