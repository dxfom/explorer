import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import analyze from 'rollup-plugin-analyzer'
import babel from 'rollup-plugin-babel'
import copy from 'rollup-plugin-copy'
import filesize from 'rollup-plugin-filesize'
import postcss from 'rollup-plugin-postcss'
import serve from 'rollup-plugin-serve'
import { terser } from 'rollup-plugin-terser'

const production = process.env.NODE_ENV === 'production'
const watching = process.env.ROLLUP_WATCH

export default {
  input: 'src/index.tsx',
  output: {
    file: `docs/es2019.js`,
    format: 'esm',
    sourcemap: !production,
  },
  plugins: [
    !watching && analyze({ summaryOnly: true, filter: module => module.size !== 0 }),
    !watching && filesize({ showBrotliSize: true }),
    copy({ targets: [{ src: ['src/index.html', 'src/favicon.png'], dest: 'docs/' }] }),
    resolve({ browser: true, extensions: ['.mjs', '.js', '.ts', '.tsx'] }),
    commonjs(),
    babel({
      presets: ['@babel/preset-typescript', 'babel-preset-solid'],
      extensions: ['.ts', '.tsx'],
    }),
    postcss({ extensions: ['.css'], extract: 'styles.css', minimize: true }),
    production && terser({ warnings: true, compress: { passes: 3 }, output: { comments: false } }),
    watching && serve({ contentBase: 'docs/', open: true }),
  ],
  watch: {
    clearScreen: false,
  },
}
