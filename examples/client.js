var redis = require('redis').createClient(),
    TimeSeries = require('../'),
    ts = new TimeSeries(redis);

redis.on("error", function(err) { console.log("Error: ", err); });

// Gets the hit counters for the last 5 '5minutes' time slots
console.log(Math.floor(Date.now()/1000));
ts.getHits(process.argv[2], process.argv[3], process.argv[4], function(err, data) {
  if (err) {
    return console.log(err);
  }

  data.forEach(function(d) {
    console.log(new Date(d[0]*1000), d[1]);
  }); 
});

redis.quit();
