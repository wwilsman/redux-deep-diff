import clone from 'clone-deep';
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

export default (reducer, config = {}) => {
  const {
    key = 'diff',
    limit = 0,
    undoType = UNDO,
    redoType = REDO,
    jumpType = JUMP,
    skipAction = () => false,
    initialState = { prev: [], next: [] },
    ignoreInit = true,
    flatten = () => false,
    prefilter = () => false
  } = config;

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
        return { ...nextState, [key]: history };

      case redoType:
        nextState = applyChanges(clone(lhs), history.next[0]);
        history = jumpToNextHistory(history);
        return { ...nextState, [key]: history };

      case jumpType:
        if (action.index > 0) {
          diffs = history.next.slice(0, Math.abs(action.index));
          nextState = applyDiffs(clone(lhs), diffs);
        } else if (action.index < 0) {
          diffs = history.prev.slice(0, Math.abs(action.index));
          nextState = revertDiffs(clone(lhs), diffs);
        }

        history = jumpThroughHistory(history, action.index);
        return { ...nextState, [key]: history };

      default:
        changes = (rawState || !ignoreInit) ? accum.diff(lhs, rhs) : [];

        if (!skipAction(action)) {
          history = addToHistory(history, changes);
          accum.clear();
        }

        return { ...nextState, [key]: history };
    }
  };
};
