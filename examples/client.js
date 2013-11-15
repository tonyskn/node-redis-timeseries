var TimeSeries = require('../'),
    redis = require('redis'),
    client = redis.createClient(),
    ts = new TimeSeries(client);

client.on("error", function(err) { consoe.log("Error: ", err); });

ts.getHits("visits", "5minutes", 4, function(err, data) {
  console.log(err, data);
});

client.quit();
