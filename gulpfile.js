var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var less = require('gulp-less');
var clean = require('gulp-clean');
var concat = require('gulp-concat');
var minifyCss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
// var jshint = require('gulp-jshint');
var babelify = require('babelify');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var source  = require('vinyl-source-stream');
var connect = require('gulp-connect');
var mocha = require('gulp-mocha');
var exec = require('child_process').exec;
var browserSync = require('browser-sync');
const pkg = require('./package.json');

var outDir = pkg.outDir + '/' + pkg.version;

gulp
	.task('less', () => {
		gulp.src('./less/**/*.less')
			.pipe(concat('grid.less'))
			.pipe(less())
			.pipe(sourcemaps.init())
			.pipe(clean())
			.pipe(rename({
				suffix: '.min'
			}))
			.pipe(sourcemaps.write('.'))
			.pipe(gulp.dest('./dist'))
			.pipe(browserSync.reload({ stream: true }));
	})

	.task('compile', () => {
		return browserify({
			entries: './src/core/GridView.js',
			standalone: 'sz.grid',
			debug: true
		})
		.bundle()
		.pipe(source('grid.es6.js'))
		.pipe(gulp.dest('./dist'))
		.pipe(browserSync.reload({ stream: true }));
	})

	.task('server', ['less', 'compile'], function() {
		browserSync.init({
			server: './'
		});

		gulp.watch('./less/**/*.less', ['less']);
		gulp.watch('./src/**/*.js', ['compile']);
		gulp.watch('./index.html').on('change', browserSync.reload);
	});


gulp.task('default', ['server']);