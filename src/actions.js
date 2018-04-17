export const UNDO = '@@redux-deep-diff/UNDO';
export const REDO = '@@redux-deep-diff/REDO';
export const JUMP = '@@redux-deep-diff/JUMP';
export const CLEAR = '@@redux-deep-diff/CLEAR';

export const undo = () => ({ type: UNDO });
export const redo = () => ({ type: REDO });
export const jump = (index) => ({ type: JUMP, index });
export const clear = () => ({ type: CLEAR });
