# Node.js API for storing and querying time series in Redis

[![Build Status][travis-image]][travis]

Convenient module for storing and querying time series statistics in Redis using Node.js.

The design (and even parts of the implementation) were picked from the [ApiAxle](http://blog.apiaxle.com/post/storing-near-realtime-stats-in-redis/) project.

You can find basic usage examples in `examples`. This module also powers a [real-time dashboard](https://github.com/tonyskn/node-dashboard) written in Node.js. Check the sources out for more insight.

## Dependencies

`redis-timeseries` has no dependencies, and will work along the `redis` module you'll install in your own project. `redis@~0.9.0` versions are compatible.

## Usage

```javascript
	var TimeSeries = require('redis-timeseries'),
		redis = require('redis').createClient();
		
	// Create the TimeSeries client
	//
	// "stats" is the Redis namespace which will be used
	// for storing all the TimeSeries related keys
    //
	// "granularities" encodes the granularities at which
	// you want to store statistics. More on that in the next section
	//
	var ts = new TimeSeries(redis, "stats", granularities);
	
	// Recording hits
	//
	// This increments the counters for the
	// stats keys you provide
	//
	// "timestamp" defaults to the current time. If providing
	// a timestamp, it should be in unix timestamp format (seconds
	// since epoch).
    // "increment" defaults to 1
	//
	// .exec takes an optional callback with no arguments.
	ts.recordHit('your_stats_key')
	  .recordHit('another_stats_key', timestamp)
      .recordHit('another_stats_key', timestamp2, increment)
	  …
	  .exec(callback);

    // Removing hits
    //
    // Decrements the hits for a specified point in time.
    ts.removeHit('your_stats_key', [timestamp]).exec();
    
    // Decrement defaults to 1, but can be specified explicitly (below).
    ts.removeHit('your_stats_key', [timestamp], 5).exec();
	  
	// Querying statistics
	//
	// Returns "count" chunks of counters at the precision described by
	// "granularity_label"
	// 
	ts.getHits('your_stats_key', granularity_label, count, function(err, data) {
		// data.length == count
		// data = [ [ts1, count1], [ts2, count2]... ]
	});
```

## Defining custom statistics granularities

For each key, `TimeSeries` stores statistics at different granularities. For further information about this, please refer to the detailed [blog post](http://blog.apiaxle.com/post/storing-near-realtime-stats-in-redis/) from the ApiAxle project.

The default granularities are:

```javascript
{
    '1second'  : { ttl: this.minutes(5), duration: 1 },
    '1minute'  : { ttl: this.hours(1)  , duration: this.minutes(1) },
    '5minutes' : { ttl: this.days(1)   , duration: this.minutes(5) },
    '10minutes': { ttl: this.days(1)   , duration: this.minutes(10) },
    '1hour'    : { ttl: this.days(7)   , duration: this.hours(1) },
    '1day'     : { ttl: this.weeks(52) , duration: this.days(1) }
}
```

This means that the number of `hits per second` will be stored for `5 minutes`, and the corresponding hashset will expire afterwards.  Likewise, the number of `hits per minute` for a given key will be kept for an `hour`.  `Daily` counters on the other hand are kept for a full year.

When querying for statistics, a granularity label is expected:

```javascript
	// Give me the hits/second for the last 3 minutes
	ts.getHits('your_stats_key', '1second', ts.minutes(3), function(err, data){
		//process the data
	});
	
	// Give me the number of hits per day for the last 2 weeks
	ts.getHits('your_stats_key', '1day', 14, function(err, data){
		//process the data
	});
	
	// And so on
```

When creating the `TimeSeries` client, you can override the default granularities with your own. 


[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/tonyskn/node-redis-timeseries/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

[travis]: http://travis-ci.org/tonyskn/node-redis-timeseries
[travis-image]: https://travis-ci.org/tonyskn/node-redis-timeseries.png
