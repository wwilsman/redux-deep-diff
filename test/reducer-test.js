import { use, expect } from 'chai';
import dirtyChai from 'dirty-chai';
import { chaiDeepDiff } from './util';
import { createStore } from 'redux';

import diff from '../src/reducer';
import { undo, redo, jump } from '../src/actions';

use(dirtyChai);
use(chaiDeepDiff);

describe('Redux Deep Diff: reducer', function() {
  describe('when the state changes', function() {
    setupDiffReducer();

    it('should have an initial history beforehand', function() {
      expect(this.state).to.have.property('diff')
        .that.has.all.keys('prev', 'next', 'limit');
      expect(this.state.diff.prev).to.be.an('array').with.lengthOf(0);
      expect(this.state.diff.next).to.be.an('array').with.lengthOf(0);
      expect(this.state.diff.limit).to.equal(0);
    });

    it('should show the last diff', function() {
      const expected = {
        string: 'world',
        number: 500,
        boolean: false,
        array: ['a', 'b', 'c', 'd'],
        object: { a: 0, b: 1, C: 2 }
      };

      this.setState(expected);
      expect(this.state).to.deep.include(expected);
      expect(this.state.diff.prev).to.have.lengthOf(1);

      // 3 edits, 1 array, 1 delete, 1 addition
      expect(this.state.diff.prev[0]).to.have.lengthOf(6);
      expect(this.state.diff.prev[0][0]).to.be.diff('E', ['string'], 'hello', 'world');
      expect(this.state.diff.prev[0][1]).to.be.diff('E', ['number'], 1000, 500);
      expect(this.state.diff.prev[0][2]).to.be.diff('E', ['boolean'], true, false);
      expect(this.state.diff.prev[0][3]).to.be.diff('A', ['array'], 3, { kind: 'N', rhs: 'd' });
      expect(this.state.diff.prev[0][4]).to.be.diff('D', ['object', 'c'], 2);
      expect(this.state.diff.prev[0][5]).to.be.diff('N', ['object', 'C'], undefined, 2);
    });

    it('should show previous diffs with additional changes', function() {
      this.setState({ string: 'cat' });
      this.setState({ number: 9999 });
      this.setState({ boolean: false });
      expect(this.state.string).to.equal('cat');
      expect(this.state.number).to.equal(9999);
      expect(this.state.boolean).to.be.false();

      expect(this.state.diff.prev).to.have.lengthOf(3);
      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);
      expect(this.state.diff.prev[1]).to.have.lengthOf(1);
      expect(this.state.diff.prev[1][0]).to.be.diff('E', ['number'], 1000, 9999);
      expect(this.state.diff.prev[2]).to.have.lengthOf(1);
      expect(this.state.diff.prev[2][0]).to.be.diff('E', ['string'], 'hello', 'cat');
    });

    it('should clear the next diffs when a new diff occurs', function() {
      this.setState({ array: ['a', 'b', 'd'] });
      expect(this.state.array).to.have.members(['a', 'b', 'd']);
      expect(this.state.diff.prev).to.have.lengthOf(1);

      this.store.dispatch(undo());
      expect(this.state.array).to.have.members(['a', 'b', 'c']);
      expect(this.state.diff.prev).to.have.lengthOf(0);
      expect(this.state.diff.next).to.have.lengthOf(1);

      expect(this.state.diff.next[0]).to.have.lengthOf(1);
      expect(this.state.diff.next[0][0]).to.be.diff('E', ['array', 2], 'c', 'd');

      this.setState({ string: 'clarice' });
      expect(this.state.string).to.equal('clarice');
      expect(this.state.diff.prev).to.have.lengthOf(1);
      expect(this.state.diff.next).to.have.lengthOf(0);

      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.be.diff('E', ['string'], 'hello', 'clarice');
    });

    it('should not create a diff when no changes are are made', function() {
      this.setState({ string: 'hello' });
      expect(this.state.diff.prev).to.have.lengthOf(0);
    });
  });

  describe('when dispatching diff actions', function() {
    setupDiffReducer();

    describe('an undo action', function() {
      it('should undo the last diff by reverting changes', function() {
        this.setState({ string: 'doge' });
        expect(this.state.string).to.equal('doge');
        expect(this.state.diff.prev).to.have.lengthOf(1);

        this.store.dispatch(undo());
        expect(this.state.string).to.equal('hello');
        expect(this.state.diff.prev).to.have.lengthOf(0);

        expect(this.state.diff.next).to.have.lengthOf(1);
        expect(this.state.diff.next[0]).to.have.lengthOf(1);
        expect(this.state.diff.next[0][0]).to.be.diff('E', ['string'], 'hello', 'doge');
      });

      it('should not change the state when undoing nothing', function() {
        const pre = this.state;
        this.store.dispatch(undo());
        expect(this.state).to.deep.equal(pre);
      });
    });

    describe('a redo action', function() {
      it('should redo the next diff by applying changes', function() {
        this.setState({ number: 1 });
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
        expect(this.state.diff.prev[0][0]).to.be.diff('E', ['number'], 1000, 1);
      });

      it('should not change the state when redoing nothing', function() {
        const pre = this.state;
        this.store.dispatch(redo());
        expect(this.state).to.deep.equal(pre);
      });
    });

    describe('a jump action', function() {
      it('should undo all changes up to a specified index', function() {
        this.setState({ boolean: false });
        this.setState({ string: '$#@%&*!' });
        this.setState({ number: 88 });
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
        expect(this.state.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);

        expect(this.state.diff.next[0]).to.have.lengthOf(1);
        expect(this.state.diff.next[0][0]).to.be.diff('E', ['string'], 'hello', '$#@%&*!');
        expect(this.state.diff.next[1]).to.have.lengthOf(1);
        expect(this.state.diff.next[1][0]).to.be.diff('E', ['number'], 1000, 88);
      });

      it('should redo all undone changes up to a specified index', function() {
        this.setState({ boolean: false });
        this.setState({ string: '$#@%&*!' });
        this.setState({ number: 88 });
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
        expect(this.state.diff.prev[0][0]).to.be.diff('E', ['string'], 'hello', '$#@%&*!');
        expect(this.state.diff.prev[1]).to.have.lengthOf(1);
        expect(this.state.diff.prev[1][0]).to.be.diff('E', ['boolean'], true, false);

        expect(this.state.diff.next[0]).to.have.lengthOf(1);
        expect(this.state.diff.next[0][0]).to.be.diff('E', ['number'], 1000, 88);
      });

      it('should not undo further than the history', function() {
        this.setState({ number: -1 });
        expect(this.state.number).to.equal(-1);
        expect(this.state.diff.prev).to.have.lengthOf(1);

        this.store.dispatch(jump(-100));
        expect(this.state.number).to.equal(1000);
        expect(this.state.diff.prev).to.have.lengthOf(0);
        expect(this.state.diff.next).to.have.lengthOf(1);

        expect(this.state.diff.next[0]).to.have.lengthOf(1);
        expect(this.state.diff.next[0][0]).to.be.diff('E', ['number'], 1000, -1);
      });

      it('should not redo further than the history', function() {
        this.setState({ number: -1 });
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
        expect(this.state.diff.prev[0][0]).to.be.diff('E', ['number'], 1000, -1);
      });
    });
  });

  describe('when `limit` is defined', function() {
    setupDiffReducer({ limit: 2 });

    it('should have a diff limit', function() {
      expect(this.state.diff.limit).to.equal(2);
    });

    it('should not keep diffs further than the limit', function() {
      this.setState({ string: 'old news' });
      this.setState({ number: -1000 });
      this.setState({ boolean: false });
      expect(this.state.string).to.equal('old news');
      expect(this.state.number).to.equal(-1000);
      expect(this.state.boolean).to.be.false();

      expect(this.state.diff.prev).to.have.lengthOf(2);
      expect(this.state.diff.prev[0]).to.have.lengthOf(1);
      expect(this.state.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);
      expect(this.state.diff.prev[1]).to.have.lengthOf(1);
      expect(this.state.diff.prev[1][0]).to.be.diff('E', ['number'], 1000, -1000);
    });
  });
});

function setupDiffReducer(config) {
  const initialState = {
    string: 'hello',
    number: 1000,
    boolean: true,
    array: ['a', 'b', 'c'],
    object: { a: 0, b: 1, c: 2 }
  };

  const setState = (props) => ({ type: 'SET_STATE', props });

  const reducer = (state = initialState, action) => {
    switch (action.type) {
      case 'SET_STATE':
        return { ...state, ...action.props };
      default:
        return state;
    }
  };

  beforeEach(function() {
    this.store = createStore(diff(reducer, config));
    this.state = this.store.getState();

    this.setState = (props) => {
      this.store.dispatch(setState(props));
    };

    this.unsubscribe = this.store.subscribe(() => {
      this.state = this.store.getState();
    });
  });

  afterEach(function() {
    this.unsubscribe();
  });
}
