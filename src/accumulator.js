import { diff } from 'deep-diff';

class DiffEdit {
  constructor(path, lhs, rhs) {
    this.type = 'E';
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

  constructor({ flatten, prefilter }) {
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

  isFlattened(path) {
    return this._flattened.some((done) => (
      done.every((k, i) => path[i] === k)
    ));
  }

  getSubject(target, path) {
    return typeof target !== 'object' ? null
      : path.reduce((value, key) => (
        typeof !value === 'undefined' ? value : value[key]
      ), target);
  }

  push(diff) {
    const flatten = this.flatten(diff);
    const flatPath = Array.isArray(flatten) ? flatten : diff.path;
    const isFlattened = flatten && this.isFlattened(flatPath);

    if (flatten && !isFlattened) {
      const lhs = this.getSubject(this.lhs, flatPath);
      const rhs = this.getSubject(this.rhs, flatPath);
      this.diffs.push(new DiffEdit(flatPath, lhs, rhs));
      this.flattened.push(flatPath);
    } else if (!isFlattened) {
      this.diffs.push(diff);
    }
  }
}
