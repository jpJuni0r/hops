/**
 * @file plugin/index
 *
 * @author Daniel Dembach <daniel@dmbch.net>
 * @author Gregor Adams <greg@pixelass.com>
 */

var fs = require('fs');
var path = require('path');

var ejs = require('ejs');

var helpers = require('../config/helpers');

var renderer = require('./renderer');

/** @ignore */
function getAssetPaths(assets, ext) {
  return Object.keys(assets).filter(function (key) {
    if (key.indexOf(ext) === (key.length - ext.length)) {
      return !key.match(/^((chunk-)|(.+hot-update)).+$/);
    }
    return false;
  });
}

/** @ignore */
function getFileName(location) {
  var parts = location.split('/').filter(function (part) {
    return !!part.length;
  });
  if (!parts.length || parts[parts.length - 1].indexOf('.') === -1) {
    parts.push('index.html');
  }
  return path.join.apply(path, parts);
}

/** @ignore */
function getAssetObject(string) {
  return {
    source: function() { return string; },
    size: function() { return string.length; }
  };
}

/**
 * @description creates hops webpack plugin instance
 *
 * @class
 * @param {?Object}   options
 * @param {?string[]} options.locations
 * @param {?string}   options.template
 * @param {?string}   options.config
 * @param {?string}   options.chunkPrefix
 */
function Plugin(options) { this.options = options; }

/**
 * @description augments compilation options with global and instance defaults
 *
 * @private
 *
 * @param {?Object}   options
 * @param {?string[]} options.locations
 * @param {?string}   options.template
 * @param {?string}   options.config
 * @param {?string}   options.chunkPrefix
 * @param {?Object[]} options.dll
 * @param {?string[]} options.css
 * @param {?string[]} options.js
 * @return {Object}
 */
Plugin.prototype.getOptions = function (options) {
  return Object.assign(
    {
      locations: ['/'],
      template: path.resolve(__dirname, './template.ejs'),
      config: helpers.resolve('webpack.node.js'),
      dll: [],
      css: [],
      js: []
    },
    this.options,
    options
  );
};

/**
 * @description hooks into webpack compiler lifecycle and produce html
 *
 * @private
 *
 * @param {!Object} compiler
 * @return {undefined}
 */
Plugin.prototype.apply = function(compiler) {
  var getOptions = this.getOptions.bind(this);
  compiler.plugin('emit', function(compilation, callback) {
    var options = getOptions(compilation.options.hops);
    var renderEJS = ejs.compile(fs.readFileSync(options.template, 'utf-8'));
    options.dll.forEach(function(dll) {
      var source = fs.readFileSync(dll.source);
      compilation.assets[dll.path] = getAssetObject(source);
      if (dll.path.lastIndexOf('.js') === (dll.path.length - 3)) {
        options.js.push(dll.path);
      }
      else if (dll.path.lastIndexOf('.css') === (dll.path.length - 4)) {
        options.css.push(dll.path);
      }
    });
    renderer.createRenderer(options.config)
    .then(function (renderReact) {
      return Promise.all(options.locations.map(function (location) {
        return renderReact(location, options)
        .then(function (result) {
          var html = renderEJS(Object.assign({}, options, result, {
            js: options.js.concat(
              getAssetPaths(compilation.assets, 'js').filter(function (js) {
                return (options.js.indexOf(js) === -1);
              })
            ),
            css: options.css.concat(getAssetPaths(compilation.assets, 'css'))
          }));
          compilation.assets[getFileName(location)] = getAssetObject(html);
        });
      }));
    })
    .catch(function (error) { // eslint-disable-next-line no-console
      if (error) { console.log('[HOPS PLUGIN ERROR]:', error); }
    })
    .then(function () { callback(); });
  });
};

/** @ignore */
Plugin.getAssetPaths = getAssetPaths;

/** @ignore */
Plugin.getFileName = getFileName;

module.exports = Plugin;
