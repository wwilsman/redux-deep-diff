import { diff } from 'deep-diff';

function isPathsEqual(actual, expected) {
  return actual.length === expected.length &&
    actual.every((k, i) => k === expected[i]);
}

function getSubjectAtPath(target, path) {
  return typeof target !== 'object' ? null
    : path.reduce((value, key) => (
      typeof !value === 'undefined' ? value : value[key]
    ), target);
}

function mergeDiffs(a, b) {
  let merged = {};

  if (a.lhs !== b.rhs) {
    if (a.kind === 'A' || b.kind === 'A') {
      let item = mergeDiffs(
        a.kind === 'A' ? a.item : { kind: a.kind, lhs: a.lhs },
        b.kind === 'A' ? b.item : { kind: b.kind, rhs: b.rhs }
      );

      if (item && item.kind) {
        merged = a.kind === 'A' ? { ...a, item } : { ...b, item };
      }
    } else if (a.kind !== 'D' && b.kind === 'E') {
      merged = { ...a, rhs: b.rhs };
    } else if (a.kind === 'D' && b.kind !== 'D') {
      merged = { kind: 'E', path: a.path, lhs: a.lhs, rhs: b.rhs };
    } else if (a.kind !== 'D' && b.kind === 'D') {
      merged = { kind: 'D', path: a.path, lhs: a.lhs };
    } else {
      return;
    }
  }

  return merged;
}

export default class DiffAccumulator {
  flattened = [];
  diffs = [];
  lhs = null;
  rhs = null;

  constructor({ flatten, prefilter } = {}) {
    this.opts = { flatten, prefilter };
  }

  prefilter = (path, key) => {
    if (this.isFlattened([...path, key])) {
      return true;
    } else if (this.opts.prefilter) {
      return this.opts.prefilter(path, key);
    } else {
      return false;
    }
  };

  diff(lhs, rhs) {
    this.flattened = [];
    this.lhs = lhs;
    this.rhs = rhs;

    diff(lhs, rhs, this.prefilter, this);
    return this.diffs;
  }

  clear() {
    this.diffs = [];
  }

  getFlatPath(diff) {
    let index = -1;

    if (this.opts.flatten) {
      index = diff.path.findIndex((key, i, path) => {
        return this.opts.flatten(path.slice(0, i), key);
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

  addDiff(diff) {
    let existingIndex = this.diffs.findIndex((d) => {
      let pathA = diff.kind === 'A' ? [...diff.path, diff.index] : diff.path;
      let pathB = d.kind === 'A' ? [...d.path, d.index] : d.path;
      return isPathsEqual(pathA, pathB);
    });

    if (diff.item) {
      diff.item = { ...diff.item };
    }

    if (existingIndex > -1) {
      let merged = mergeDiffs(this.diffs[existingIndex], diff);

      if (merged && !merged.kind) {
        this.diffs.splice(existingIndex, 1);
      } else if (merged) {
        this.diffs.splice(existingIndex, 1, merged);
      }
    } else {
      this.diffs.push(diff);
    }
  }

  push(diff) {
    let flatPath = this.getFlatPath(diff);
    if (this.isFlattened(flatPath)) return;

    if (diff.kind !== 'A' && !isPathsEqual(flatPath, diff.path)) {
      const lhs = getSubjectAtPath(this.lhs, flatPath);
      const rhs = getSubjectAtPath(this.rhs, flatPath);
      this.addDiff({ kind: 'E', path: flatPath, lhs, rhs });
      this.flattened.push(flatPath);
    } else {
      this.addDiff({ ...diff });
    }
  }
}
