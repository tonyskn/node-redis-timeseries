var redis = require('redis'),
    TimeSeries = require('../'),
    client = redis.createClient(),
    ts = new TimeSeries(client),
    i = 0;

client.on("error", function(err) { console.log("Error: ", err); });

setInterval(function() {
  ts.recordHit("messages")
    .recordHit("visits")
    .exec(function() {
      console.log("Recorded hit", new Date(), ++i);
    });
}, 90 * 1000);
