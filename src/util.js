import { revertChange, applyChange } from 'deep-diff';

function doChanges(applyOrRevertChange, target, changes = []) {
  for (let i = 0, l = changes.length; i < l; i++) {
    // second argument to applyChange/revertChange is unused
    applyOrRevertChange(target, target, changes[i]);
  }

  return target;
}

function doDiffs(applyOrRevertChange, target, diffs = []) {
  for (let i = 0, l = diffs.length; i < l; i++) {
    doChanges(applyOrRevertChange, target, diffs[i]);
  }

  return target;
}

export const applyChanges = doChanges.bind(null, applyChange);
export const applyDiffs = doDiffs.bind(null, applyChange);
export const revertChanges = doChanges.bind(null, revertChange);
export const revertDiffs = doDiffs.bind(null, revertChange);
