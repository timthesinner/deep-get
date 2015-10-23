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
var Q = require('q'),
    _ = require('underscore'),
    fs = require('fs');
    
//Fix the rally ref API to return base resources
(function() {
  var ref = require('rally/lib/util/ref'),
    _relative = ref.getRelative,
    TYPE_REGEX = new RegExp('.*?\\/(\\w+)$');

  ref.getRelative = function(input) {
    var relative = _relative(input);
    if (!relative && TYPE_REGEX.test(input)) {
      return [''].concat(input.match(TYPE_REGEX).slice(1)).join('/');
    }
    return relative;
  };
})();    

if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
} 
 
function clean(obj, _depth) {
  var depth = _depth || 0;
  if (!obj || depth == 10) { return; }
  
  var drop = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (key.startsWith('_') && key != '_ref' && key != '_type') {
        drop.push(key)
      } else if (typeof obj[key] !== 'string') {
        clean(obj[key], depth + 1);
      }
    }      
  }
  
  for (var i in drop) {
    delete obj[drop[i]];
  }
  
  return obj;
}

var CACHE = {}
function cache(req, res) {
  if (res) {
    if (res.Object || res.Results) {
      CACHE[req['_ref']] = res;
    }
  } else {
    if (req['_ref']) {
      return CACHE[req['_ref']];
    }
  }
}

var FETCH = {
  'PortfolioItem/Feature':['FormattedID', 'Name', 'State', 'Tags', 'UserStories'],
  'HierarchicalRequirement':['ObjectID','FormattedID','Name','Notes','AcceptedDate','Blocked','BlockedReason','Blocker','PlaEstimate','TaskActualTotal','TaskEstimateTotal','TaskRemainingTotal','TaskStatus','Iteration','Release','Children','Project'],
  'Tag':['Name']
};
   
Q.nfcall(fs.readFile, '__data__/rally.json').then(function(d) { return JSON.parse(d); }).then(function(meta) {
  var queryUtils = require('rally').util.query;
  var rally = require('rally')({
    user: meta.user,//Defaults to process.env.RALLY_USERNAME
    pass: meta.pass,//Defaults to process.env.RALLY_PASSWORD
    server: 'https://rally1.rallydev.com',
    requestOptions: {
      headers: {
        'X-RallyIntegrationName': 'Rally/Deep-Get-Example',
        'X-RallyIntegrationVendor': 'Deep Get',
        'X-RallyIntegrationVersion': '1.0.0'                    
      }
    }
  });
  
  var deep = require('../lib/deep-get')({
    paths:['Results.*.UserStories', 'Results.*.Tags', 'Object.Results.*.Children', 'Object.Results.*.Iteration'],
    normalize: clean,
    cache: cache,
    get: function(query, obj) {
      if (query['_ref']) {
        console.log(query['_ref'])
        return rally.get({
          ref: query['_ref'],
          fetch: FETCH[query['_type']]
        });
      } else {
        return rally.query(query);
      }
    }, uri: function(obj) {
      return obj;
    }
  });
  
  return deep.get({
    type: 'PortfolioItem/Feature',
    fetch: ['FormattedID', 'Name', 'State', 'Tags', 'UserStories']
  }).then(function(features) {
    return Q.nfcall(fs.writeFile, '__data__/rally-features.json', JSON.stringify(features, null, 2));
  });
}).fail(function(err) {
  throw err;
}).done(function() {
  console.log('finished');
});
