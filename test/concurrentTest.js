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
      redis.flushdb();

      var date = Math.floor(Date.now() / 1000);
      //date = date.getTime() / 1000;
      var backDate = date - 7200; // 3 hours
      var backBackDate = date - 14400; // 6 hours

      // Reduce granularities for easier testing
      ts.granularities = {
        'h' : { ttl: ts.days(7), duration: ts.hours(1) }
      };

      // Build N concurrent hit queries
      function handler(i) {
        return function(callback) {
          ts.recordHit('key_'+i).recordHit('key').exec(callback);
        };
      }

      function getHits(opts) {
        return function(callback) {
          opts = opts || {}
          opts.count = opts.count || 4
          ts.getHits('key', 'h', opts, function(err, data){
            data = range(data.length).map(function(res) { return data[res][1]; });
            callback(err, data);
          });
        };
      }

      function recordValue(key, d, i) {
        return function(callback) {
          ts.recordValue('valueKey', d, i).exec(callback);
        };
      }
      
      function getValues(opts) {
        return function(callback) {
          opts = opts || {}
          opts.count = opts.count || 4
          ts.getValues('valueKey', 'h', opts, function(err, data){
            data = range(data.length).map(function(res) { return data[res][1]; });
            callback(err, data);
          });
        };
      }

      // Select non-default test db
      redis.select(9);
      //redis.flushdb();

      var tasks = range(N).map(handler);
      //console.log(tasks);
      tasks.push(recordValue('valueKey', date, 1));
      tasks.push(recordValue('valueKey', date, 1));
      tasks.push(recordValue('valueKey', backDate, 2));
      tasks.push(recordValue('valueKey', backBackDate, 3));
      tasks.push(getValues({ backfill : false }));
      tasks.push(getValues({ backfillLastValue : false }));
      tasks.push(getValues());
      tasks.push(getHits({ backfill : false }));
      tasks.push(getHits());

      async.parallel(tasks, this.callback);
    },

    "we get correct results": function(results) {

      redis.flushdb();

      console.log(results[results.length-5])

      assert.deepEqual(results[results.length-5], [ 2, 1 ])
      assert.deepEqual(results[results.length-4], [ null, 2, null, 1 ])
      assert.deepEqual(results[results.length-3], [ 3, 2, 2, 1 ])
      assert.deepEqual(results[results.length-2], [ 15 ])
      assert.deepEqual(results[results.length-1], [ 0, 0, 0, 15 ])

    }
  }
}).export(module);
