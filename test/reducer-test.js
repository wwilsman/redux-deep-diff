import { use, expect } from 'chai';
import dirtyChai from 'dirty-chai';
import { chaiDeepDiff } from './util';
import { createStore } from 'redux';

import diff from '../src/reducer';
import { UNDO, REDO, JUMP, CLEAR } from '../src/actions';

use(dirtyChai);
use(chaiDeepDiff);

describeDiffReducer('with default options');
describeDiffReducer('with a custom key', { key: 'd' });
describeDiffReducer('with a custom undo type', { undoType: 'PREV_DIFF' });
describeDiffReducer('with a custom redo type', { redoType: 'NEXT_DIFF' });
describeDiffReducer('with a custom jump type', { jumpType: 'JUMP_TO_DIFF' });
describeDiffReducer('with a custom clear type', { clearType: 'CLEAR_DIFF' });
describeDiffReducer('with custom combination key & types', {
  key: '__secret_diff',
  undoType: 'GET_UNDONE',
  redoType: 'GET_REDONE',
  jumpType: 'GET_JUMPED',
  clearType: 'GET_CLEARED'
});

// we want to perform the same tests with varying reducer configs
function describeDiffReducer(label = '', testConfig = {}) {
  const {
    key = 'diff',
    undoType = UNDO,
    redoType = REDO,
    jumpType = JUMP,
    clearType = CLEAR
  } = testConfig;

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

  // setup for specific configs
  function setupDiffReducer(config = {}) {
    config = { ...testConfig, ...config };

    beforeEach(function() {
      this.store = createStore(diff(reducer, config));
      this.state = this.store.getState();
      this.diff = this.state[key];

      this.dispatch = this.store.dispatch;
      this.dispatch.setState = (props) => this.store.dispatch(setState(props));
      this.dispatch.undo = () => this.store.dispatch({ type: undoType });
      this.dispatch.redo = () => this.store.dispatch({ type: redoType });
      this.dispatch.jump = (index) => this.store.dispatch({ type: jumpType, index });
      this.dispatch.clear = (index) => this.store.dispatch({ type: clearType, index });

      this.unsubscribe = this.store.subscribe(() => {
        this.state = this.store.getState();
        this.diff = this.state[key];
      });
    });

    afterEach(function() {
      this.unsubscribe();
    });
  }

  describe(`Redux Deep Diff: reducer ${label}`, function() {
    describe('when the state changes', function() {
      setupDiffReducer();

      it('should have an initial history beforehand', function() {
        expect(this.state).to.have.property(key)
          .that.has.all.keys('prev', 'next', 'limit');
        expect(this.diff.prev).to.be.an('array').with.lengthOf(0);
        expect(this.diff.next).to.be.an('array').with.lengthOf(0);
        expect(this.diff.limit).to.equal(0);
      });

      it('should show the last diff', function() {
        const expected = {
          string: 'world',
          number: 500,
          boolean: false,
          array: ['a', 'b', 'c', 'd'],
          object: { a: 0, b: 1, C: 2 }
        };

        this.dispatch.setState(expected);
        expect(this.state).to.deep.include(expected);
        expect(this.diff.prev).to.have.lengthOf(1);

        // 3 edits, 1 array, 1 delete, 1 addition
        expect(this.diff.prev[0]).to.have.lengthOf(6);
        expect(this.diff.prev[0][0]).to.be.diff('E', ['string'], 'hello', 'world');
        expect(this.diff.prev[0][1]).to.be.diff('E', ['number'], 1000, 500);
        expect(this.diff.prev[0][2]).to.be.diff('E', ['boolean'], true, false);
        expect(this.diff.prev[0][3]).to.be.diff('A', ['array'], 3, { kind: 'N', rhs: 'd' });
        expect(this.diff.prev[0][4]).to.be.diff('D', ['object', 'c'], 2);
        expect(this.diff.prev[0][5]).to.be.diff('N', ['object', 'C'], undefined, 2);
      });

      it('should show previous diffs with additional changes', function() {
        this.dispatch.setState({ string: 'cat' });
        this.dispatch.setState({ number: 9999 });
        this.dispatch.setState({ boolean: false });
        expect(this.state.string).to.equal('cat');
        expect(this.state.number).to.equal(9999);
        expect(this.state.boolean).to.be.false();

        expect(this.diff.prev).to.have.lengthOf(3);
        expect(this.diff.prev[0]).to.have.lengthOf(1);
        expect(this.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);
        expect(this.diff.prev[1]).to.have.lengthOf(1);
        expect(this.diff.prev[1][0]).to.be.diff('E', ['number'], 1000, 9999);
        expect(this.diff.prev[2]).to.have.lengthOf(1);
        expect(this.diff.prev[2][0]).to.be.diff('E', ['string'], 'hello', 'cat');
      });

      it('should clear the next diffs when a new diff occurs', function() {
        this.dispatch.setState({ array: ['a', 'b', 'd'] });
        expect(this.state.array).to.have.members(['a', 'b', 'd']);
        expect(this.diff.prev).to.have.lengthOf(1);

        this.dispatch.undo();
        expect(this.state.array).to.have.members(['a', 'b', 'c']);
        expect(this.diff.prev).to.have.lengthOf(0);
        expect(this.diff.next).to.have.lengthOf(1);

        expect(this.diff.next[0]).to.have.lengthOf(1);
        expect(this.diff.next[0][0]).to.be.diff('E', ['array', 2], 'c', 'd');

        this.dispatch.setState({ string: 'clarice' });
        expect(this.state.string).to.equal('clarice');
        expect(this.diff.prev).to.have.lengthOf(1);
        expect(this.diff.next).to.have.lengthOf(0);

        expect(this.diff.prev[0]).to.have.lengthOf(1);
        expect(this.diff.prev[0][0]).to.be.diff('E', ['string'], 'hello', 'clarice');
      });

      it('should not create a diff when no changes are are made', function() {
        this.dispatch.setState({ string: 'hello' });
        expect(this.diff.prev).to.have.lengthOf(0);
      });
    });

    describe('when dispatching diff actions', function() {
      setupDiffReducer();

      describe('an undo action', function() {
        it('should undo the last diff by reverting changes', function() {
          this.dispatch.setState({ string: 'doge' });
          expect(this.state.string).to.equal('doge');
          expect(this.diff.prev).to.have.lengthOf(1);

          this.dispatch.undo();
          expect(this.state.string).to.equal('hello');
          expect(this.diff.prev).to.have.lengthOf(0);

          expect(this.diff.next).to.have.lengthOf(1);
          expect(this.diff.next[0]).to.have.lengthOf(1);
          expect(this.diff.next[0][0]).to.be.diff('E', ['string'], 'hello', 'doge');
        });

        it('should not change the state when undoing nothing', function() {
          const pre = this.state;
          this.dispatch.undo();
          expect(this.state).to.deep.equal(pre);
        });
      });

      describe('a redo action', function() {
        it('should redo the next diff by applying changes', function() {
          this.dispatch.setState({ number: 1 });
          expect(this.state.number).to.equal(1);
          expect(this.diff.prev).to.have.lengthOf(1);

          this.dispatch.undo();
          expect(this.state.number).to.equal(1000);
          expect(this.diff.prev).to.have.lengthOf(0);
          expect(this.diff.next).to.have.lengthOf(1);

          this.dispatch.redo();
          expect(this.state.number).to.equal(1);
          expect(this.diff.prev).to.have.lengthOf(1);
          expect(this.diff.next).to.have.lengthOf(0);

          expect(this.diff.prev[0]).to.have.lengthOf(1);
          expect(this.diff.prev[0][0]).to.be.diff('E', ['number'], 1000, 1);
        });

        it('should not change the state when redoing nothing', function() {
          const pre = this.state;
          this.dispatch.redo();
          expect(this.state).to.deep.equal(pre);
        });
      });

      describe('a clear action', function() {
        it('should clear history', function() {
          this.dispatch.setState({ number: 1 });
          expect(this.state.number).to.equal(1);
          expect(this.diff.prev).to.have.lengthOf(1);

          this.dispatch.clear();
          expect(this.state.number).to.equal(1);
          expect(this.diff.prev).to.have.lengthOf(0);
          expect(this.diff.next).to.have.lengthOf(0);
        });
      });

      describe('a jump action', function() {
        it('should undo all changes up to a specified index', function() {
          this.dispatch.setState({ boolean: false });
          this.dispatch.setState({ string: '$#@%&*!' });
          this.dispatch.setState({ number: 88 });
          expect(this.state.boolean).to.be.false();
          expect(this.state.string).to.equal('$#@%&*!');
          expect(this.state.number).to.equal(88);
          expect(this.diff.prev).to.have.lengthOf(3);

          this.dispatch.jump(-2);
          expect(this.state.boolean).to.be.false();
          expect(this.state.string).to.equal('hello');
          expect(this.state.number).to.equal(1000);
          expect(this.diff.prev).to.have.lengthOf(1);
          expect(this.diff.next).to.have.lengthOf(2);

          expect(this.diff.prev[0]).to.have.lengthOf(1);
          expect(this.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);

          expect(this.diff.next[0]).to.have.lengthOf(1);
          expect(this.diff.next[0][0]).to.be.diff('E', ['string'], 'hello', '$#@%&*!');
          expect(this.diff.next[1]).to.have.lengthOf(1);
          expect(this.diff.next[1][0]).to.be.diff('E', ['number'], 1000, 88);
        });

        it('should redo all undone changes up to a specified index', function() {
          this.dispatch.setState({ boolean: false });
          this.dispatch.setState({ string: '$#@%&*!' });
          this.dispatch.setState({ number: 88 });
          expect(this.state.boolean).to.be.false();
          expect(this.state.string).to.equal('$#@%&*!');
          expect(this.state.number).to.equal(88);
          expect(this.diff.prev).to.have.lengthOf(3);

          this.dispatch.jump(-3);
          expect(this.state.boolean).to.be.true();
          expect(this.state.string).to.equal('hello');
          expect(this.state.number).to.equal(1000);
          expect(this.diff.prev).to.have.lengthOf(0);
          expect(this.diff.next).to.have.lengthOf(3);

          this.dispatch.jump(2);
          expect(this.state.boolean).to.be.false();
          expect(this.state.string).to.equal('$#@%&*!');
          expect(this.state.number).to.equal(1000);
          expect(this.diff.prev).to.have.lengthOf(2);
          expect(this.diff.next).to.have.lengthOf(1);

          expect(this.diff.prev[0]).to.have.lengthOf(1);
          expect(this.diff.prev[0][0]).to.be.diff('E', ['string'], 'hello', '$#@%&*!');
          expect(this.diff.prev[1]).to.have.lengthOf(1);
          expect(this.diff.prev[1][0]).to.be.diff('E', ['boolean'], true, false);

          expect(this.diff.next[0]).to.have.lengthOf(1);
          expect(this.diff.next[0][0]).to.be.diff('E', ['number'], 1000, 88);
        });

        it('should not undo further than the history', function() {
          this.dispatch.setState({ number: -1 });
          expect(this.state.number).to.equal(-1);
          expect(this.diff.prev).to.have.lengthOf(1);

          this.dispatch.jump(-100);
          expect(this.state.number).to.equal(1000);
          expect(this.diff.prev).to.have.lengthOf(0);
          expect(this.diff.next).to.have.lengthOf(1);

          expect(this.diff.next[0]).to.have.lengthOf(1);
          expect(this.diff.next[0][0]).to.be.diff('E', ['number'], 1000, -1);
        });

        it('should not redo further than the history', function() {
          this.dispatch.setState({ number: -1 });
          expect(this.state.number).to.equal(-1);
          expect(this.diff.prev).to.have.lengthOf(1);

          this.dispatch.undo();
          expect(this.state.number).to.equal(1000);
          expect(this.diff.prev).to.have.lengthOf(0);
          expect(this.diff.next).to.have.lengthOf(1);

          this.dispatch.jump(100);
          expect(this.state.number).to.equal(-1);
          expect(this.diff.prev).to.have.lengthOf(1);
          expect(this.diff.next).to.have.lengthOf(0);

          expect(this.diff.prev[0]).to.have.lengthOf(1);
          expect(this.diff.prev[0][0]).to.be.diff('E', ['number'], 1000, -1);
        });
      });
    });

    describe('when `limit` is defined', function() {
      setupDiffReducer({ limit: 2 });

      it('should have a diff limit', function() {
        expect(this.diff.limit).to.equal(2);
      });

      it('should not keep diffs further than the limit', function() {
        this.dispatch.setState({ string: 'old news' });
        this.dispatch.setState({ number: -1000 });
        this.dispatch.setState({ boolean: false });
        expect(this.state.string).to.equal('old news');
        expect(this.state.number).to.equal(-1000);
        expect(this.state.boolean).to.be.false();

        expect(this.diff.prev).to.have.lengthOf(2);
        expect(this.diff.prev[0]).to.have.lengthOf(1);
        expect(this.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);
        expect(this.diff.prev[1]).to.have.lengthOf(1);
        expect(this.diff.prev[1][0]).to.be.diff('E', ['number'], 1000, -1000);
      });
    });

    describe('when `skipAction` is defined', function() {
      setupDiffReducer({
        skipAction: (action) => action.type !== 'DIFF'
      });

      it('should not diff when the action is skipped', function() {
        this.dispatch.setState({ boolean: false });
        expect(this.state.boolean).to.be.false();
        expect(this.diff.prev).to.have.lengthOf(0);
      });

      it('should diff previous changes when the action is not skipped', function() {
        this.dispatch.setState({ boolean: false });
        expect(this.state.boolean).to.be.false();
        expect(this.diff.prev).to.have.lengthOf(0);

        this.dispatch({ type: 'DIFF' });
        expect(this.diff.prev).to.have.lengthOf(1);

        expect(this.diff.prev[0]).to.have.lengthOf(1);
        expect(this.diff.prev[0][0]).to.be.diff('E', ['boolean'], true, false);
      });
    });
  });
}
