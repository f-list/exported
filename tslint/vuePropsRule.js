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
    Rule.prototype.applyWithProgram = function (sourceFile, program) {
        return this.applyWithFunction(sourceFile, walk, undefined, program.getTypeChecker());
    };
    return Rule;
}(Lint.Rules.TypedRule));
exports.Rule = Rule;
function walk(ctx, checker) {
    if (ctx.sourceFile.isDeclarationFile)
        return;
    return ts.forEachChild(ctx.sourceFile, cb);
    function cb(node) {
        if (node.kind !== ts.SyntaxKind.PropertyDeclaration || !node.decorators)
            return ts.forEachChild(node, cb);
        for (var _i = 0, _a = node.decorators; _i < _a.length; _i++) {
            var decorator = _a[_i];
            var call = decorator.expression;
            var propSymbol = checker.getTypeAtLocation(call.expression).symbol;
            if (propSymbol.name === 'Prop' &&
                propSymbol.parent.name.endsWith('node_modules/vue-property-decorator/lib/vue-property-decorator"')) {
                if (!node.modifiers || !node.modifiers.some(function (x) { return x.kind === ts.SyntaxKind.ReadonlyKeyword; }))
                    ctx.addFailureAtNode(node.name, 'Vue property should be readonly');
                if (call.arguments.length > 0 && call.arguments[0].properties.map(function (x) { return x.name.getText(); })
                    .some(function (x) { return x === 'default' || x === 'required'; })) {
                    if (node.questionToken !== undefined)
                        ctx.addFailureAtNode(node.name, 'Vue property is required and should not be optional.');
                }
                else if (node.questionToken === undefined)
                    ctx.addFailureAtNode(node.name, 'Vue property should be optional - it is not required and has no default value.');
            }
        }
    }
}
