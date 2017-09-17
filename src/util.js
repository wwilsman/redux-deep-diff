import { revertChange, applyChange } from 'deep-diff';
import cloneDeep from 'clone-deep';

function doChanges(applyOrRevertChange, source, diff = []) {
  return diff.reduce((target, change) => {
    // second argument to applyChange/revertChange is unused
    applyOrRevertChange(target, target, change);
    return target;
  }, cloneDeep(source));
}

function doDiffs(applyOrRevertChanges, source, diffs = []) {
  return diffs.reduce(applyOrRevertChanges, source);
}

export const applyChanges = doChanges.bind(null, applyChange);
export const applyDiffs = doDiffs.bind(null, applyChanges);
export const revertChanges = doChanges.bind(null, revertChange);
export const revertDiffs = doDiffs.bind(null, revertChanges);
