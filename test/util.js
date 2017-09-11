export const chaiDeepDiff = (chai, utils) => {
  const { Assertion } = chai;

  Assertion.addMethod('beDiff', function(kind, path, lhs, rhs) {
    const obj = this._obj;

    this.assert(
      obj && obj.kind,
      'expected #{this} to be a diff change object',
      'expected #{this} to not be a diff change object'
    );

    this.assert(
      obj.kind === kind,
      'expected change to be of kind #{exp} but got #{act}',
      'expected change to not be of kind #{act}',
      kind,
      obj.kind
    );

    this.assert(
      obj.path.every((k, i) => path[i] === k),
      'expected change to have path #{exp} but got #{act}',
      'expected change to not have path #{act}',
      path,
      obj.path
    );

    if (kind === 'A') {
      const index = lhs;
      const item = rhs;

      this.assert(
        obj.index === index,
        'expected change to have index #{exp} but got #{act}',
        'expected change to not have index #{act}',
        index,
        obj.index
      );

      this.assert(
        obj.item.kind === item.kind &&
          obj.item.lhs === item.lhs &&
          obj.item.rhs === item.rhs,
        'expected change item to be #{exp} but got #{act}',
        'expected change item to not be #{act}',
        item,
        obj.item
      );
    } else {
      this.assert(
        obj.lhs === lhs,
        'expected change to have lhs #{exp} but got #{act}',
        'expected change to not have lhs #{act}',
        lhs,
        obj.lhs
      );

      this.assert(
        obj.rhs === rhs,
        'expected change to have rhs #{exp} but got #{act}',
        'expected change to not have rhs #{act}',
        rhs,
        obj.rhs
      );
    }
  });
};
