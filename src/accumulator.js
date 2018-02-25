import deepDiff from 'deep-diff';
const { diff } = deepDiff;

/**
 * Returns true when two arrays of keys are equal
 * @param {[String]} actual - array of keys
 * @param {[String]} expected - array of expected keys
 * @returns {Boolean}
 */
function isPathsEqual(actual, expected) {
  return actual.length === expected.length &&
    actual.every((k, i) => k === expected[i]);
}

/**
 * Returns the value at the specified path in the target objecgt
 * @param {Object} target - target object
 * @param {[String]} path - array of nested keys
 * @returns {Mixed} value at the specified path
 */
function getSubjectAtPath(target, path) {
  return typeof target !== 'object' ? null
    : path.reduce((value, key) => (
      typeof !value === 'undefined' ? value : value[key]
    ), target);
}

/**
 * Merges two `deep-diff` change objects as POJOs
 * @param {Object} a - first change to merge
 * @param {Object} b - second change to merge
 * @returns {Object} a new, merged change
 */
function mergeChanges(a, b) {
  // if an empty object is returned, there is no change
  let merged = {};

  // these changes would cancel out otherwise
  if (a.lhs !== b.rhs) {
    // arrays need their items merged
    if (a.kind === 'A' || b.kind === 'A') {
      let item = mergeChanges(
        a.kind === 'A' ? a.item : { kind: a.kind, lhs: a.lhs },
        b.kind === 'A' ? b.item : { kind: b.kind, rhs: b.rhs }
      );

      // items would cancel out otherwise
      if (item && item.kind) {
        // if `a` wasn't the array, `b` was
        merged = a.kind === 'A' ? { ...a, item } : { ...b, item };
      }
    // if `b` was an edit and `a` was an addition, keep `a`
    } else if (a.kind !== 'D' && b.kind === 'E') {
      merged = { ...a, rhs: b.rhs };
    // if `a` was a delete and `b` isn't, it was an edit
    } else if (a.kind === 'D' && b.kind !== 'D') {
      merged = { kind: 'E', path: a.path, lhs: a.lhs, rhs: b.rhs };
    // if `a` wasn't a delete, but `b` was, keep `b`
    } else if (a.kind !== 'D' && b.kind === 'D') {
      merged = { ...b, lhs: a.lhs };
    // unhandled shouldn't be added to the diff
    } else {
      return;
    }
  }

  return merged;
}

/**
 * A diff accumulator is simply something that implements `.push()`
 *
 * This diff accumulator will flatten changes that match the `filter`
 * option. It will also automatically add those flattened changes to the
 * `prefilter` argument to prevent `deep-diff` from doing any further
 * analysis on the flattened object-property path.
 */
export default class DiffAccumulator {
  flattened = [];
  changes = [];
  lhs = null;
  rhs = null;

  /**
   * @constructor
   * @param {Function} flatten - matches changes that should be flattened
   * @param {Function} prefilter - matches changes that should not be analyzed
   */
  constructor({ flatten, prefilter } = {}) {
    this.opts = { flatten, prefilter };
  }

  /**
   * Wrap the `prefilter` option to also filter flattened changes
   * @param {[String]} path - object-property path
   * @param {String} key - current key to filter
   * @returns {Boolean} `true` to filter, `false` otherwise
   */
  prefilter = (path, key) => {
    if (this.isFlattened([...path, key])) {
      return true;
    } else if (this.opts.prefilter) {
      return this.opts.prefilter(path, key);
    } else {
      return false;
    }
  };

  /**
   * Calculates the structural difference between two object, passing
   * this instance as the accumulator
   * @param {Object} lhs - left hand side assignment
   * @param {Object} rhs - right hand side aassignment
   * @returns {Array} the accumulated changes
   */
  diff(lhs, rhs) {
    this.flattened = [];
    this.lhs = lhs;
    this.rhs = rhs;

    diff(lhs, rhs, this.prefilter, this);
    return this.changes;
  }

  /**
   * Clears the current accumulated diffs
   */
  clear() {
    this.changes = [];
  }

  /**
   * If the path of the change should be flattened, this method
   * returns the flattened path
   * @param {Object} change - `deep-diff` change object
   * @returns {[String]} the path of the flattened change
   */
  getFlatPath(change) {
    let index = -1;

    if (this.opts.flatten) {
      index = change.path.findIndex((key, i, path) => {
        return this.opts.flatten(path.slice(0, i), key);
      });
    }

    return index >= 0
      ? change.path.slice(0, index + 1)
      : change.path;
  }

  /**
   * Returns `true` if the path or any parent path was flattened,
   * 'false' otherwise
   * @param {[String]} path - path to check
   * @returns {Boolean} `true` if any parent path was flattend
   */
  isFlattened(path) {
    return this.flattened.some((done) => {
      return isPathsEqual(done, path);
    });
  }

  /**
   * Pushes a POJO change to the diff array, maybe merging previous changes
   * @param {Object} change - `deep-diff` change object
   */
  addChange(change) {
    let existingIndex = this.changes.findIndex((c) => {
      // array paths should include the index when comparing across changes
      let pathA = change.kind === 'A' ? [...change.path, change.index] : change.path;
      let pathB = c.kind === 'A' ? [...c.path, c.index] : c.path;
      return isPathsEqual(pathA, pathB);
    });

    // ensure change is a POJO
    if (change.item) {
      change = { ...change, item: { ...change.item } };
    } else {
      change = { ...change };
    }

    // merge existing changes
    if (existingIndex > -1) {
      let merged = mergeChanges(this.changes[existingIndex], change);

      // remove the change if `merged` is empty
      if (merged && !merged.kind) {
        this.changes.splice(existingIndex, 1);
      } else if (merged) {
        this.changes.splice(existingIndex, 1, merged);
      }
    } else {
      this.changes.push(change);
    }
  }

  /**
   * Handles how changes are pushed to the diff. Will push flattened
   * changes when neccesary
   * @param {Object} change - `deep-diff` change object
   */
  push(change) {
    let flatPath = this.getFlatPath(change);
    if (this.isFlattened(flatPath)) return;

    // flatten non-array changes when the change path is deeper than
    // the potentially flattened path
    if (change.kind !== 'A' && !isPathsEqual(flatPath, change.path)) {
      const lhs = getSubjectAtPath(this.lhs, flatPath);
      const rhs = getSubjectAtPath(this.rhs, flatPath);
      this.addChange({ kind: 'E', path: flatPath, lhs, rhs });
      this.flattened.push(flatPath);
    } else {
      this.addChange(change);
    }
  }
}
