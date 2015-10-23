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
var _ = require('underscore');

function test(obj) {
  if (obj || obj !== undefined) {
    return true;
  }
  return false;
}

function get(key, obj) {
  if (obj && obj.val) {
    obj.val = obj.val[key];
    if (obj.path != '') {
      obj.path += '.' + key;
    } else {
      obj.path += key;
    }
    return obj;
  }
}

function array_get(key, obj) {
  if (obj) {
    return _.filter(_.map(obj, function(_obj) { return get(key, _obj); }), test);
  }
}

function wild_get(obj) {
  var val;
  if (obj && (val = obj.val)) {
    return _.filter(_.map(Object.keys(val), function(_key) { return get(_key, {val:val,path:obj.path}); }), test);
  }
}

function wild_wild_get(obj) {
  if (obj) {
    return _.filter(_.map(Object.keys(obj), function(_key) { return wild_get(obj[_key]); }), test);
  }
}

function buildSelector(selectors) {
  return function(obj) {
    if (obj) {
      obj = {val:obj,path:''};
      _.each(selectors, function(_select) {
        obj = _select(obj);
      });
    }
    return obj;
  }
}

var SELECTORS = {};
function selector(path) {
  var select = SELECTORS[path];
  if (! select) {
    var selectors = [],
        _path = path.split('.'),
        wild = false;
        
    _.each(_path, function(key) {
      if (key == '*') {
        if (wild) {
          selectors.push(wild_wild_get);
        } else {
          wild = true;
          selectors.push(wild_get);
        }
      } else if (wild) {
        selectors.push(array_get.bind(this, key));
      } else {
        selectors.push(get.bind(this, key));
      }
    });
    
    select = buildSelector(selectors);
    SELECTORS[path] = select;
  }
  return select;
}

function select(obj, path) {
  return selector(path)(obj);
}

module.exports = select;