'use strict';

var pbp = require('pbp');
var sum = require('ce-sum');
var mixin = require('ce-mixin').mixin;

var enumerableGet = pbp.enumerableGet;
var enumerableValue = pbp.enumerableValue;
var value = pbp.value;

function underlying(func) {
  return function(y) {
    return this.ctor.apply(this, this.args.map(function(x) {
      return x.map(function(free) {
        return free[func](y);
      });
    }));
  };
};

var Free = Object.create(sum.Either, {
  of: enumerableValue(Of),
  goCata: enumerableValue(function(obj) {
    return this.go(function(x) {
      return x.cata(obj);
    });
  }),
  cataConst: enumerableValue(function(result, obj) {
    return this.cata({
      Of: function(_) { return result; },
      Join: function(x) { return x.cata(obj); },
    });
  }),
  seq: enumerableValue(function(x) {
    return this.chain(function(_) { return x;});
  }),
});

function Of(x) {
  return mixin(sum.Right(x), Object.create(Free, {
    type: value('Of'),
    args: value([x]),
    ctor: value(Of),
    go: enumerableValue(function(_) {
      return x;
    }),
  }));
};

function Join(x) {
  return Object.create(Free, {
    type: value('Join'),
    args: value([x]),
    ctor: value(Join),
    map: enumerableValue(underlying('map')),
    ap: enumerableValue(underlying('ap')),
    chain: enumerableValue(underlying('chain')),
    go: enumerableValue(function(f) {
      return f(x).go(f);
    }),
  });
};

var FreeDerive = Object.create(null, {
  liftF: enumerableGet(function() {
    return liftF(this);
  }),
});

function go(f, free) {
  return free.go(f);
}

function goCata(obj, free) {
  return free.goCata(obj);
}

function liftF(f) {
  return Join(f.map(Of));
}

module.exports = {
  Free: Free,
  FreeDerive: FreeDerive,
  go: go,
  goCata: goCata,
  Join: Join,
  liftF: liftF,
  Of: Of,
};
