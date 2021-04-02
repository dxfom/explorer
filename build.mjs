import windiCssPlugin from '@luncheon/esbuild-plugin-windicss'
import esbuild from 'esbuild'
import babel from 'esbuild-plugin-babel'
import pipe from 'esbuild-plugin-pipe'
import fs from 'fs'

fs.mkdirSync('docs', { recursive: true })
fs.copyFileSync('src/index.html', 'docs/index.html')
fs.copyFileSync('src/favicon.png', 'docs/favicon.png')

const windiCss = windiCssPlugin({ filter: /^$/, windiCssConfig: { prefixer: false } })

const options = {
  entryPoints: ['src/index.tsx'],
  outdir: 'docs',
  resolveExtensions: ['.mjs', '.js', '.ts', '.tsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  logLevel: 'info',
  plugins: [
    pipe({
      filter: /\.tsx$/,
      plugins: [
        windiCss,
        babel({
          config: { presets: ['@babel/preset-typescript', 'babel-preset-solid'] },
        }),
      ],
    }),
    windiCss,
  ],
}

if (process.argv.includes('--serve')) {
  esbuild.serve({ servedir: 'docs' }, options).then(console.log('http://localhost:8000'))
} else {
  esbuild.build(options)
}
