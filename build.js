import windiCssPlugin from '@luncheon/esbuild-plugin-windicss'
import esbuild from 'esbuild'
import babel from 'esbuild-plugin-babel'
import pipe from 'esbuild-plugin-pipe'
import fs from 'node:fs'

fs.mkdirSync('docs', { recursive: true })
fs.copyFileSync('src/index.html', 'docs/index.html')
fs.copyFileSync('src/favicon.png', 'docs/favicon.png')
fs.copyFileSync('src/manifest.webmanifest', 'docs/manifest.webmanifest')

const windiCss = windiCssPlugin({ filter: /^$/, windiCssConfig: { prefixer: false } })

/**
 * @satisfies esbuild.BuildOptions
 */
const options = {
  entryPoints: ['src/index.tsx'],
  outdir: 'docs',
  bundle: true,
  minify: true,
  format: 'esm',
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
  esbuild
    .context(options)
    .then(ctx => ctx.serve({ servedir: options.outdir }))
    .then(console.log('http://localhost:8000'))
} else {
  esbuild.build(options)
}
