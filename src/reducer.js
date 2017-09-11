import {
  makeDiffer,
  applyChanges,
  applyDiffs,
  revertChanges,
  revertDiffs,
  addHistory,
  undoHistory,
  redoHistory,
  jumpThroughHistory,
  getHistorySlice,
  handleHistoryActions
} from './util';
import {
  UNDO,
  REDO,
  JUMP
} from './actions';

export default (reducer, config = {}) => {
  const defaultAction = '@@redux-deep-diff/DEFAULT';

  const {
    key = 'diff',
    undoType = UNDO,
    redoType = REDO,
    jumpType = JUMP,
    skipAction = () => false,
    initialState = { prev: [], last: [], next: [] },
    ignoreInit = true,
    flatten = () => false,
    prefilter = () => false
  } = config;

  const diff = makeDiffer({
    flatten,
    prefilter
  });

  return handleHistoryActions({
    [undoType]: (history, lhs) => ({
      ...revertChanges(lhs, history.last),
      [key]: undoHistory(history)
    }),

    [redoType]: (history, lhs) => ({
      ...applyChanges(lhs, history.next[0] || []),
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
