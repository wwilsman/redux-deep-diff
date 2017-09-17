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

      expect(accum.diffs).to.equal(diffs);
      expect(diffs).to.have.lengthOf(2);
      expect(diffs[0]).to.be.diff('E', ['string'], 'hello', 'world');
      expect(diffs[1]).to.be.diff('E', ['number'], 0, 1);
    });

    it('should accumulate new diffs each time', function() {
      const lhs = { string: 'hello', number: 0 };
      const rhs = { string: 'world', number: 1 };
      const diffs = accum.diff(lhs, rhs);

      expect(accum.diffs).to.equal(diffs);
      expect(diffs).to.have.lengthOf(2);
      expect(diffs[0]).to.be.diff('E', ['string'], 'hello', 'world');
      expect(diffs[1]).to.be.diff('E', ['number'], 0, 1);

      const other = { string: 'people', boolean: true };
      const otherDiffs = accum.diff(lhs, other);

      expect(accum.diffs).to.equal(otherDiffs);
      expect(otherDiffs).to.have.lengthOf(3);
      expect(otherDiffs[0]).to.be.diff('E', ['string'], 'hello', 'people');
      expect(otherDiffs[1]).to.be.diff('D', ['number'], 0, undefined);
      expect(otherDiffs[2]).to.be.diff('N', ['boolean'], undefined, true);
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
