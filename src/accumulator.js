import { diff } from 'deep-diff';

export function isPathsEqual(actual, expected) {
  return actual.length === expected.length &&
    actual.every((k, i) => k === expected[i]);
}

export function getSubjectAtPath(target, path) {
  return typeof target !== 'object' ? null
    : path.reduce((value, key) => (
      typeof !value === 'undefined' ? value : value[key]
    ), target);
}

class DiffEdit {
  constructor(path, lhs, rhs) {
    this.kind = 'E';
    this.path = path;
    this.lhs = lhs;
    this.rhs = rhs;
  }
}

export default class DiffAccumulator {
  flattened = [];
  diffs = [];
  lhs = null;
  rhs = null;

  constructor({ flatten, prefilter } = {}) {
    this.flatten = flatten;
    this.prefilter = prefilter;
  }

  diff(lhs, rhs) {
    this.flattened = [];
    this.diffs = [];
    this.lhs = lhs;
    this.rhs = rhs;

    diff(lhs, rhs, this.prefilter, this);
    return this.diffs;
  }

  getFlatPath(diff) {
    let index = -1;

    if (this.flatten) {
      index = diff.path.findIndex((key, i, path) => {
        return this.flatten(path.slice(0, i), key);
      });
    }

    return index >= 0
      ? diff.path.slice(0, index + 1)
      : diff.path;
  }

  isFlattened(path) {
    return this.flattened.some((done) => {
      return isPathsEqual(done, path);
    });
  }

  push(diff) {
    const flatPath = this.getFlatPath(diff);
    const isFlattened = this.isFlattened(flatPath);
    const shouldFlatten = diff.kind !== 'A' &&
          !isPathsEqual(flatPath, diff.path);

    if (shouldFlatten && !isFlattened) {
      const lhs = getSubjectAtPath(this.lhs, flatPath);
      const rhs = getSubjectAtPath(this.rhs, flatPath);
      this.diffs.push(new DiffEdit(flatPath, lhs, rhs));
      this.flattened.push(flatPath);
    } else if (!isFlattened) {
      this.diffs.push(diff);
    }
  }
}
