import { applyChange, revertChange } from 'deep-diff';

/**
 * Calls `applyChange` or `revertChange` on the target object for
 * each change
 * @param {Function} applyOrRevertChange - `applyChange` or `revertChange`
 * @param {Object} target - target object to apply changes to
 * @param {[Object]} changes - array of `deep-diff` change objects
 * @returns {Object} the given target
 */
function doChanges(applyOrRevertChange, target, changes = []) {
  for (let i = 0, l = changes.length; i < l; i++) {
    // second argument to applyChange/revertChange is unused
    applyOrRevertChange(target, target, changes[i]);
  }

  return target;
}

/**
 * Calls `applyChange` or `revertChange` on the target object for
 * each change in each diff
 * @param {Function} applyOrRevertChange - `applyChange` or `revertChange`
 * @param {Object} target - target object to apply changes to
 * @param {[Array]} changes - array of diffs each containing
 * `deep-diff` change objects
 * @returns {Object} the given target
 */
function doDiffs(applyOrRevertChange, target, diffs = []) {
  for (let i = 0, l = diffs.length; i < l; i++) {
    doChanges(applyOrRevertChange, target, diffs[i]);
  }

  return target;
}

// bind `applyChange` and `revertChange` to the functions above
export const applyChanges = doChanges.bind(null, applyChange);
export const applyDiffs = doDiffs.bind(null, applyChange);
export const revertChanges = doChanges.bind(null, revertChange);
export const revertDiffs = doDiffs.bind(null, revertChange);
