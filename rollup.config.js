import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import copy from 'rollup-plugin-copy'
import { eslint } from 'rollup-plugin-eslint'
import babel from 'rollup-plugin-babel'
import { terser } from 'rollup-plugin-terser'
import filesize from 'rollup-plugin-filesize'
import postcss from 'rollup-plugin-postcss'
import analyze from 'rollup-plugin-analyzer'
import serve from 'rollup-plugin-serve'

const production = process.env.NODE_ENV === 'production'
const watching = process.env.ROLLUP_WATCH

const typecheck = () => {
  const originalPlugin = typescript()
  const transform = originalPlugin.transform
  return Object.assign(originalPlugin, {
    transform(...args) {
      transform.apply(this, args)
      // ignore result
    }
  })
}

export default [
  {
    input: 'src/index.ts',
    output: {
      file: `docs/es2019.js`,
      format: 'esm',
      sourcemap: !production,
    },
    plugins: [
      !watching && analyze({ summaryOnly: true, filter: module => module.size !== 0 }),
      !watching && filesize({ showBrotliSize: true }),
      copy({ targets: [{ src: ['src/index.html', 'src/favicon.png'], dest: 'docs/' }] }),
      resolve({ browser: true }),
      commonjs(),
      eslint({ include: ['src/**/*.ts'] }),
      typecheck(),
      babel({
        presets: ['@babel/preset-typescript'],
        plugins: [
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-class-properties',
          [
            'babel-plugin-template-html-minifier',
            {
              modules: { 'lit-html': ['html'] },
              htmlMinifier: {
                caseSensitive: true,
                collapseInlineTagWhitespace: true,
                collapseWhitespace: true,
                removeAttributeQuotes: true,
              },
            },
          ],
        ],
        extensions: ['.ts', '.mjs'],
      }),
      postcss({ extensions: ['.css'], extract: 'styles.css', minimize: true }),
      production && terser({ warnings: true, compress: { passes: 3 }, output: { comments: false } }),
      watching && serve({ contentBase: 'docs/', open: true }),
    ],
  },
  {
    input: `docs/es2019.js`,
    output: {
      file: `docs/es5.js`,
      format: 'iife',
      sourcemap: !production,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      babel({
        exclude: [/\/core-js\//],
        presets: [
          [
            '@babel/preset-env',
            {
              targets: { ie: 11 },
              corejs: 3,
              useBuiltIns: 'usage',
            },
          ],
        ],
      }),
      production && terser({ warnings: true, compress: { passes: 3 } }),
      !watching && filesize(),
    ],
    watch: {
      clearScreen: false,
    },
  },
]
