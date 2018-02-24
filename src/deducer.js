import clone from 'clone-deep';
import { applyChanges, revertChanges } from './util';

/**
 * Creates a function which is then able to deduce the state history
 * from a state containing a diff leaf
 * @param {Function} selector - given the arguments provided to the
 * resulting deducer, should return a desired part of the state
 * @param {Object} config - configuration object
 * @returns {Function} the deducer function
 */
export default function createDeducer(selector, config = {}) {
  const {
    key = 'diff',
    next = false,
    unique = false,
    index = false,
    range = false,
    limit = false
  } = config;

  if ((index !== false && (range || limit)) || (range && limit)) {
    console.warn('index, range, or limit should not be combined');
  }

  let makeChanges = next ? applyChanges : revertChanges;

  /**
   * Deduces the state history from a state containing a diff leaf.
   * Any additional arguments will be passed along to the `selector`
   * function
   * @param {Object} rawState - a state which contains a diff leaf
   * @returns {Array} an array containing the selected state history
   * @throws {Error} when the diff leaf cannot be found
   */
  let deducer = function deducer(rawState, ...args) {
    let { [key]: history, ...state } = rawState;

    // ensure we don't modify state while dealing with changes
    state = clone(state);

    if (!history || !(history.prev && history.next)) {
      throw new Error(`"${key}" is not a diff history object`);
    }

    let diffs = next ? history.next : history.prev;

    // return from the cache if the diffs haven't changed
    if (deducer.cache.self) {
      let [cached, result] = deducer.cache.self;
      if (diffs === cached) return result;
    }

    // normalize `range` and `limit` to lower and upper bounds
    let length = diffs.length;
    let [lower, upper] = range || [0, (limit || length) - 1];
    // clamp the boundaries by the `index` or the diff length
    lower = index !== false ? index : Math.max(lower, 0);
    upper = index !== false ? index : Math.min(upper, length - 1);

    let deduced = [];

    for (let i = 0; i <= length; i++) {
      // make changes every time so previous/later states remain
      // accurate to the diff
      makeChanges(state, diffs[i]);

      // if we're outside the boundaries, don't do anything else
      if (i < lower || i > upper) continue;

      // initially load from the cache
      let cacheId = i - length;
      let [cached, result] = deducer.cache[cacheId] || [];

      // if the diff has changed, get the selected value and cache it
      if (!cached || diffs[i] !== cached) {
        result = selector(state, ...args);
        deducer.cache[cacheId] = [diffs[i], result];
      }

      // skip results that follow each other
      if (unique) {
        let last = next ? deduced[deduced.length - 1] : deduced[0];
        if (result === last) continue;
      }

      // push, unshift, or return the deduced result
      if (index === false) {
        if (next) {
          deduced.push(result);
        } else {
          deduced.unshift(result);
        }
      } else if (i === index) {
        return result;
      }
    }

    // if the index never returned a result, we haven't deduced anything
    deduced = index === false ? deduced : null;
    // cache the deducers results
    deducer.cache.self = [diffs, deduced];
    return deduced;
  };

  deducer.cache = {};
  return deducer;
}
