//Copyright (c) 2015 TimTheSinner All Rights Reserved.
'use strict';

/**
 * Copyright (c) 2015 TimTheSinner All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 * 
 * @author TimTheSinner
 */
function isString(arg) {
  return (typeof arg === 'string' || arg instanceof String);
}

function isArray(arg) {
  return Object.prototype.toString.call(arg) === '[object Array]';
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var Q = require('q'),
    _ = require('underscore'),
    select = require('./select');
    
Q.longStackSupport = true;
    
function normalize(obj) {
  return (obj ? obj : {});
}

function uri(obj) {
  return obj['href'];
}

function cache(req) {
  return null;
}
    
function DeepGet(properties) {
  this.properties =  _.extend({mode:'Standard', normalize:normalize, paths:[], uri:uri, cache:cache}, properties);
  this._get = this.properties.get;
  this._normalize = this.properties.normalize;
  this._uri = this.properties.uri;
  this._cache = this.properties.cache;
  this.active = 0;
}

DeepGet.prototype.promise = function(fn) {
  return Q.promise(fn.bind(this, this));
}

function test(obj, path) {
  var selected = select(obj, path);
  if (selected) {
    return selected;
  }
  return null;
}

function merge(obj, path, res) {
  var _obj = obj;
  var _path = path.split('.');
      
  _.each(_.initial(_path), function(p) {
    _obj = _obj[p];
  });
  
  if (isString(_obj[_.last(_path)])) {
    _obj[_.last(_path)] = res;
    return res;
  } else {
    return _.extend(_obj[_.last(_path)], res);
  }
}

DeepGet.prototype.tap = function(val, res) {
  this._cache(val, JSON.parse(JSON.stringify(res)));
}

DeepGet.prototype.release = function(cb, res) {
  this.active -= 1;
  cb(res);
}

DeepGet.prototype.throttle = function(req, val, count) {
  count = count || 0;
  if (this.active == 15) {
    return Q.delay(random(350, 850)).then(this.throttle.bind(this, req, val, count));
  } else {
    this.active += 1;
    return this.promise(function(self, resolve, reject, notify) {
      var timeout = 5000 + (count * 1500);
      self._get(req, val).timeout(timeout, {msg: 'Failed to GET req before ' + timeout + ' timeout', count: count + 1})
          .then(self.release.bind(self, resolve))
          .fail(function(err) {
            self.active -= 1;
            if (err.count && err.count < 5) {
              self.throttle(req, val, err.count).then(resolve).fail(reject);
            } else {
              reject(err);
            }
          });
    });
  }
}

DeepGet.prototype.fetch = function(obj) {
  var self = this;
  var selects = _.map(_.compact(_.map(this.properties.paths, test.bind(self, obj))), function(selected) {
    function handle(val, path) {
      var cache = self._cache(val);
      var promise;
      
      if (cache) {
        promise = Q(cache);
      } else {
        if (isString(val)) {
          promise = self.throttle(val, {}).tap(self.tap.bind(self, val));
        } else {
          promise = self.throttle(self._uri(val), val).tap(self.tap.bind(self, val));
        }
      }
      
      return promise.then(self._normalize)
                    .then(self.fetch.bind(self))
                    .then(merge.bind(self, obj, path));
    }
  
    return Q.promise(function(resolve, reject, notify) {
      var promise;
      
      if (isArray(selected)) {
        promise = Q.allSettled(_.map(selected, function(_selected) { return handle(_selected.val, _selected.path).fail(function(err) { console.log(err); }); }));
      } else {
        promise = handle(selected.val, selected.path);
      }
      
      promise.then(resolve).fail(reject);
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