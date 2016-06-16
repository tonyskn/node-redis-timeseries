
var TimeSeries = module.exports = function(redis, keyBase, granularities, opts) {
  this.redis = redis;
  this.keyBase = keyBase || 'stats';
  this.pendingMulti = redis.multi();
  this.granularities = granularities || {
    '1second'  : { ttl: this.minutes(5), duration: 1 },
    '1minute'  : { ttl: this.hours(1)  , duration: this.minutes(1) },
    '5minutes' : { ttl: this.days(1)   , duration: this.minutes(5) },
    '10minutes': { ttl: this.days(1)   , duration: this.minutes(10) },
    '1hour'    : { ttl: this.days(7)   , duration: this.hours(1) },
    '1day'     : { ttl: this.weeks(52) , duration: this.days(1) }
  };
};

/** Helper functions that compute various durations in secs */
TimeSeries.prototype.seconds = function(i) { return i; };
TimeSeries.prototype.minutes = function(i) { return i*60; };
TimeSeries.prototype.hours   = function(i) { return i*this.minutes(60); };
TimeSeries.prototype.days    = function(i) { return i*this.hours(24); };
TimeSeries.prototype.weeks   = function(i) { return i*this.days(7); };
TimeSeries.prototype.months  = function(i) { return i*(this.weeks(4)+this.days(2)); };

/**
 * Record a hit for the specified stats key
 * This method is chainable:
 * --> var ts = new TimeSeries(redis)
 *              .recordHit("messages")
 *              .recordHit("purchases", ts)
 *              .recordHit("purchases", ts, 3)
 *              ...
 *              .exec([callback]);
 *
 * `timestamp` should be in seconds, and defaults to current time.
 * `increment` should be an integer, and defaults to 1
 */
TimeSeries.prototype.recordHit = function(key, timestamp, increment) {
  var self = this;

  Object.keys(this.granularities).forEach(function(gran) {
    var properties = self.granularities[gran],
        keyTimestamp = getRoundedTime(properties.ttl, timestamp),
        tmpKey = [self.keyBase, key, gran, keyTimestamp].join(':'),
        hitTimestamp = getRoundedTime(properties.duration, timestamp);

    self.pendingMulti.hincrby(tmpKey, hitTimestamp, Math.floor(increment || 1));
    self.pendingMulti.expireat(tmpKey, keyTimestamp + 2 * properties.ttl);
  });

  return this;
};

/*
 *  Removing hits
 *
 *  This decrements the counters for the
 *  stats keys you provide
 *
 * "timestamp" defaults to the current time
 * "decrement" defaults to -1
 *
 *  ts.removeHit('your_stats_key')
 *    .removeHit('another_stats_key', timestamp)
 *    .removeHit('another_stats_key', timestamp2, decrement)
 *     …
 *    .exec();
 */
TimeSeries.prototype.removeHit = function(key, timestamp, decrement) {
  return this.recordHit(key, timestamp, -(decrement || 1));
};

/**
 * Execute the current pending redis multi
 */
TimeSeries.prototype.exec = function(callback) {
  // Reset pendingMulti before proceeding to
  // avoid concurrent modifications
  var current = this.pendingMulti;
  this.pendingMulti = this.redis.multi();

  current.exec(callback);
};

/** 
 * getHits("messages", "10minutes", 3, cb)
 *   --> "messages" hits during the last 3 '10minutes' chunks
 */
TimeSeries.prototype.getHits = function(key, gran, opts, callback) {
  var properties = this.granularities[gran],
      currentTime = getCurrentTime(),
      fullCount = properties.ttl / properties.duration,
      count = fullCount,
      backfill = true;

  if(typeof(opts) == 'Number'){
    count = opts;
  }else{
    if(typeof(opts.backfill) !== 'undefined') backfill = opts.backfill;
  }

  var from = getRoundedTime(properties.duration, currentTime - count*properties.duration),
      to = getRoundedTime(properties.duration, currentTime);

  for(var ts=from, multi=this.redis.multi(); ts<=to; ts+=properties.duration) {
    var keyTimestamp = getRoundedTime(properties.ttl, ts),
        tmpKey = [this.keyBase, key, gran, keyTimestamp].join(':');

    multi.hget(tmpKey, ts);
  }

  multi.exec(function(err, results) {
    if (err) {
      return callback(err);
    }

    for(var ts=from, i=0, data=[]; ts<=to; ts+=properties.duration, i+=1) {
      if(results[i]) data.push([ts, parseInt(results[i], 10)]);
      if(!results[i] && backfill) data.push([ts, 0]);
    }

    return callback(null, data.slice(Math.max(data.length - opts.count, 0)));
  });
};

