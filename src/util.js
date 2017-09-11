import { revertChange, applyChange } from 'deep-diff';
import cloneDeep from 'clone-deep';
import DiffAccumulator from './accumulator';

export function makeDiffer(options) {
  const accum = new DiffAccumulator(options);
  return accum.diff.bind(accum);
};

export const applyChanges = doChanges.bind(null, applyChange);
export const applyDiffs = doDiffs.bind(null, applyChanges);
export const revertChanges = doChanges.bind(null, revertChange);
export const revertDiffs = doDiffs.bind(null, revertChanges);

function doChanges(applyOrRevertChange, source, diff) {
  return diff.reduce((target, change) => {
    applyOrRevertChange(target, target, change);
    return target;
  }, cloneDeep(source));
}

function doDiffs(applyOrRevertChanges, source, diffs) {
  return diffs.reduce(applyOrRevertChanges, source);
}

export function addHistory(history, addition) {
  return {
    prev: history.last.length > 0
      ? [history.last, ...history.prev]
      : history.prev,
    last: addition,
    next: []
  };
}

export function undoHistory(history) {
  return jumpThroughHistory(history, -1);
}

export function redoHistory(history) {
  return jumpThroughHistory(history, 1);
}

export function jumpThroughHistory(history, index) {
  if (history && index < 0) {
    index = Math.min(history.prev.length + 1, Math.abs(index));

    return {
      prev: history.prev.slice(index),
      last: history.prev[index - 1] || [],
      next: [
        ...(index > 1 ? history.prev.slice(0, index - 1).reverse() : []),
        ...(history.last.length ? [history.last, ...history.next] : history.next)
      ]
    };
  } else if (history && index > 0) {
    index = Math.min(history.next.length, index);

    return {
      prev: [
        ...(index > 1 ? history.next.slice(0, index - 1).reverse() : []),
        ...(history.last.length ? [history.last, ...history.prev] : history.prev)
      ],
      last: history.next[index - 1] || [],
      next: history.next.slice(index)
    };
  } else {
    return history;
  }
}

export function getHistorySlice(history, index) {
  if (index > 0) {
    return history.next.slice(0, index);
  } else if (index < -1) {
    return history.last.length
      ? [history.last, ...history.prev.slice(0, Math.abs(index) - 1)]
      : history.prev.slice(0, Math.abs(index));
  } else if (index === -1) {
    return [history.last];
  } else {
    return [];
  }
}

export function handleHistoryActions(actionHandlers, { key, defaultAction, reducer }) {
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
