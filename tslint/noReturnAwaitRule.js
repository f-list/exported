"use strict";
exports.__esModule = true;
var tslib_1 = require("tslib");
var Lint = require("tslint");
var ts = require("typescript");
var Rule = /** @class */ (function (_super) {
    tslib_1.__extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithFunction(sourceFile, walk, undefined);
    };
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function walk(ctx) {
    if (ctx.sourceFile.isDeclarationFile)
        return;
    return ts.forEachChild(ctx.sourceFile, cb);
    function cb(node) {
        if (node.kind !== ts.SyntaxKind.ReturnStatement || node.expression === undefined)
            return ts.forEachChild(node, cb);
        var curNode = node.expression;
        while (true) {
            switch (curNode.kind) {
                case ts.SyntaxKind.ParenthesizedExpression:
                    curNode = curNode.expression;
                    continue;
                case ts.SyntaxKind.AwaitExpression:
                    ctx.addFailureAtNode(node, 'return await is redundant');
            }
            break;
        }
    }
}