/**
 * Record a value for the specified stats key
 * This method is chainable:
 * --> var ts = new TimeSeries(redis)
 *              .recordValue("speed", ts, 42)
 *              .recordValue("rpm", ts, 7800)
 *              ...
 *              .exec([callback]);
 *
 * `timestamp` should be in seconds, and defaults to current time.
 * `value` should be an integer, and defaults to 0
 */
TimeSeries.prototype.recordValue = function(key, timestamp, value) {
  var self = this;

  Object.keys(this.granularities).forEach(function(gran) {
    timestamp = timestamp || new Date;
    var properties = self.granularities[gran],
        keyTimestamp = getRoundedTime(properties.ttl, timestamp),
        tmpKey = [self.keyBase, key, gran, keyTimestamp].join(':'),
        hitTimestamp = getRoundedTime(properties.duration, timestamp);

    self.pendingMulti.hset(tmpKey, hitTimestamp, Math.floor(value || 0));
    self.pendingMulti.expireat(tmpKey, keyTimestamp + 2 * properties.ttl);
  });

  return this;
};

TimeSeries.prototype.recordHit = function(key, timestamp, increment) {
  var self = this;

  Object.keys(this.granularities).forEach(function(gran) {
    var properties = self.granularities[gran],
        keyTimestamp = getRoundedTime(properties.ttl, timestamp),
        tmpKey = [self.keyBase, key, gran, keyTimestamp].join(':'),
        hitTimestamp = getRoundedTime(properties.duration, timestamp);

    self.pendingMulti.hincrby(tmpKey, hitTimestamp, Math.floor(increment || 1));
    self.pendingMulti.expireat(tmpKey, keyTimestamp + 2 * properties.ttl);
  });

  return this;
};

/** 
 * getValues("speed", "1minute", 60, cb)
 *   --> "speed" values for the last hour's 1 minute readings
 */
TimeSeries.prototype.getValues = function(key, gran, opts, callback) {
  var properties = this.granularities[gran],
      currentTime = getCurrentTime(),
      fullCount = properties.ttl / properties.duration,
      count = fullCount,
      backfill = true,
      backfillLastValue = true,
      latestValue = null;

  if(typeof(opts) == 'Number'){
    count = opts;
  }else{
    if(typeof(opts.count) !== 'undefined' ) count = opts.count;
    if(typeof(opts.backfill) !== 'undefined' ) backfill = opts.backfill;
    if(typeof(opts.backfillLastValue) !== 'undefined' ) backfillLastValue = opts.backfillLastValue;
  }
  
  if (typeof properties === "undefined") {
    return callback(new Error("Unsupported granularity: "+gran));
  }

  if (count > properties.ttl / properties.duration) {
    return callback(new Error("Count: "+count+" exceeds the maximum stored slots for granularity: "+gran));
  }

  var backFrom = getRoundedTime(properties.duration, currentTime - fullCount*properties.duration),
      from = getRoundedTime(properties.duration, currentTime - (count-1)*properties.duration),
      to = getRoundedTime(properties.duration, currentTime),
      multi = this.redis.multi(),
      keyTimestamp = getRoundedTime(properties.ttl, backFrom ),
      tmpKey = [this.keyBase, key, gran, keyTimestamp].join(':');

  for(var ts=backFrom; ts<=to; ts+=properties.duration) {
    keyTimestamp = getRoundedTime(properties.ttl, ts)
    tmpKey = [this.keyBase, key, gran, keyTimestamp].join(':');
    multi.hget(tmpKey, ts);
  }

  multi.exec(function(err, results) {
    
    if (err) {
      return callback(err);
    }

    for(var ts=backFrom, i=0, data=[]; ts<=from; ts+=properties.duration, i+=1) {
      latestValue = results[i] ? parseInt(results[i], 10) : latestValue;
    }

    for(var ts=from, i=fullCount-count+1, data=[]; ts<=to; ts+=properties.duration, i+=1) {
      latestValue = results[i] ? parseInt(results[i], 10) : latestValue;
      if(results[i]) data.push([ts, latestValue]);
      if(!results[i] && backfill) data.push([ts, backfillLastValue ? latestValue : null ]);
    }

    callback(null, data.slice(Math.max(data.length - count, 0)));
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

