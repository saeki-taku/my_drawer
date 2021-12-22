const { src, dest, watch, series, parallel, lastRun } = require('gulp');

const loadPlugins = require('gulp-load-plugins');

const $ = loadPlugins();

const fs = require('fs');
const del = require('del');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const browserSync = require('browser-sync');
const dartSass = require('gulp-dart-sass');
const sassGlob = require('gulp-sass-glob-use-forward');
const pkg = require('./package.json');

const server = browserSync.create();
const conf = pkg['gulp-config'];
const sizes = conf.sizes;
const isProd = process.env.NODE_ENV === 'production';

function icon(done) {
  for (const size of sizes) {
    const width = size[0];
    const height = size[1];
    src('./src/images/favicon/favicon.png')
      .pipe(
        $.imageResize({
          width,
          height,
          crop: true,
          upscale: false,
        })
      )
      .pipe($.rename(`favicon-${width}x${height}.png`))
      .pipe(dest('./dist/images/favicon'));
  }
  done();
}

function compileEjs() {
  const data = JSON.parse(fs.readFileSync('./src/json/data.json'));
  return src(['./src/ejs/*.ejs'])
    .pipe($.plumber())
    .pipe($.ejs(data))
    .pipe($.replace(/^[\t]*n\n/gim, ''))
    .pipe($.rename({ extname: '.html' }))
    .pipe(dest('./dist'));
}

function styles() {
  return src(['./src/sass/*.scss', './src/sass/**/*.scss'], { sourcemaps: true })
    .pipe(sassGlob())
    .pipe(dartSass.sync().on('error', dartSass.logError))
    .pipe(
      dartSass({
        outputStyle: 'expanded',
      })
    )
    .pipe($.postcss([autoprefixer()]))
    .pipe($.if(!isProd, $.sourcemaps.write('.')))
    .pipe($.if(isProd, $.postcss([cssnano({ safe: true, autoprefixer: false })])))
    .pipe(dest('./dist/css'));
}

function scripts() {
  return src(['./src/js/*.js', './src/js/**/*.js'])
    .pipe($.if(!isProd, $.sourcemaps.init()))
    .pipe($.babel())
    .pipe($.if(!isProd, $.sourcemaps.write('.')))
    .pipe($.if(isProd, $.uglify()))
    .pipe(dest('./dist/js'));
}

function lint() {
  return src('./src/js/*.js')
    .pipe($.eslint({ fix: true }))
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError())
    .pipe(dest('./src/js'));
}

function optimizeImages() {
  return src('./src/images/**', { since: lastRun(optimizeImages) })
    .pipe($.imagemin())
    .pipe(dest('./dist/images'));
}

function clean() {
  return del(['./dist']);
}

function startAppServer() {
  server.init({
    server: {
      baseDir: './dist',
    },
  });

  watch('./src/sass/**/*.scss', styles);
  watch(['./src/js/*.js', './src/js/**/*.js'], scripts);
  watch('./src/images/**', optimizeImages);
  watch(['./src/ejs/index.ejs', './src/ejs/**/*.ejs'], compileEjs);
  watch(['./src/**/**/*.scss', './src/js/*.js', './src/js/**/*.js', './src/ejs/index.ejs', './src/ejs/**/*.ejs', './src/images/**']).on(
    'change',
    server.reload
  );
}

const build = series(clean, parallel(optimizeImages, compileEjs, styles, series(lint, scripts)));
const serve = series(build, startAppServer);

exports.icon = icon;
exports.styles = styles;
exports.scripts = scripts;
exports.build = build;
exports.lint = lint;
exports.serve = serve;
exports.default = serve;
