var TimeSeries = require('../'),
    redis = require('redis'),
    client = redis.createClient(),
    ts = new TimeSeries(client);

client.on("error", function(err) { console.log("Error: ", err); });

// Gets the hit counters for the last 5 '5minutes' time slots
ts.getHits("messages", "5minutes", 15, console.log);

client.quit();
