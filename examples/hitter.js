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

// Just decrement the 'key' counter every once in a while
// with some delay to try again
setTimeout(function removeHit() {
  ts.removeHit(key)
    .exec(function() {
      console.log("Removed hit ["+key+"]", ++i, new Date());
      setTimeout(removeHit, randomDelay()+5000);
    });
}, randomDelay()+5000);

