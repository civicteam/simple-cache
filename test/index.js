const { expect } = require('chai');

const cache = require('../src');

// util.promisify(setTimeout) behaves oddly on different node versions (even node 8+)
// so polyfill it here
const setTimeoutPromise = time => new Promise(resolve => setTimeout(resolve, time));

// counts how many times it was called
function Counter() {
  this.count = 0;

  // just returns hello
  this.hello = () => {
    this.count++;

    return 'hello';
  };

  // just passes the parameter back
  this.echo = a => {
    this.count++;

    return a;
  };

  // adds the two parameters
  this.sum = (a, b) => {
    this.count++;

    return a + b;
  };

  // adds the three parameters
  this.sum3 = (a, b, c) => {
    this.count++;

    return a + b + c;
  };

  this.promise = a => {
    this.count++;

    return Promise.resolve(a);
  };
}

// creates an object with a cycle in its graph
function objectWithCycle() {
  const parent = { hello: 'world' };
  const child = { parent };

  parent.children = [child];
  return parent;
}

describe('Cache', () => {
  let counter;
  let hello;
  let echo;
  let sum;
  let promise;

  describe('with standard settings', () => {
    beforeEach(() => {
      counter = new Counter();

      hello = cache(counter.hello);
      echo = cache(counter.echo);
      sum = cache(counter.sum);
      promise = cache(counter.promise);
    });

    it('calls the original function (no args)', () => {
      const result = hello();

      expect(result).to.equal('hello');
    });

    it('calls the original function (single arg)', () => {
      const result = echo(1);

      expect(result).to.equal(1);
    });

    it('calls the original function (multi arg)', () => {
      const result = sum(3, 4);

      expect(result).to.equal(7);
    });

    it('caches the function result (no args)', () => {
      hello();

      // function has been called
      expect(counter.count).to.equal(1);

      const cachedResult = hello();

      // should not have called the function again
      expect(counter.count).to.equal(1);

      // result should be correct
      expect(cachedResult).to.equal('hello');
    });

    it('caches the function result (single arg)', () => {
      echo(1);

      // function has been called
      expect(counter.count).to.equal(1);

      const cachedResult = echo(1);

      // should not have called the function again
      expect(counter.count).to.equal(1);

      // result should be correct
      expect(cachedResult).to.equal(1);
    });

    it('caches the function result (multiple args)', () => {
      sum(5, 6);

      // function has been called
      expect(counter.count).to.equal(1);

      const cachedResult = sum(5, 6);

      // should not have called the function again
      expect(counter.count).to.equal(1);

      // result should be correct
      expect(cachedResult).to.equal(11);
    });

    it('handles object parameters', () => {
      const parameter = { hello: 'world' };
      const result = echo(parameter);

      expect(result).to.equal(parameter);
    });

    it('handles object parameters with cycles', () => {
      const parent = objectWithCycle();

      const result = echo(parent);

      expect(result).to.equal(parent);
    });

    it('does not manipulate object parameters with cycles in the cache', () => {
      const parent = objectWithCycle();

      echo(parent);

      const cachedResult = echo(parent);
      expect(cachedResult).to.equal(parent);
    });

    it('uses the cache for object parameters with cycles', () => {
      const parent = objectWithCycle();

      echo(parent);
      echo(parent);

      expect(counter.count).to.equal(1);
    });

    it('caches promises', async () => {
      const initialResult = await promise(1);

      // function has been called
      expect(counter.count).to.equal(1);

      expect(initialResult).to.equal(1);

      const cachedResult = await promise(1);

      // should not have called the function again
      expect(counter.count).to.equal(1);

      // result should be correct
      expect(cachedResult).to.equal(1);

      expect(initialResult).to.equal(cachedResult);
    });

    it('should expose the underlying cache', () => {
      echo(1);

      const cache = echo.cache;

      expect(cache.get('1').cachedResult).to.equal(1);
    });

    it('should allow the caller to replace the cache', () => {
      echo(1);

      echo.cache = new Map();

      expect(echo.cache.get('1')).to.be.undefined;

      echo(1);

      expect(echo.cache.get('1').cachedResult).to.equal(1);
    });

    it('should allow the caller to manipulate the cache', () => {
      echo(1);

      expect(echo.cache.get('1').cachedResult).to.equal(1);

      echo.cache.get('1').cachedResult = 2;

      expect(echo(1)).to.equal(2);
    });
  });

  describe('with a quick-expiring cache', () => {
    beforeEach(() => {
      counter = new Counter();

      echo = cache(counter.echo, { ttl: 10 });
      sum = cache(counter.sum, { ttl: 10 });
      promise = cache(counter.promise, { ttl: 10 });
    });

    it('recaches when the cache expires', async () => {
      echo(1);

      // function has been called
      expect(counter.count).to.equal(1);

      await setTimeoutPromise(15);

      const newResult = echo(1);

      // should have called the function again
      expect(counter.count).to.equal(2);

      // result should be correct
      expect(newResult).to.equal(1);
    });
  });

  describe('with object methods', () => {
    function MyStatefulObject(initialValue) {
      this.state = initialValue;
      const self = this;

      this.incrementFn = function() {
        return ++self.state;
      };

      this.incrementClosure = () => ++this.state;
    }

    let statefulObject;
    let incrementFn;
    let incrementClosure;

    beforeEach(() => {
      statefulObject = new MyStatefulObject(100);

      incrementFn = cache(statefulObject.incrementFn);
      incrementClosure = cache(statefulObject.incrementClosure);
    });

    it('do not mess up references to "this" when used on a function', async () => {
      incrementFn();

      // function has been called
      expect(statefulObject.state).to.equal(101);

      incrementFn();

      // should not have called the function again
      expect(statefulObject.state).to.equal(101);
    });

    it('do not mess up references to "this" when used on a closure', async () => {
      incrementClosure();

      // function has been called
      expect(statefulObject.state).to.equal(101);

      incrementClosure();

      // should not have called the function again
      expect(statefulObject.state).to.equal(101);
    });
  });

  describe('with an argument converter', () => {
    let ignoreThirdArgument;

    beforeEach(() => {
      counter = new Counter();

      ignoreThirdArgument = cache(counter.sum3, { convertArgFn: (a, b) => [a, b] });
    });

    it('should ignore the third argument when caching', () => {
      const result = ignoreThirdArgument(5, 6, 7);

      // function has been called
      expect(counter.count).to.equal(1);

      // result should be correct
      expect(result).to.equal(18);

      const cachedResultWithDifferentThirdArgument = ignoreThirdArgument(5, 6, 100);

      // should not have called the function again
      expect(counter.count).to.equal(1);

      // result should be the same as the original call
      expect(cachedResultWithDifferentThirdArgument).to.equal(18);

      const cachedResultWithDifferentSecondArgument = ignoreThirdArgument(5, 7, 8);

      // should have called the function again
      expect(counter.count).to.equal(2);

      // result should be the same as the original call
      expect(cachedResultWithDifferentSecondArgument).to.equal(20);
    });
  });
});
