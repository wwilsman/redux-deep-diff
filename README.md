# Redux Deep Diff
[![npm version](https://badge.fury.io/js/redux-deep-diff.svg)](https://www.npmjs.com/package/redux-deep-diff)
[![Build Status](https://travis-ci.org/wwilsman/redux-deep-diff.svg?branch=master)](https://travis-ci.org/wwilsman/redux-deep-diff)

[deep-diff](https://github.com/flitbit/diff) for tracking structural
differences between objects in redux state containers

Also with undo/redo functionality!

## Installation

``` shell
$ yarn add redux-deep-diff
```

## API

`redux-deep-diff` is a reducer enhancer (higher-order reducer), it provides the
diff function, which takes an existing reducer and a configuration object and
enhances your existing reducer with deep-diff functionality.

_**Note:** the `deep-diff` library calculates structural changes between two
javascript objects. As such, your state **must** be a diffable object._

To use `redux-deep-diff`, first import it, then add the diff enhancer to your
reducer(s) like so:

``` javascript
import { combineReducers } from 'redux';

// redux-deep-diff higher-order reducer
import diff from 'redux-deep-diff';

// `counter` state must be a diffable object
// e.i. state.counter = { count: 1 }
export default combineReducers({
  counter: diff(counter, /* [config] */)
})
```

To configure how `diff` enchances your reducers, see the
possible [configuration options](#reducer-options) below.

### Diff API

Wrapping your reducer with `diff` adds a diff leaf to your state:

``` javascript
{
  diff: {
    prev: [...previousDiffs],
    next: [...futureDiffs]
  }
}
```

Each diff in the history is an array of changes. See
[deep-diff's differences documentation](https://github.com/flitbit/diff#differences)
for more info on change records.

### Dispatching `undo` & `redo` actions

Since `redux-deep-diff` _tracks_ changes to your state, you can undo & redo
the diffs in your history.

``` javascript
import { undo, redo, jump } from 'redux-deep-diff';

store.dispatch(undo()); // revert the previous diff
store.dispatch(redo()); // apply the next diff

store.dispatch(jump(-3)); // revert the previous three diffs
store.dispatch(jump(2)); // apply the next two diffs
```

### Dispatching `clear` action

``` javascript
import { clear } from 'redux-deep-diff';

store.dispatch(clear()); // clear the history
```

### Deducing state history

To access previous values of the state, `redux-deep-diff` has a concept of
`deducers` which are similar to selectors in that you create a `deducer` and use
it to calculate ("deduce") part of your state's history.

``` javascript
import { createDeducer } from 'redux-deep-diff';

const countSelector = (counter) => counter.count;
const getCountHistory = createDeducer(countSelector, /* [config] */);

// `state.counter` must countain a diff history leaf
getCountHistory(state.counter); //=> [0, 1, 2, 3, 2, ...]
```

To configure how a `deducer`  determines which diffs to deduce, see the
possible [configuration options](#deducer-options) below.

Similarly to selectors, `deducers` are also memoized and not only memoize their
return value, but the return value of the selector for each set of changes in
the diff history. When the diff history changes, `deducers` will only call the
selector with states it hasn't yet deduced.

``` javascript
store.dispatch(increment());
let a = getCountHistory(store.getState());
//=> [0, 1] `countSelector` was called twice

store.dispatch(increment());
store.dispatch(increment());
store.dispatch(decrement());

let b = getCountHistory(store.getState());
//=> [0, 1, 2, 3, 2] `countSelector` was called three more times

// true even for values of objects/arrays
expect(a[0]).to.equal(b[0]);
expect(a[1]).to.equal(b[1]);

let c = getCountHistory(store.getState());
//=> [0, 1, 2, 3, 2] `countSelector` was not called

// when no changes are made, the same results are returned
expect(b).to.equal(c);
// ...but a new array is returned when values do change
expect(a).to.not.equal(b);
```

## Configuration options

Default values for the supported options are listed below

### Reducer options

``` javascript
{
  key: 'diff',                          // key to store the state diffs
  limit: 0,                             // diff history limit
  undoType: '@@redux-deep-diff/UNDO',   // custom undo action type
  redoType: '@@redux-deep-diff/REDO',   // custom redo action type
  jumpType: '@@redux-deep-diff/JUMP',   // custom jump action type
  clearType: '@@redux-deep-diff/CLEAR',   // custom clear action type
  skipAction: (action) => false,        // return true to skip diffing the state for this action
  initialState: { prev: [], next: [] }, // initial diff history state
  ignoreInit: true,                     // includes the first state when `false`
  prefilter: (path, key) => false,      // (see below)
  flatten: (path, key) => false         // (see below)
}
```

#### prefilter(path, key)

See `deep-diff`'s [prefilter argument](https://github.com/flitbit/diff#pre-filtering-object-properties).

#### flatten(path, key)

Similar to `prefilter`, `flatten` should return a truthy value for any path-key
combination that should be _flattened_. That is: `deep-diff` will not do any
further analysis on the object-property path, _but the resulting value of the
change will be the value located at the flattened path._

``` javascript
let flatten = (path, key) => key === 'nested';

/* ...reducer setup... */

expect(state.nested).to.deep.equal({ some: 'property' })
expect(change.path).to.deep.equal(['nested']);
expect(change.lhs).to.deep.equal({ some: 'prev-property' });
expect(change.rhs).to.deep.equal({ some: 'property' });
```

### Deducer options

``` javascript
{
  key: 'diff',   // key to retrieve the state diffs
  next: false,   // deduce from `diff.next` when `true` (future history)
  unique: false, // skip equal results that immediately follow each other
  index: false,  // the index of a single state in the history to deduce
  range: false,  // a range of history states to deduce - `[lower, upper]`
  limit: false   // limit the deducer to a specified length
}
```

_**Important:** `index`, `range`, and `limit` may not be used in conjuction. If
they are used together, precedence will be taken in that order and a warning
will be logged._

## License

MIT, see `LICENSE.md` for more info.
