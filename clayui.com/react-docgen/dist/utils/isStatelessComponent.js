"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isStatelessComponent;

var _astTypes = _interopRequireDefault(require("ast-types"));

var _getPropertyValuePath = _interopRequireDefault(require("./getPropertyValuePath"));

var _isReactComponentClass = _interopRequireDefault(require("./isReactComponentClass"));

var _isReactCreateClassCall = _interopRequireDefault(require("./isReactCreateClassCall"));

var _isReactCreateElementCall = _interopRequireDefault(require("./isReactCreateElementCall"));

var _isReactCloneElementCall = _interopRequireDefault(require("./isReactCloneElementCall"));

var _isReactChildrenElementCall = _interopRequireDefault(require("./isReactChildrenElementCall"));

var _resolveToValue = _interopRequireDefault(require("./resolveToValue"));

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
const {
  visit,
  namedTypes: t
} = _astTypes.default;
const validPossibleStatelessComponentTypes = ['Property', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'];

function isJSXElementOrReactCall(path) {
  return path.node.type === 'JSXElement' || path.node.type === 'JSXFragment' || path.node.type === 'CallExpression' && (0, _isReactCreateElementCall.default)(path) || path.node.type === 'CallExpression' && (0, _isReactCloneElementCall.default)(path) || path.node.type === 'CallExpression' && (0, _isReactChildrenElementCall.default)(path);
}

function resolvesToJSXElementOrReactCall(path) {
  // Is the path is already a JSX element or a call to one of the React.* functions
  if (isJSXElementOrReactCall(path)) {
    return true;
  }

  const resolvedPath = (0, _resolveToValue.default)(path); // If the path points to a conditional expression, then we need to look only at
  // the two possible paths

  if (resolvedPath.node.type === 'ConditionalExpression') {
    return resolvesToJSXElementOrReactCall(resolvedPath.get('consequent')) || resolvesToJSXElementOrReactCall(resolvedPath.get('alternate'));
  } // If the path points to a logical expression (AND, OR, ...), then we need to look only at
  // the two possible paths


  if (resolvedPath.node.type === 'LogicalExpression') {
    return resolvesToJSXElementOrReactCall(resolvedPath.get('left')) || resolvesToJSXElementOrReactCall(resolvedPath.get('right'));
  } // Is the resolved path is already a JSX element or a call to one of the React.* functions
  // Only do this if the resolvedPath actually resolved something as otherwise we did this check already


  if (resolvedPath !== path && isJSXElementOrReactCall(resolvedPath)) {
    return true;
  } // If we have a call expression, lets try to follow it


  if (resolvedPath.node.type === 'CallExpression') {
    let calleeValue = (0, _resolveToValue.default)(resolvedPath.get('callee'));

    if (returnsJSXElementOrReactCall(calleeValue)) {
      return true;
    }

    let resolvedValue;
    const namesToResolve = [calleeValue.get('property')];

    if (calleeValue.node.type === 'MemberExpression') {
      if (calleeValue.get('object').node.type === 'Identifier') {
        resolvedValue = (0, _resolveToValue.default)(calleeValue.get('object'));
      } else if (t.MemberExpression.check(calleeValue.node)) {
        do {
          calleeValue = calleeValue.get('object');
          namesToResolve.unshift(calleeValue.get('property'));
        } while (t.MemberExpression.check(calleeValue.node));

        resolvedValue = (0, _resolveToValue.default)(calleeValue.get('object'));
      }
    }

    if (resolvedValue && t.ObjectExpression.check(resolvedValue.node)) {
      const resolvedMemberExpression = namesToResolve.reduce((result, nodePath) => {
        if (!nodePath) {
          return result;
        }

        if (result) {
          result = (0, _getPropertyValuePath.default)(result, nodePath.node.name);

          if (result && t.Identifier.check(result.node)) {
            return (0, _resolveToValue.default)(result);
          }
        }

        return result;
      }, resolvedValue);

      if (!resolvedMemberExpression || returnsJSXElementOrReactCall(resolvedMemberExpression)) {
        return true;
      }
    }
  }

  return false;
}

function returnsJSXElementOrReactCall(path) {
  let visited = false; // early exit for ArrowFunctionExpressions

  if (path.node.type === 'ArrowFunctionExpression' && path.get('body').node.type !== 'BlockStatement' && resolvesToJSXElementOrReactCall(path.get('body'))) {
    return true;
  }

  let scope = path.scope; // If we get a property we want the function scope it holds and not its outer scope

  if (path.node.type === 'Property') {
    scope = path.get('value').scope;
  }

  visit(path, {
    visitReturnStatement(returnPath) {
      // Only check return statements which are part of the checked function scope
      if (returnPath.scope !== scope) return false;

      if (resolvesToJSXElementOrReactCall(returnPath.get('argument'))) {
        visited = true;
        return false;
      }

      this.traverse(returnPath);
    }

  });
  return visited;
}
/**
 * Returns `true` if the path represents a function which returns a JSXElement
 */


function isStatelessComponent(path) {
  const node = path.node;

  if (validPossibleStatelessComponentTypes.indexOf(node.type) === -1) {
    return false;
  }

  if (node.type === 'Property') {
    if ((0, _isReactCreateClassCall.default)(path.parent) || (0, _isReactComponentClass.default)(path.parent)) {
      return false;
    }
  }

  if (returnsJSXElementOrReactCall(path)) {
    return true;
  }

  return false;
}