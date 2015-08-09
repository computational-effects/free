'use strict';

var pbp = require('pbp');
var mixins = require('ce-mixin').mixins;
var Catamorphism = require('ce-catamorphism').Catamorphism;
var Stringify = require('ce-stringify').Stringify;
var Unit = require('ce-unit').Unit;
var R = require('ramda');

var value = pbp.value;
var enumerableGet = pbp.enumerableGet;
var enumerableValue = pbp.enumerableValue;

var FreeDerive = require('../../').FreeDerive;

/*
  We'd like to model the response side of an http server.

  Let's say that we want to be able to:
  1. add a header
  2. remove a header
  3. set the status code
  4. set the body

  We're going to want four primitives in this language.
*/

var Response = mixins([Catamorphism, FreeDerive, Stringify],
  Object.create(null)
);

function AddHeader(header, val, cont) {
  return Object.create(Response, {
    type: value('AddHeader'),
    args: value([header, val, cont]),
    ctor: value(AddHeader),
    map: enumerableValue(function(f) {
      return AddHeader(header, val, f(cont));
    }),
  });
}

function RemoveHeader(header, cont) {
  return Object.create(Response, {
    type: value('RemoveHeader'),
    args: value([header, cont]),
    ctor: value(RemoveHeader),
    map: enumerableValue(function(f) {
      return RemoveHeader(header, f(cont));
    }),
  });
}

function StatusCode(code, cont) {
  return Object.create(Response, {
    type: value('StatusCode'),
    args: value([code, cont]),
    ctor: value(StatusCode),
    map: enumerableValue(function(f) {
      return StatusCode(code, f(cont));
    }),
  });
}

function Body(body, cont) {
  return Object.create(Response, {
    type: value('Body'),
    args: value([body, cont]),
    ctor: value(Body),
    map: enumerableValue(function(f) {
      return Body(body, f(cont));
    }),
  });
}

function addHeader(header, val) {
  return AddHeader(header, val, Unit).liftF;
}

function removeHeader(header) {
  return RemoveHeader(header, Unit).liftF;
}

function statusCode(code) {
  return StatusCode(code, Unit).liftF;
}

function body(body) {
  return Body(body, Unit).liftF;
}

var headers = R.lensProp('headers');

/*
  We should be able to interpret responses in a plain immutable object context.
  This could be useful for unit testing purposes.
*/
function pureObject(free, res) {
  return free.cataConst(res, {
    AddHeader: function(header, val, cont) {
      return pureObject(cont, R.over(headers, R.assoc(header, val), res));
    },
    RemoveHeader: function(header, cont) {
      return pureObject(cont, R.over(headers, R.dissoc(header), res));
    },
    StatusCode: function(code, cont) {
      return pureObject(cont, R.set(R.lensProp('statusCode'), code, res));
    },
    Body: function(content, cont) {
      return pureObject(cont, R.set(R.lensProp('body'), content, res));
    },
  });
}

/*
  Now, let's define a default response object.
*/
var responseObj = {
  headers: {},
  statusCode: 0,
  body: '',
};

var script = body('Hello World!')
  .seq(statusCode(200))
  .seq(addHeader('Content-Type', 'text/plain'))
  .seq(addHeader('Origin', 'http://www.example.com'));

/*
  If we realize we want to return json instead,
  we can build on the previous script without destroying it
  (assuming a pure interpreter).
*/
var script2 = script
  .seq(removeHeader('Content-Type'))
  .seq(addHeader('Content-Type', 'application/json'))
  .seq(body(JSON.stringify({text: 'Hello World!'})));

console.log(pureObject(script, responseObj));
console.log(pureObject(script2, responseObj));

/*
  We can build up the dsl a bit.
*/
var status = {
  ok: statusCode(200),
  created: statusCode(201),
  notFound: statusCode(404),
  internalError: statusCode(500),
};

function replaceHeader(header, val) {
  return removeHeader(header)
    .seq(addHeader(header, val));
}

function plainText(text) {
  return replaceHeader('Content-Type', 'text/plain')
    .seq(body(text));
}

function json(obj) {
  return replaceHeader('Content-Type', 'application/json')
    .seq(body(JSON.stringify(obj)));
}

/*
  Now, we can write the json script just a bit simpler.
*/
var script3 = script
  .seq(json({text: 'Hello World!'}));

console.log(pureObject(script3, responseObj));

/*
  What's more,
  we can check to see if these two scripts generate the same response.
*/

var responseObj2 = pureObject(script2, responseObj);
var responseObj3 = pureObject(script3, responseObj);
console.log(R.equals(responseObj2, responseObj3));
