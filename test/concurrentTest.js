var async = require('async'),
    vows = require('vows'),
    assert = require('assert'),
    redis = require('redis').createClient(),
    TimeSeries = require('../');

// number of concurrent requests
var N = 15;

function range(n) {
  return Array.apply(null, Array(n)).map(function (_, i) {return i;});
}

vows.describe('TimeSeries Tests').addBatch({
  'When recording hits concurrently': {
    topic: function() {
      var ts = new TimeSeries(redis);

      // Reduce granularities for easier testing
      ts.granularities = {
        'h' : { ttl: ts.days(7), duration: ts.hours(1) }
      };

      // Build N concurrent hit queries
      function handler(i) {
        return function(callback) {
          ts.recordHit('key_'+i).exec(callback);
        };
      }
      
      // Select non-default test db
      redis.select(9);
      redis.flushdb();

      async.parallel(range(N).map(handler), this.callback);
    },

    "we get correct results": function(results) {
      redis.flushdb();

      var expected = range(N).map(function() { return [1,1]; });

      assert.deepEqual(results, expected);
    }
  }
}).export(module);
