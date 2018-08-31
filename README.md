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

The underlying cache is available at cachedFn.cache.

The results are stored in the cache as follows:

 ```
 JSON.stringify(decycle(arguments)) -> result
 ```

The arguments are stringified in order to allow subsequent lookups on argument lists that have the same contents,
but are not equal in terms of JS equality (===).

To avoid problems with stringification, the arguments are decycled first using the `json-cycle` library.

This process has two important side-effects:

Note 1: The decycling and stringification can be expensive - so this cache should not be used for complex object inputs (e.g. large DOM trees)
Note 2: Since WeakMap does not allow String keys, we use Map here. This can lead to memory leaks if a service runs for a long time.

To mitigate memory leaks, the function provides access to the underlying cache via `cachedFn.cache`. You can clear the cache by calling:

```
cachedFn.cache = new Map();
```

or you can pass any implementation you like of the Map interface, in order to control the cache size.
