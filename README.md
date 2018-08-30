A function that produces a cached version of the input function, where, similarly to _.memoize,
function calls with the same parameters will be cached and returned.

Unlike _.memoize, the cached values will expire after *ttl* milliseconds (default 1hr)

 ```
 const cache = require('simple-cache');

 function slowRarelyChangingFunction(a, b) {
   ...
 }

 const cachedFn = cache(slowRarelyChangingFunction, { ttl: <ttl in ms>})
 const result1 = cachedFn(1, 2); // cache miss - slow
 const result2 = cachedFn(3, 4); // cache miss - slow
 const result3 = cachedFn(1, 2); // cache hit - fast
 ```