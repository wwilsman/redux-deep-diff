import DiffAccumulator from './accumulator';
import { UNDO, REDO, JUMP } from './actions';
import {
  applyChanges,
  applyDiffs,
  revertChanges,
  revertDiffs
} from './util';

function addToHistory(history, addition) {
  return addition.length === 0 ? history : {
    ...history,
    prev: [addition, ...history.prev]
      .slice(0, history.limit || history.prev.length + 1),
    next: []
  };
}

function jumpToPrevHistory(history, offset = 1) {
  offset = Math.min(history.prev.length, offset);

  return {
    ...history,
    prev: history.prev.slice(offset),
    next: [...history.prev.slice(0, offset).reverse(), ...history.next]
      .slice(0, history.limit || history.next.length + offset)
  };
}

function jumpToNextHistory(history, offset = 1) {
  offset = Math.min(history.next.length, offset);

  return {
    ...history,
    prev: [...history.next.slice(0, offset).reverse(), ...history.prev]
      .slice(0, history.limit || history.prev.length + offset),
    next: history.next.slice(offset)
  };
}

function jumpThroughHistory(history, index) {
  if (history && index < 0) {
    return jumpToPrevHistory(history, Math.abs(index));
  } else if (history && index > 0) {
    return jumpToNextHistory(history, index);
  } else {
    return history;
  }
}

function getHistorySlice(history, index) {
  if (index > 0) {
    return history.next.slice(0, index);
  } else if (index < 0) {
    return history.prev.slice(0, Math.abs(index));
  } else {
    return [];
  }
}

export default (reducer, config = {}) => {
  let {
    key = 'diff',
    limit = 0,
    undoType = UNDO,
    redoType = REDO,
    jumpType = JUMP,
    skipAction = () => false,
    initialState = { prev: [], next: [], limit },
    ignoreInit = true,
    flatten = () => false,
    prefilter = () => false
  } = config;

  let accum = new DiffAccumulator({ flatten, prefilter });

  return (rawState, action) => {
    let { [key]: history, ...state } = (rawState || {});
    history = history || initialState;

    let lhs = rawState && state;
    let rhs = reducer(lhs, action);
    let nextState = rhs || {};
    let changes, diffs;

    switch (action.type) {
      case undoType:
        nextState = revertChanges(lhs, history.prev[0]);
        return { ...nextState, [key]: jumpToPrevHistory(history) };

      case redoType:
        nextState = applyChanges(lhs, history.next[0]);
        return { ...nextState, [key]: jumpToNextHistory(history) };

      case jumpType:
        diffs = getHistorySlice(history, action.index);
        nextState = (action.index > 0 ? applyDiffs : revertDiffs)(rhs, diffs);
        return { ...nextState, [key]: jumpThroughHistory(history, action.index) };

      default:
        changes = (rawState || !ignoreInit) ? accum.diff(lhs, rhs) : [];

        if (!skipAction(action)) {
          accum.clear();
          return { ...nextState, [key]: addToHistory(history, changes) };
        } else {
          return { ...nextState, [key]: history };
        }
    }
  };
};
