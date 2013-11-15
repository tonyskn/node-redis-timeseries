
var TimeSeries = module.exports = function(redis) {
  this.redis = redis;
  this.granularities = Object.keys(granularitiesConfig);
  this.pendingMulti = redis.multi();
};

/**
 * Record a hit for the specified stats entry
 * This method is chainable:
 * --> var ts = new TimeSeries(redis)
 *              .recordHit("messages")
 *              .recordHit("purchases")
 *              ...
 *              .exec([callback]);
 */
TimeSeries.prototype.recordHit = function(key) {
  var self = this;

  this.granularities.forEach(function(gran) {
    var properties = granularitiesConfig[gran],
        tsround = getRoundedTime(properties.size * properties.factor),
        tmpKey = [key, gran, tsround].join(':'),
        ts = getRoundedTime(properties.factor);

   self.pendingMulti.hincrby(tmpKey, ts, 1);
   self.pendingMulti.expireat(tmpKey, tsround + properties.ttl);
  });

  return this;
};

/**
 * Execute the current pending redis multi
 */
TimeSeries.prototype.exec = function(callback) {
  var self = this;

  if (this.pendingMulti) {
    this.pendingMulti.exec(function(err, result) {
      self.pendingMulti = self.redis.multi();
      callback(err, result);
    });
  }
};

/** 
 * getHits(redis, "messages", "10minutes", 3, cb)
 *   --> "messages" hits during the last 3 '10minutes' chunks
 */
TimeSeries.prototype.getHits = function(key, gran, count, callback) {
  var properties = granularitiesConfig[gran],
      currentTime = getCurrentTime();

  if (typeof properties === "undefined") {
    return callback(new Error("Unsupported granularity: "+gran));
  }

  var from = getRoundedTime(properties.factor, currentTime - count*properties.factor),
      to = getRoundedTime(properties.factor, currentTime);

  for(var ts=from, multi=this.redis.multi(); ts<=to; ts+=properties.factor) {
    var tsround = getRoundedTime(properties.size * properties.factor, ts),
        tmpKey = [key, gran, tsround].join(':');

    multi.hget(tmpKey, ts);
  }

  multi.exec(function(err, results) {
    if (err) {
      return callback(err);
    }

    for(var ts=from, i=0, data=[]; ts<=to; ts+=properties.factor, i+=1) {
      if (results[i]) {
        data.push([ts, parseInt(results[i], 10)]);
      }
    }

    return callback(null, data.slice(Math.max(data.length - count, 0)));
  });
};

var granularitiesConfig = {
  '5minutes': { // Available for 24 hours
    size: 288,
    ttl: 172800,
    factor: 300
  },
  '10minutes': { // Available for 24 hours
    size: 144,
    ttl: 172800,
    factor: 600
  },
  'hour': { // Available for 7 days
    size:   168,
    ttl:    1209600,
    factor: 3600
  },
  'day': { // Available for 24 months
    size:   365,
    ttl:    63113880,
    factor: 86400
  }
};

var getCurrentTime = function() {
  return Math.floor(Date.now() / 1000);
};

var getRoundedTime = function(precision, time) {
  time = time || getCurrentTime();
  return Math.floor(time / precision) * precision;
};

