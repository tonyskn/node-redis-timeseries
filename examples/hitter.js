var redis = require('redis').createClient(),
    TimeSeries = require('../'),
    ts = new TimeSeries(redis),
    key = process.argv[2],
    i = 0;

redis.on("error", function(err) { console.log("Error: ", err); });

var randomDelay = function() {
  return Math.floor( Math.random() * 15 * 100 );
};

// Just increment the 'key' counter and wait
// some delay before trying again
setTimeout(function hit() {
  ts.recordHit(key)
    .exec(function() {
      console.log("Recorded hit ["+key+"]", ++i, new Date());
      setTimeout(hit, randomDelay());
    });
}, randomDelay());
