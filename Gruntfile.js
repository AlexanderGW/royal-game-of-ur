module.exports = function(grunt) {
	const sass = require('node-sass');

	grunt.initConfig ({

		sass: {
			options: {
				implementation: sass,
				sourceMap: true
			},
			dist: {
				files: {
					'src/ur.css' : 'src/ur.scss'
				}
			}
		},

		watch: {
			source: {
				files: ['src/ur.scss'],
				tasks: ['sass'],
				options: {
					livereload: true
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-sass');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.registerTask('default', ['watch','sass']);
};