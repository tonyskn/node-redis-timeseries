var redis = require('redis').createClient(),
    TimeSeries = require('../'),
    ts = new TimeSeries(redis),
    key = process.argv[2],
    i = 0;

redis.on("error", function(err) { console.log("Error: ", err); });

var randomDelay = function() {
  return Math.floor( Math.random() * 15 * 100 );
};

// Just hit the 'messages' counter and wait between
// 0, 10 secs before trying again
setTimeout(function hit() {
  ts.recordHit(key)
    .exec(function() {
      console.log("Recorded hit ["+key+"]", ++i, new Date());
      setTimeout(hit, randomDelay());
    });
}, randomDelay());
