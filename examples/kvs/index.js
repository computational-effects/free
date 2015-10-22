'use strict';

var pbp = require('@ce/pbp');
var mixins = require('@ce/mixin').mixins;
var Catamorphism = require('@ce/catamorphism').Catamorphism;
var Stringify = require('@ce/stringify').Stringify;
var Unit = require('@ce/unit').Unit;
var R = require('ramda');

var value = pbp.value;
var enumerableGet = pbp.enumerableGet;
var enumerableValue = pbp.enumerableValue;

var FreeDerive = require('../../').FreeDerive;

/*
  A Key value store should need only three primitives:

  1. Get
  2. Put
  3. Del

  From this most other things should be able to be implemented.

  The simplest approach involves an encoding like:

  data KVS a = Get String | Put String a | Del String

  The problem with this approach is that if we want a set of instructions,
  we're pretty much limited to a list, yet we can't easily use previous results.

  Encoding it with continuations is a better approach:

  data KVS val a = Get String (val -> a) | Put String val a | Del String a

  With this, we can then use Free to sequence instructions easily.
*/
var KVS = mixins([Catamorphism, FreeDerive, Stringify],
  Object.create(null)
);

function Get(str, cont) {
  return Object.create(KVS, {
    type: value('Get'),
    args: value([str, cont]),
    ctor: value(Get),
    map: enumerableValue(function(f) {
      return Get(str, function(val) {
        return f(cont(val));
      });
    }),
  });
}

function Put(str, val, cont) {
  return Object.create(KVS, {
    type: value('Put'),
    args: value([str, val, cont]),
    ctor: value(Put),
    map: enumerableValue(function(f) {
      return Put(str, val, f(cont));
    }),
  });
}

function Del(str, cont) {
  return Object.create(KVS, {
    type: value('Del'),
    args: value([str, cont]),
    ctor: value(Del),
    map: enumerableValue(function(f) {
      return Del(str, f(cont));
    }),
  });
}

function get(str) {
  return Get(str, function(x) { return x; }).liftF;
}

function put(str, val) {
  return Put(str, val, Unit).liftF;
}

function del(str) {
  return Del(str, Unit).liftF;
}

/*
  Using the primitives, we can extend the dsl as though it's a regular `Monad`.
*/
function modify(str, f) {
  return get(str).chain(function(val) {
    return put(str, f(val));
  });
}

/*
  Now we can interpret this in a pure object context.
*/

function pureObject(free, store) {
  return free.cata({
    Of: function(_) { return store; },
    Join: function(kvs) {
      return kvs.cata({
        Get: function(str, cont) {
          return pureObject(cont(store[str]), store);
        },
        Put: function(str, val, cont) {
          return pureObject(cont, R.assoc(str, val, store));
        },
        Del: function(str, cont) {
          return pureObject(cont, R.dissoc(str, store));
        },
      });
    },
  });
}

/*
  We can also interpret this in a mutable object context.
*/

function mutableObject(free, store) {
  return free.goCata({
    Get: function(str, cont) {
      return cont(store[str]);
    },
    Put: function(str, val, cont) {
      store[str] = val;
      return cont;
    },
    Del: function(str, cont) {
      delete store[str];
      return cont;
    },
  });
}

/*
  Now, if we write a script, we can use whatever interpreter we want.
*/
var script = modify('tommy', function(x) {
  return x.toLocaleUpperCase();
}).chain(function(_) {
  return get('tommy');
});

console.log(pureObject(script, {tommy: 'howdy', tammy: 'aloha'}));

var obj = {tommy: 'howdy', tammy: 'aloha'};
console.log('%s', mutableObject(script, obj));
console.log(obj);
