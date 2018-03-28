const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const fs = require('fs');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');

const mainConfig = {
    entry: [path.join(__dirname, 'main.ts'), path.join(__dirname, 'application.json')],
    output: {
        path: __dirname + '/app',
        filename: 'main.js'
    },
    context: __dirname,
    target: 'electron-main',
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    configFile: __dirname + '/tsconfig-main.json',
                    transpileOnly: true
                }
            },
            {test: path.join(__dirname, 'application.json'), loader: 'file-loader?name=package.json', type: 'javascript/auto'},
            {test: /\.(png|html)$/, loader: 'file-loader?name=[name].[ext]'}
        ]
    },
    node: {
        __dirname: false,
        __filename: false
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            workers: 2,
            async: false,
            tslint: path.join(__dirname, '../tslint.json'),
            tsconfig: './tsconfig-main.json'
        })
    ],
    resolve: {
        extensions: ['.ts', '.js']
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
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    preserveWhitespace: false,
                    cssSourceMap: false
                }
            },
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    appendTsSuffixTo: [/\.vue$/],
                    configFile: __dirname + '/tsconfig-renderer.json',
                    transpileOnly: true
                }
            },
            {test: /\.eot(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader'},
            {test: /\.(woff2?)$/, loader: 'file-loader'},
            {test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader'},
            {test: /\.svg(\?v=\d+\.\d+\.\d+)?$/, loader: 'file-loader'},
            {test: /\.(wav|mp3|ogg)$/, loader: 'file-loader?name=sounds/[name].[ext]'},
            {test: /\.(png|html)$/, loader: 'file-loader?name=[name].[ext]'}
        ]
    },
    node: {
        __dirname: false,
        __filename: false
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            workers: 2,
            async: false,
            tslint: path.join(__dirname, '../tslint.json'),
            tsconfig: './tsconfig-renderer.json',
            vue: true
        })
    ],
    resolve: {
        extensions: ['.ts', '.js', '.vue', '.css'],
        alias: {qs: 'querystring'}
    },
    optimization: {
        splitChunks: {chunks: 'all', minChunks: 2, name: 'common'}
    }
};

module.exports = function(mode) {
    const themesDir = path.join(__dirname, '../scss/themes/chat');
    const themes = fs.readdirSync(themesDir);
    const cssOptions = {use: ['css-loader', 'sass-loader']};
    for(const theme of themes) {
        if(!theme.endsWith('.scss')) continue;
        const absPath = path.join(themesDir, theme);
        rendererConfig.entry.chat.push(absPath);
        const plugin = new ExtractTextPlugin('themes/' + theme.slice(0, -5) + '.css');
        rendererConfig.plugins.push(plugin);
        rendererConfig.module.rules.push({test: absPath, use: plugin.extract(cssOptions)});
    }
    const faPath = path.join(themesDir, '../../fa.scss');
    rendererConfig.entry.chat.push(faPath);
    const faPlugin = new ExtractTextPlugin('./fa.css');
    rendererConfig.plugins.push(faPlugin);
    rendererConfig.module.rules.push({test: faPath, use: faPlugin.extract(cssOptions)});
    if(mode === 'production') {
        process.env.NODE_ENV = 'production';
        mainConfig.devtool = rendererConfig.devtool = 'source-map';
        rendererConfig.plugins.push(new OptimizeCssAssetsPlugin());
    } else {
        mainConfig.devtool = rendererConfig.devtool = 'none';
    }
    return [mainConfig, rendererConfig];
};