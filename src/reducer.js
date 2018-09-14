import clone from 'clone-deep';
import DiffAccumulator from './accumulator';
import { UNDO, REDO, JUMP, CLEAR } from './actions';
import {
  applyChanges,
  applyDiffs,
  revertChanges,
  revertDiffs
} from './util';

/**
 * Immutably prepends a new diff to the history's previous diffs
 * @param {Object} history - diff history
 * @param {Array} addition - new diff
 * @returns {Object} new diff history object
 */
function addToHistory(history, addition) {
  return addition.length === 0 ? history : {
    ...history,
    prev: [addition, ...history.prev]
      .slice(0, history.limit || history.prev.length + 1),
    next: []
  };
}

/**
 * Immutably moves previous diff history to the next diff history, optionally by
 * an offset
 * @param {Object} history - diff history
 * @param {Number} offset - amount of diffs to move
 * @returns {Object} new diff history object
 */
function jumpToPrevHistory(history, offset = 1) {
  offset = Math.min(history.prev.length, offset);

  return {
    ...history,
    prev: history.prev.slice(offset),
    next: [...history.prev.slice(0, offset).reverse(), ...history.next]
      .slice(0, history.limit || history.next.length + offset)
  };
}

/**
 * Immutably moves the next diff distory to the previous diff history,
 * optionally by an offset
 * @param {Object} history - diff history
 * @param {Number} offset - amount of diffs to move
 * @returns {Object} new diff history object
 */
function jumpToNextHistory(history, offset = 1) {
  offset = Math.min(history.next.length, offset);

  return {
    ...history,
    prev: [...history.next.slice(0, offset).reverse(), ...history.prev]
      .slice(0, history.limit || history.prev.length + offset),
    next: history.next.slice(offset)
  };
}

/**
 * Higher order reducer to track deep-diff states before and after each
 * action. Additonally will undo or redo the state when specific actions are
 * dispatched.
 * @param {Function} reducer - redux reducer
 * @param {Object} config - configuration object
 * @returns {Function} reduc reducer with a diff history leaf
 */
export default function diff(reducer, config = {}) {
  const {
    key = 'diff',
    limit = 0,
    undoType = UNDO,
    redoType = REDO,
    jumpType = JUMP,
    clearType = CLEAR,
    skipAction = () => false,
    initialState = { prev: [], next: [] },
    ignoreInit = true,
    flatten = () => false,
    prefilter = () => false
  } = config;

  // this will accumulate and merge diffs until `accum.clear()` is called
  let accum = new DiffAccumulator({ flatten, prefilter });

  return (rawState, action) => {
    let { [key]: history, ...state } = (rawState || {});
    history = history || { ...initialState, limit };

    let lhs = rawState && state;
    let rhs = reducer(lhs, action);
    let nextState = rhs || {};
    let changes, diffs;

    switch (action.type) {
      case undoType:
        nextState = revertChanges(clone(lhs), history.prev[0]);
        history = jumpToPrevHistory(history);
        break;

      case redoType:
        nextState = applyChanges(clone(lhs), history.next[0]);
        history = jumpToNextHistory(history);
        break;

      case jumpType:
        // apply a subset of previous diffs
        if (action.index < 0) {
          diffs = history.prev.slice(0, Math.abs(action.index));
          nextState = revertDiffs(clone(lhs), diffs);
          history = jumpToPrevHistory(history, Math.abs(action.index));

        // apply a subset of future diffs
        } else if (action.index > 0) {
          diffs = history.next.slice(0, Math.abs(action.index));
          nextState = applyDiffs(clone(lhs), diffs);
          history = jumpToNextHistory(history, action.index);
        }

        break;

      case clearType:
        history = { ...initialState, limit };
        accum.clear();
        break;

      default:
        // when `rawState` is undefined, chances are this is the very first time
        // this reduce has been called. We ignore this initial call by default,
        // otherwise it will generate a diff for each leaf in the entire state.
        changes = (rawState || !ignoreInit) ? accum.diff(lhs, rhs) : [];

        if (!skipAction(action)) {
          history = addToHistory(history, changes);
          accum.clear();
        }
    }

    return { ...nextState, [key]: history };
  };
};
