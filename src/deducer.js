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
    const opts = ['index', 'range', 'limit'].filter((k) => config[k]).map((s) => `\`${s}\``);
    const optsMsg = [opts.slice(0, -1).join(', '), opts[opts.length - 1]].join(' and ');
    console.warn(`Redux Deep Diff: deducer options ${optsMsg} should not be combined`);
  }

  const doChanges = next ? applyChanges : revertChanges;

  return (rawState, ...args) => {
    let { [key]: history, ...state } = rawState;

    if (!history || !(history.prev && history.next)) {
      throw new Error(`Redux Deep Diff: "${key}" is not a diff history object`);
    }

    let slice = next ? history.next : history.prev;

    if (index !== false) {
      state = doChanges(state, slice[index]);
      return selector(state, ...args);
    } else if (range || limit) {
      const [lower, upper] = range || [0, limit - 1];
      slice = slice.slice(lower, upper + 1);
    }

    return slice.reduce((deduced, diff) => {
      state = doChanges(state, diff);
      return [...deduced, selector(state, ...args)];
    }, []);
  };
}
