const _ = require('lodash');
const { decycle } = require('json-cycle');

/**
 * Returns a cached version of the input function, where, similarly to _.memoize,
 * function calls with the same parameters will be cached and returned.
 * Unlike _.memoize, the cached values will expire after <pre>ttl</pre> milliseconds
 * (default 1hr)
 *
 * <pre>
 * function slowRarelyChangingFunction(a, b) {
 *  ...
 * }
 *
 * const cachedFn = cache(slowRarelyChangingFunction, { ttl: <ttl in ms>})
 *
 * const result1 = cachedFn(1, 2); // cache miss - slow
 * const result2 = cachedFn(3, 4); // cache miss - slow
 * const result3 = cachedFn(1, 2); // cache hit - fast
 * </pre>
 *
 * @param fn The function to cache
 * @param ttl The expiry of individual entries in the cache
 */
function cache(fn, { ttl = 60000 } = {}) {
  const fnCache = new Map();

  return _.wrap(fn, (originalFn, ...args) => {
    const now = Date.now();

    // we stringify the arguments so that identical arguments result in the
    const stringifiedArgs = stringifyArray(args);

    const { timestamp, cachedResult } = fnCache.get(stringifiedArgs) || {};

    if (timestamp) {
      // cache hit
      if (now - timestamp < ttl) {
        // not expired
        return cachedResult;
      }
    }

    // cache miss or expired
    const newResult = originalFn(...args);

    // update the cache with the new result
    fnCache.set(stringifiedArgs, { timestamp: now, cachedResult: newResult });

    return newResult;
  });
}

/**
 * Converts an array into a string that can be used as a key in the cache map
 * This avoids the problem in JS where ['a','b','c'] !== ['a','b','c']
 *
 * However, this implentation is costly - using JSON.stringify.
 * @param array The input array to convert into a string
 * @return The stringified array
 */
function stringifyArray(array) {
  return array.reduce((curr, next) => curr + JSON.stringify(decycle(next)), '');
}

module.exports = cache;
