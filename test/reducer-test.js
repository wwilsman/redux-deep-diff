import { use, expect } from 'chai';
import dirtyChai from 'dirty-chai';
import { chaiDeepDiff } from './util';
import { createStore } from 'redux';

import diff from '../src/reducer';
import { undo, redo, jump } from '../src/actions';

use(dirtyChai);
use(chaiDeepDiff);

describe('Redux Deep Diff: reducer', function() {
  const initialState = {
    string: 'hello',
    number: 1000,
    boolean: true,
    array: ['a', 'b', 'c'],
    object: { a: 0, b: 1, c: 2 }
  };

  const change = (props) => ({ type: 'CHANGE', ...props });

  const reducer = diff((state = initialState, { type, ...props }) => {
    switch (type) {
      case 'CHANGE':
        return { ...state, ...props };
      default:
        return state;
    }
  });

  beforeEach(function() {
    this.store = createStore(reducer);
    this.state = this.store.getState();
    this.unsubscribe = this.store.subscribe(() => {
      this.state = this.store.getState();
    });
  });

  afterEach(function() {
    this.unsubscribe();
  });

  it('should have an initial empty history', function() {
    expect(this.state).to.have.property('diff').that.has.all.keys('prev', 'next');
    expect(this.state.diff.prev).to.be.an('array').with.lengthOf(0);
    expect(this.state.diff.next).to.be.an('array').with.lengthOf(0);
  });

  it('should show the last diff when the state changes', function() {
    const expected = {
      string: 'world',
      number: 500,
      boolean: false,
      array: ['a', 'b', 'c', 'd'],
      object: { a: 0, b: 1, C: 2 }
    };

    this.store.dispatch(change(expected));
    expect(this.state).to.deep.include(expected);
    expect(this.state.diff.prev).to.have.lengthOf(1);

    // 3 edits, 1 array, 1 delete, 1 addition
    expect(this.state.diff.prev[0]).to.have.lengthOf(6);
    expect(this.state.diff.prev[0][0]).to.beDiff('E', ['string'], 'hello', 'world');
    expect(this.state.diff.prev[0][1]).to.beDiff('E', ['number'], 1000, 500);
    expect(this.state.diff.prev[0][2]).to.beDiff('E', ['boolean'], true, false);
    expect(this.state.diff.prev[0][3]).to.beDiff('A', ['array'], 3, { kind: 'N', rhs: 'd' });
    expect(this.state.diff.prev[0][4]).to.beDiff('D', ['object', 'c'], 2);
    expect(this.state.diff.prev[0][5]).to.beDiff('N', ['object', 'C'], undefined, 2);
  });

  it('should show previous diffs when additional state changes are made', function() {
    this.store.dispatch(change({ string: 'cat' }));
    this.store.dispatch(change({ number: 9999 }));
    this.store.dispatch(change({ boolean: false }));
    expect(this.state.string).to.equal('cat');
    expect(this.state.number).to.equal(9999);
    expect(this.state.boolean).to.be.false();

    expect(this.state.diff.prev).to.have.lengthOf(3);
    expect(this.state.diff.prev[0]).to.have.lengthOf(1);
    expect(this.state.diff.prev[0][0]).to.beDiff('E', ['boolean'], true, false);
    expect(this.state.diff.prev[1]).to.have.lengthOf(1);
    expect(this.state.diff.prev[1][0]).to.beDiff('E', ['number'], 1000, 9999);
    expect(this.state.diff.prev[2]).to.have.lengthOf(1);
    expect(this.state.diff.prev[2][0]).to.beDiff('E', ['string'], 'hello', 'cat');
  });

  it('should clear the next diffs when a new diff occurs', function() {
    this.store.dispatch(change({ array: ['a', 'b', 'd'] }));
    expect(this.state.array).to.have.members(['a', 'b', 'd']);
    expect(this.state.diff.prev).to.have.lengthOf(1);

    this.store.dispatch(undo());
    expect(this.state.array).to.have.members(['a', 'b', 'c']);
    expect(this.state.diff.prev).to.have.lengthOf(0);
    expect(this.state.diff.next).to.have.lengthOf(1);

    expect(this.state.diff.next[0]).to.have.lengthOf(1);
    expect(this.state.diff.next[0][0]).to.beDiff('E', ['array', 2], 'c', 'd');

    this.store.dispatch(change({ string: 'clarice' }));
    expect(this.state.string).to.equal('clarice');
    expect(this.state.diff.prev).to.have.lengthOf(1);
    expect(this.state.diff.next).to.have.lengthOf(0);

    expect(this.state.diff.prev[0]).to.have.lengthOf(1);
    expect(this.state.diff.prev[0][0]).to.beDiff('E', ['string'], 'hello', 'clarice');
  });

  it('should not create a diff when no changes are are made', function() {
    this.store.dispatch(change({ string: 'hello' }));
    expect(this.state.diff.prev).to.have.lengthOf(0);
  });

  describe('dispatching an undo action', function() {
    it('should undo the last diff by reverting changes', function() {
      this.store.dispatch(change({ string: 'doge' }));
      expect(this.state.string).to.equal('doge');
      expect(this.state.diff.prev).to.have.lengthOf(1);

      this.store.dispatch(undo());
      expect(this.state.string).to.equal('hello');
      expect(this.state.diff.prev).to.have.lengthOf(0);

      expect(this.state.diff.next).to.have.lengthOf(1);
      expect(this.state.diff.next[0]).to.have.lengthOf(1);
      expect(this.state.diff.next[0][0]).to.beDiff('E', ['string'], 'hello', 'doge');
    });

    it('should not change the state when undoing nothing', function() {
      const pre = this.state;
      this.store.dispatch(undo());
      expect(this.state).to.deep.equal(pre);
    });
  });

  describe('dispatching a redo action', function() {
    it('should redo the next diff by applying changes', function() {
      this.store.dispatch(change({ number: 1 }));
      expect(this.state.number).to.equal(1);
      expect(this.state.diff.prev).to.have.lengthOf(1);

      this.store.dispatch(undo());
      expect(this.state.number).to.equal(1000);
      expect(this.state.diff.prev).to.have.lengthOf(0);
      expect(this.state.diff.next).to.have.lengthOf(1);

      this.store.dispatch(redo());
      expect(this.state.number).to.equal(1);
      expect(this.state.diff.prev).to.have.lengthOf(1);
      expect(this.state.diff.next).to.have.lengthOf(0);

      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.beDiff('E', ['number'], 1000, 1);
    });

    it('should not change the state when redoing nothing', function() {
      const pre = this.state;
      this.store.dispatch(redo());
      expect(this.state).to.deep.equal(pre);
    });
  });

  describe('dispatching a jump action', function() {
    it('should undo all changes up to a specified index', function() {
      this.store.dispatch(change({ boolean: false }));
      this.store.dispatch(change({ string: '$#@%&*!' }));
      this.store.dispatch(change({ number: 88 }));
      expect(this.state.boolean).to.be.false();
      expect(this.state.string).to.equal('$#@%&*!');
      expect(this.state.number).to.equal(88);
      expect(this.state.diff.prev).to.have.lengthOf(3);

      this.store.dispatch(jump(-2));
      expect(this.state.boolean).to.be.false();
      expect(this.state.string).to.equal('hello');
      expect(this.state.number).to.equal(1000);
      expect(this.state.diff.prev).to.have.lengthOf(1);
      expect(this.state.diff.next).to.have.lengthOf(2);

      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.beDiff('E', ['boolean'], true, false);

      expect(this.state.diff.next[0]).to.have.lengthOf(1);
      expect(this.state.diff.next[0][0]).to.beDiff('E', ['string'], 'hello', '$#@%&*!');
      expect(this.state.diff.next[1]).to.have.lengthOf(1);
      expect(this.state.diff.next[1][0]).to.beDiff('E', ['number'], 1000, 88);
    });

    it('should redo all undone changes up to a specified index', function() {
      this.store.dispatch(change({ boolean: false }));
      this.store.dispatch(change({ string: '$#@%&*!' }));
      this.store.dispatch(change({ number: 88 }));
      expect(this.state.boolean).to.be.false();
      expect(this.state.string).to.equal('$#@%&*!');
      expect(this.state.number).to.equal(88);
      expect(this.state.diff.prev).to.have.lengthOf(3);

      this.store.dispatch(jump(-3));
      expect(this.state.boolean).to.be.true();
      expect(this.state.string).to.equal('hello');
      expect(this.state.number).to.equal(1000);
      expect(this.state.diff.prev).to.have.lengthOf(0);
      expect(this.state.diff.next).to.have.lengthOf(3);

      this.store.dispatch(jump(2));
      expect(this.state.boolean).to.be.false();
      expect(this.state.string).to.equal('$#@%&*!');
      expect(this.state.number).to.equal(1000);
      expect(this.state.diff.prev).to.have.lengthOf(2);
      expect(this.state.diff.next).to.have.lengthOf(1);

      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.beDiff('E', ['string'], 'hello', '$#@%&*!');
      expect(this.state.diff.prev[1]).to.have.lengthOf(1);
      expect(this.state.diff.prev[1][0]).to.beDiff('E', ['boolean'], true, false);

      expect(this.state.diff.next[0]).to.have.lengthOf(1);
      expect(this.state.diff.next[0][0]).to.beDiff('E', ['number'], 1000, 88);
    });

    it('should not undo further than the history', function() {
      this.store.dispatch(change({ number: -1 }));
      expect(this.state.number).to.equal(-1);
      expect(this.state.diff.prev).to.have.lengthOf(1);

      this.store.dispatch(jump(-100));
      expect(this.state.number).to.equal(1000);
      expect(this.state.diff.prev).to.have.lengthOf(0);
      expect(this.state.diff.next).to.have.lengthOf(1);

      expect(this.state.diff.next[0]).to.have.lengthOf(1);
      expect(this.state.diff.next[0][0]).to.beDiff('E', ['number'], 1000, -1);
    });

    it('should not redo further than the history', function() {
      this.store.dispatch(change({ number: -1 }));
      expect(this.state.number).to.equal(-1);
      expect(this.state.diff.prev).to.have.lengthOf(1);

      this.store.dispatch(undo());
      expect(this.state.number).to.equal(1000);
      expect(this.state.diff.prev).to.have.lengthOf(0);
      expect(this.state.diff.next).to.have.lengthOf(1);

      this.store.dispatch(jump(100));
      expect(this.state.number).to.equal(-1);
      expect(this.state.diff.prev).to.have.lengthOf(1);
      expect(this.state.diff.next).to.have.lengthOf(0);

      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.beDiff('E', ['number'], 1000, -1);
    });
  });
});
