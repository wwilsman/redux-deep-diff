import { applyChanges, revertChanges } from './util';

export default function createDeducer(selector, config = {}) {
  const {
    key = 'diff',
    next = false,
    index = false,
    range = false,
    limit = false
  } = config;

  if ((index !== false && (range || limit)) || (range && limit)) {
    console.warn('index, range, or limit should not be combined');
  }

  let makeChanges = next ? applyChanges : revertChanges;

  let deducer = function deducer(rawState, ...args) {
    let { [key]: history, ...state } = rawState;

    if (!history || !(history.prev && history.next)) {
      throw new Error(`"${key}" is not a diff history object`);
    }

    let diffs = next ? history.next : history.prev;

    if (deducer.cache.self) {
      let [cached, result] = deducer.cache.self;
      if (diffs === cached) return result;
    }

    let length = diffs.length;
    let [lower, upper] = range || [0, (limit || length) - 1];
    lower = index !== false ? index : Math.max(lower, 0);
    upper = index !== false ? index : Math.min(upper, length - 1);

    let deduced = [];

    for (let i = 0; i <= length; i++) {
      makeChanges(state, diffs[i]);
      if (i < lower || i > upper) continue;

      let cacheId = i - length;
      let [cached, result] = deducer.cache[cacheId] || [];

      if (!cached || diffs[i] !== cached) {
        result = selector(state, ...args);
        deducer.cache[cacheId] = [diffs[i], result];
      }

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

    deduced = index === false ? deduced : null;
    deducer.cache.self = [diffs, deduced];
    return deduced;
  };

  deducer.cache = {};
  return deducer;
}
