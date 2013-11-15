
var TimeSeries = module.exports = function(redis) {
  this.redis = redis;
  this.pendingMulti = redis.multi();
  this.granularities = {
    '5minutes': {
      size: 288,
      ttl: 172800, // Available for 24 hours
      factor: 300
    },
    '10minutes': {
      size: 144,
      ttl: 172800, // Available for 24 hours
      factor: 600
    },
    'hour': {
      size:   168,
      ttl:    1209600, // Available for 7 days
      factor: 3600
    },
    'day': {
      size:   365,
      ttl:    63113880, // Available for 24 months
      factor: 86400
    }
  };
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

  Object.keys(this.granularities).forEach(function(gran) {
    var properties = self.granularities[gran],
        keyTimestamp = getRoundedTime(properties.size * properties.factor),
        tmpKey = [key, gran, keyTimestamp].join(':'),
        hitTimestamp = getRoundedTime(properties.factor);

   self.pendingMulti.hincrby(tmpKey, hitTimestamp, 1);
   self.pendingMulti.expireat(tmpKey, keyTimestamp + properties.ttl);
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
  var properties = this.granularities[gran],
      currentTime = getCurrentTime();

  if (typeof properties === "undefined") {
    return callback(new Error("Unsupported granularity: "+gran));
  }

  var from = getRoundedTime(properties.factor, currentTime - count*properties.factor),
      to = getRoundedTime(properties.factor, currentTime);

  for(var ts=from, multi=this.redis.multi(); ts<=to; ts+=properties.factor) {
    var keyTimestamp = getRoundedTime(properties.size * properties.factor, ts),
        tmpKey = [key, gran, keyTimestamp].join(':');

    multi.hget(tmpKey, ts);
  }

  multi.exec(function(err, results) {
    if (err) {
      return callback(err);
    }

    for(var ts=from, i=0, data=[]; ts<=to; ts+=properties.factor, i+=1) {
      data.push([ts, results[i] ? parseInt(results[i], 10) : 0]);
    }

    return callback(null, data.slice(Math.max(data.length - count, 0)));
  });
};

// Get current timestamp in seconds
var getCurrentTime = function() {
  return Math.floor(Date.now() / 1000);
};

// Round timestamp to the 'precision' interval (in seconds)
var getRoundedTime = function(precision, time) {
  time = time || getCurrentTime();
  return Math.floor(time / precision) * precision;
};

