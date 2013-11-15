var redis = require('redis'),
    TimeSeries = require('../'),
    client = redis.createClient(),
    ts = new TimeSeries(client),
    i = 0;

client.on("error", function(err) { console.log("Error: ", err); });

var randomDelay = function() {
  return Math.floor( Math.random() * 10 * 1000 );
};

setTimeout(function hit() {
  ts.recordHit("messages")
    .exec(function() {
      console.log("Recorded hit", ++i, new Date());
      setTimeout(hit, randomDelay());
    });
}, randomDelay());
