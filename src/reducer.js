import {
  applyChanges,
  applyDiffs,
  revertChanges,
  revertDiffs
} from './util';
import {
  UNDO,
  REDO,
  JUMP
} from './actions';
import DiffAccumulator from './accumulator';

function addHistory(history, addition) {
  return addition.length === 0 ? history : {
    prev: [addition, ...history.prev],
    next: []
  };
}

function undoHistory(history) {
  return jumpThroughHistory(history, -1);
}

function redoHistory(history) {
  return jumpThroughHistory(history, 1);
}

function jumpThroughHistory(history, index) {
  if (history && index < 0) {
    index = Math.min(history.prev.length, Math.abs(index));

    return {
      prev: history.prev.slice(index),
      next: [...history.prev.slice(0, index).reverse(), ...history.next]
    };
  } else if (history && index > 0) {
    index = Math.min(history.next.length, index);

    return {
      prev: [...history.next.slice(0, index).reverse(), ...history.prev],
      next: history.next.slice(index)
    };
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

function handleHistoryActions(actionHandlers, { key, defaultAction, reducer }) {
  const { [defaultAction]: defaultHandler } = actionHandlers;

  return (rawState, action) => {
    let { [action.type]: actionHandler } = actionHandlers;
    let { [key]: history, ...lhs } = (rawState || {});
    actionHandler = actionHandler || defaultHandler;
    lhs = rawState ? lhs : rawState;

    const rhs = reducer(lhs, action);
    const nextState = { ...(rhs || {}), [key]: history };

    return actionHandler
      ? actionHandler(history, lhs, rhs, action) || nextState
      : nextState;
  };
}

export default (reducer, config = {}) => {
  const defaultAction = '@@redux-deep-diff/DEFAULT';

  const {
    key = 'diff',
    undoType = UNDO,
    redoType = REDO,
    jumpType = JUMP,
    skipAction = () => false,
    initialState = { prev: [], next: [] },
    ignoreInit = true,
    flatten = () => false,
    prefilter = () => false
  } = config;

  const accum = new DiffAccumulator({ flatten, prefilter });
  const diff = accum.diff.bind(accum);

  return handleHistoryActions({
    [undoType]: (history, lhs) => ({
      ...revertChanges(lhs, history.prev[0]),
      [key]: undoHistory(history)
    }),

    [redoType]: (history, lhs) => ({
      ...applyChanges(lhs, history.next[0]),
      [key]: redoHistory(history)
    }),

    [jumpType]: (history, lhs, rhs, { index }) => {
      const slice = getHistorySlice(history, index);

      return {
        ...(index > 0
          ? applyDiffs(rhs, slice)
          : revertDiffs(rhs, slice)),
        [key]: jumpThroughHistory(history, index)
      };
    },

    [defaultAction]: (history, lhs, rhs, action) => {
      const changes = (history || !ignoreInit) ? diff(lhs, rhs) : [];
      history = history || initialState;

      return skipAction(action) || {
        ...rhs,
        [key]: changes.length > 0
          ? addHistory(history, changes)
          : history
      };
    }
  }, { key, defaultAction, reducer });
};
