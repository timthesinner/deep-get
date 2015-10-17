'use strict';

if (!String.isString) {
  String.isString = function(arg) {
    return (typeof arg === 'string' || arg instanceof String);
  }
}

var Q = require('q'),
    _ = require('underscore'),
    select = require('utils-deep-get');
    
function normalize(obj) {
  return (obj ? obj : {});
}

function uri(obj) {
  return obj['href'];
}
    
function DeepGet(properties) {
  this.properties =  _.extend({mode:'Standard', normalize:normalize, paths:[], uri:uri}, properties);
  this._get = this.properties.get;
  this._normalize = this.properties.normalize;
  this._uri = this.properties.uri;
}

DeepGet.prototype.promise = function(fn) {
  return Q.promise(fn.bind(this, this));
}

function test(obj, path) {
  var selected = select(obj, path);
  if (selected) {
    return {'path':path,'selected':selected};
  }
  return null;
}

function merge(obj, path, res) {
  var _obj = obj;
  var _path = path.split('.');
      
  _.each(_.initial(_path), function(p) {
    _obj = _obj[p];
  });
  
  if (String.isString(_obj[_.last(_path)])) {
    _obj[_.last(_path)] = res;
    return res;
  } else {
    return _.extend(_obj[_.last(_path)], res);
  }
}

DeepGet.prototype.fetch = function(obj) {
  var self = this;
  var selects = _.map(_.compact(_.map(this.properties.paths, test.bind(self, obj))), function(match) {
    return Q.promise(function(resolve, reject, notify) {
      var promise;
      
      if (String.isString(match.selected)) {
        promise = self._get(match.selected, {});
      } else {
        promise = self._get(self._uri(match.selected), match.selected);
      }
      
      promise.then(self._normalize).then(self.fetch.bind(self))
             .then(merge.bind(self, obj, match.path))
             .then(resolve).fail(reject);
    });
  });
  
  if (selects) {
    return Q.allSettled(selects).then(function() { return obj; });
  } else {
    return obj;
  }
}

DeepGet.prototype.get = function(uri){
  return this.promise(function(self, resolve, reject, notify) {
    self._get(uri, {}).then(self._normalize).then(self.fetch.bind(self))
                      .then(resolve).fail(reject);
  });
}

module.exports = function(properties) {
  return new DeepGet(properties);
}