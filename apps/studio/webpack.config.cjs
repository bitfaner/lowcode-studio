const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const root = __dirname;

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: path.resolve(root, 'src/index.ts'),
    output: {
      path: path.resolve(root, 'dist'),
      filename: 'js/index.js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      // 源码使用 ESM 风格的 .js 后缀，webpack 需映射回 .ts
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
      },
      alias: {
        '@lc/schema': path.resolve(root, '../../packages/schema/src/index.ts'),
        '@lc/shared': path.resolve(root, '../../packages/shared/src/index.ts'),
        '@lc/page-runtime': path.resolve(root, '../../packages/page-runtime/src/index.ts'),
        '@lc/materials': path.resolve(root, '../../packages/materials/src/index.ts'),
        '@lc/materials-react': path.resolve(root, '../../packages/materials-react/src/index.ts'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.resolve(root, 'tsconfig.json'),
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              // lowcode-plugin-components-pane 等旧插件按 CommonJS 对象读取 CSS Modules 类名映射
              options: { esModule: false },
            },
          ],
        },
        {
          test: /\.s[ac]ss$/i,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                esModule: false,
                modules: {
                  auto: /\.module\.\w+$/i,
                  exportLocalsConvention: 'as-is',
                },
                importLoaders: 1,
              },
            },
            'sass-loader',
          ],
        },
        {
          test: /\.(svg|png|jpe?g|gif|webp|woff2?|ttf|eot)$/i,
          type: 'asset/resource',
        },
      ],
    },
    // 关键：全站共享 window 上的同一份 React / 引擎实例
    externalsType: 'window',
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
      'react-dom/client': 'ReactDOM',
      antd: 'antd',
      '@alilc/lowcode-engine': 'AliLowCodeEngine',
      '@alilc/lowcode-engine-ext': '___AliLowCodeEngineExt___',
      '@alifd/next': 'Next',
      lodash: '_',
      moment: 'moment',
      'prop-types': 'PropTypes',
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(root, 'index.html'),
        inject: 'body',
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: path.resolve(root, 'public'), to: path.resolve(root, 'dist') }],
      }),
    ],
    devServer: {
      port: 5173,
      hot: true,
      historyApiFallback: true,
      static: {
        directory: path.resolve(root, 'public'),
        publicPath: '/',
      },
      client: {
        overlay: { errors: true, warnings: false },
      },
      // 本地开发把 /api 转发到 Fastify 服务（pnpm dev:server）
      proxy: [
        {
          context: ['/api'],
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      ],
    },
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    performance: { hints: false },
    stats: 'minimal',
  };
};
