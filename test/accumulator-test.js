import { use, expect } from 'chai';
import dirtyChai from 'dirty-chai';
import { chaiDeepDiff } from './util';

import DiffAccumulator from '../src/accumulator';

use(dirtyChai);
use(chaiDeepDiff);

describe('Redux Deep Diff: accumulator', function() {
  let accum;

  describe('with default options', function() {
    beforeEach(() => accum = new DiffAccumulator());

    it('should accumulate diffs', function() {
      const lhs = { string: 'hello', number: 0 };
      const rhs = { string: 'world', number: 1 };
      const diffs = accum.diff(lhs, rhs);

      expect(accum.changes).to.equal(diffs);
      expect(diffs).to.have.lengthOf(2);
      expect(diffs[0]).to.be.diff('E', ['string'], 'hello', 'world');
      expect(diffs[1]).to.be.diff('E', ['number'], 0, 1);
    });

    it('should merge accumulated diffs', function() {
      const first = { string: 'hello', number: 0, array: ['a'] };
      const second = { string: 'world', array: ['A', 'b'] };
      const diffs = accum.diff(first, second);

      expect(accum.changes).to.equal(diffs);
      expect(diffs).to.have.lengthOf(4);
      expect(diffs[0]).to.be.diff('E', ['string'], 'hello', 'world');
      expect(diffs[1]).to.be.diff('D', ['number'], 0, undefined);
      expect(diffs[2]).to.be.diff('E', ['array', 0], 'a', 'A');
      expect(diffs[3]).to.be.diff('A', ['array'], 1, { kind: 'N', rhs: 'b' });

      const third = { string: 'people', number: 0, array: [] };
      const otherDiffs = accum.diff(second, third);

      expect(accum.changes).to.equal(otherDiffs);
      expect(otherDiffs).to.have.lengthOf(2);
      expect(otherDiffs[0]).to.be.diff('E', ['string'], 'hello', 'people');
      expect(otherDiffs[1]).to.be.diff('A', ['array'], 0, { kind: 'D', lhs: 'a' });
    });

    it('should remove previous diffs when `.clear()` is called', function() {
      const lhs = { string: 'hello', array: [] };
      const rhs = { string: 'world', array: ['a'] };
      const diffs = accum.diff(lhs, rhs);

      expect(diffs).to.have.lengthOf(2);
      expect(diffs[0]).to.be.diff('E', ['string'], 'hello', 'world');
      expect(diffs[1]).to.be.diff('A', ['array'], 0, { kind: 'N', rhs: 'a' });

      accum.clear();
      expect(accum.changes).to.have.lengthOf(0);

      const other = { string: 'lady', array: [] };
      const otherDiffs = accum.diff(lhs, other);

      expect(otherDiffs).to.not.deep.equal(diffs);
      expect(otherDiffs).to.have.lengthOf(1);
      expect(otherDiffs[0]).to.be.diff('E', ['string'], 'hello', 'lady');
    });
  });

  describe('with the prefilter option', function() {
    beforeEach(() => accum = new DiffAccumulator({
      prefilter: (path, key) => key === 'number'
    }));

    it('should only accumulate diffs not matching the prefilter', function() {
      const lhs = { string: 'hello', number: 0 };
      const rhs = { string: 'world', number: 1 };
      const diffs = accum.diff(lhs, rhs);

      expect(diffs).to.have.lengthOf(1);
      expect(diffs[0]).to.be.diff('E', ['string'], 'hello', 'world');
    });
  });

  describe('with the flatten option', function() {
    beforeEach(() => accum = new DiffAccumulator({
      flatten: (path, key) => key === 'nested'
    }));

    it('should flatten matching diffs', function() {
      const lhs = { nested: { string: 'hello', number: 0, boolean: false } };
      const rhs = { nested: { string: 'world', number: 1, bool: true } };
      const diffs = accum.diff(lhs, rhs);

      expect(diffs).to.have.lengthOf(1);
      expect(diffs[0]).to.be.diff('E', ['nested'], lhs.nested, rhs.nested);
    });
  });
});
