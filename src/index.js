const _ = require('lodash');
const { decycle } = require('json-cycle');

const DEFAULT_TTL = 1000 * 60 * 60; // 1 hour

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
function cache(fn, { ttl = DEFAULT_TTL } = {}) {
  // this boxing allows you to change the cache implementation at runtime
  const fnCache = { implementation: new Map() };

  const wrapped = _.wrap(fn, (originalFn, ...args) => {
    const now = Date.now();

    // we stringify the arguments so that identical arguments result in the
    const stringifiedArgs = stringifyArray(args);

    const { timestamp, cachedResult } = fnCache.implementation.get(stringifiedArgs) || {};

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
    fnCache.implementation.set(stringifiedArgs, { timestamp: now, cachedResult: newResult });

    return newResult;
  });

  // expose the cache at runtime to allow the caller to replace/wipe/otherwise manipulate it
  Object.defineProperty(wrapped, 'cache', {
    get: () => fnCache.implementation,
    set: newCache => {
      fnCache.implementation = newCache;
    }
  });

  return wrapped;
}

/**
 * Converts an array into a string that can be used as a key in the cache map
 * This avoids the problem in JS where ['a','b','c'] !== ['a','b','c']
 *
 * However, this implementation is costly - using JSON.stringify.
 * @param array The input array to convert into a string
 * @return The stringified array
 */
function stringifyArray(array) {
  return array.reduce((curr, next) => curr + JSON.stringify(decycle(next)), '');
}

module.exports = cache;
