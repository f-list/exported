const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

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
        rules: [
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
                    preserveWhitespace: false
                }
            },
            {test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader'},
            {test: /\.(woff|woff2)$/, loader: 'url-loader?prefix=font/&limit=5000'},
            {test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=10000&mimetype=application/octet-stream'},
            {test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'url-loader?limit=10000&mimetype=image/svg+xml'},
            {test: /\.(wav|mp3|ogg)$/, loader: 'file-loader?name=sounds/[name].[ext]'},
            {test: /\.(png|html)$/, loader: 'file-loader?name=[name].[ext]'},
            {test: /\.scss/, use: ['css-loader', 'sass-loader']}
        ]
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({workers: 2, async: false, vue: true, tslint: path.join(__dirname, '../tslint.json')})
    ],
    resolve: {
        'extensions': ['.ts', '.js', '.vue', '.scss']
    }
};

module.exports = function(mode) {
    if(mode === 'production') {
        config.devtool = 'source-map';
    } else {
        config.devtool = 'none';
    }
    return config;
};