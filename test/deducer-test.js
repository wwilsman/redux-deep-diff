import sinon from 'sinon';
import { use, expect } from 'chai';
import sinonChai from 'sinon-chai';

import createDeducer from '../src/deducer';

use(sinonChai);

describe('Redux Deep Diff: deducer', function() {
  const selector = ({ number }) => number;

  beforeEach(function() {
    this.state = {
      number: 0,
      diff: {
        prev: [
          [{ kind: 'E', path: ['number'], lhs: 10, rhs: 0 }],
          [{ kind: 'E', path: ['number'], lhs: 15, rhs: 10 }],
          [{ kind: 'E', path: ['number'], lhs: 5, rhs: 15 }],
          [{ kind: 'E', path: ['number'], lhs: 0, rhs: 5 }]
        ],
        next: []
      }
    };
  });

  describe('with default options', function() {
    beforeEach(function() {
      this.deduce = createDeducer(selector);
    });

    it('should deduce the correct history', function() {
      const history = this.deduce(this.state);
      expect(history).to.have.lengthOf(4);
      expect(history).to.deep.equal([0, 5, 15, 10]);
    });
  });

  describe('with the `index` option', function() {
    beforeEach(function() {
      this.deduce = createDeducer(selector, { index: 2 });
    });

    it('should deduce a single diff from the history', function() {
      const past = this.deduce(this.state);
      expect(past).to.equal(5);
    });
  });

  describe('with the `range` option', function() {
    beforeEach(function() {
      this.deduce = createDeducer(selector, { range: [1, 2] });
    });

    it('should deduce a subset of the history', function() {
      const history = this.deduce(this.state);
      expect(history).to.have.lengthOf(2);
      expect(history).to.deep.equal([5, 15]);
    });
  });

  describe('with the `limit` option', function() {
    beforeEach(function() {
      this.deduce = createDeducer(selector, { limit: 2 });
    });

    it('should deduce a limited history', function() {
      const history = this.deduce(this.state);
      expect(history).to.have.lengthOf(2);
      expect(history).to.deep.equal([15, 10]);
    });
  });

  describe('with the `next` option', function() {
    beforeEach(function() {
      this.deduce = createDeducer(selector, { next: true });
      this.state.diff.next = this.state.diff.prev.slice().reverse();
      this.state.diff.prev = [];
    });

    it('should deduce the correct history', function() {
      const history = this.deduce(this.state);
      expect(history).to.have.lengthOf(4);
      expect(history).to.deep.equal([0, 10, 15, 5]);
    });

    describe('and the `index` option', function() {
      beforeEach(function() {
        this.deduce = createDeducer(selector, { next: true, index: 2 });
      });

      it('should deduce a single diff from the history', function() {
        const past = this.deduce(this.state);
        expect(past).to.equal(10);
      });
    });

    describe('and the `range` option', function() {
      beforeEach(function() {
        this.deduce = createDeducer(selector, { next: true, range: [1, 2] });
      });

      it('should deduce a subset of the history', function() {
        const history = this.deduce(this.state);
        expect(history).to.have.lengthOf(2);
        expect(history).to.deep.equal([10, 15]);
      });
    });

    describe('and the `limit` option', function() {
      beforeEach(function() {
        this.deduce = createDeducer(selector, { next: true, limit: 2 });
      });

      it('should deduce a limited history', function() {
        const history = this.deduce(this.state);
        expect(history).to.have.lengthOf(2);
        expect(history).to.deep.equal([15, 5]);
      });
    });
  });

  describe('memoization', function() {
    beforeEach(function() {
      this.spy = sinon.spy(selector);
      this.deduce = createDeducer(this.spy);
    });

    it('should memoize the results', function() {
      const history = this.deduce(this.state);
      expect(this.spy).to.have.callCount(4);
      expect(this.deduce(this.state)).to.equal(history);
      expect(this.spy).to.have.callCount(4);
    });

    it('should memoize each selector result', function() {
      const history = this.deduce(this.state);
      expect(this.spy).to.have.callCount(4);

      const newHistory = this.deduce({
        number: 5,
        diff: {
          prev: [
            [{ kind: 'E', path: ['number'], lhs: 5, rhs: 0 }],
            ...this.state.diff.prev
          ],
          next: []
        }
      });

      expect(newHistory).to.not.equal(history);
      expect(newHistory).to.have.lengthOf(5);
      expect(newHistory).to.include.members(history);
      expect(newHistory[4]).to.equal(5);
      expect(this.spy).to.have.callCount(5);
    });
  });

  describe('misconfigured options', function() {
    beforeEach(function() {
      this.sinon = sinon.sandbox.create();
      this.sinon.stub(console, 'warn');
    });

    afterEach(function() {
      this.sinon.restore();
    });

    describe('with an invalid `key`', function() {
      beforeEach(function() {
        this.deduce = createDeducer(selector, { key: '_diff_' });
      });

      it('should throw an error about the key', function() {
        expect(() => this.deduce(this.state)).to.throw('"_diff_"');
      });
    });

    describe('with both an `index` and `range` or `limit`', function() {
      beforeEach(function() {
        const index = 1;
        const range = [1, 2];
        const limit = 2;
        this.deduceIndexed = createDeducer(selector, { index });
        this.deduceRanged = createDeducer(selector, { index, range });
        this.deduceLimited = createDeducer(selector, { index, limit });
        this.deduceRangeLimited = createDeducer(selector, { index, range, limit });
      });

      it('should warn about combining them', function() {
        expect(console.warn).to.have.callCount(3)
          .and.calledWith(sinon.match('index, range, or limit'));
      });

      it('should prioritize `index`', function() {
        const indexed = this.deduceIndexed(this.state);
        expect(indexed).to.equal(15);

        const ranged = this.deduceRanged(this.state);
        expect(ranged).to.not.deep.equal([10, 15]);
        expect(ranged).to.equal(indexed);

        const limited = this.deduceLimited(this.state);
        expect(limited).to.not.deep.equal([15, 5]);
        expect(limited).to.equal(indexed);

        const rangeLimited = this.deduceRangeLimited(this.state);
        expect(rangeLimited).to.not.deep.equal([10, 15]);
        expect(rangeLimited).to.not.deep.equal([15, 5]);
        expect(rangeLimited).to.equal(indexed);
      });
    });

    describe('with both a `range` and `limit`', function() {
      beforeEach(function() {
        const range = [1, 2];
        const limit = 2;
        this.deduceRanged = createDeducer(selector, { range });
        this.deduceRangeLimited = createDeducer(selector, { range, limit });
      });

      it('should warn about combining them', function() {
        expect(console.warn).to.have.callCount(1)
          .calledWith(sinon.match('index, range, or limit'));
      });

      it('should prioritize `range`', function() {
        const ranged = this.deduceRanged(this.state);
        expect(ranged).to.not.deep.equal([10, 15]);
        expect(ranged).to.deep.equal([5, 15]);

        const rangeLimited = this.deduceRangeLimited(this.state);
        expect(rangeLimited).to.not.deep.equal([15, 5]);
        expect(rangeLimited).to.deep.equal(ranged);
      });
    });
  });
});
