export abstract class BBCodeTag {
    noClosingTag = false;
    allowedTags: {[tag: string]: boolean | undefined} | undefined;

    constructor(public tag: string, tagList?: string[]) {
        if(tagList !== undefined)
            this.setAllowedTags(tagList);
    }

    isAllowed(tag: string): boolean {
        return this.allowedTags === undefined || this.allowedTags[tag] !== undefined;
    }

    setAllowedTags(allowed: string[]): void {
        this.allowedTags = {};
        for(const tag of allowed)
            this.allowedTags[tag] = true;
    }

    //tslint:disable-next-line:no-empty
    afterClose(_: BBCodeParser, __: HTMLElement, ___: HTMLElement | undefined, ____?: string): void {
    }

    abstract createElement(parser: BBCodeParser, parent: HTMLElement, param: string): HTMLElement  | undefined;
}

export class BBCodeSimpleTag extends BBCodeTag {

    constructor(tag: string, private elementName: keyof HTMLElementTagNameMap, private classes?: string[], tagList?: string[]) {
        super(tag, tagList);
    }

    createElement(parser: BBCodeParser, parent: HTMLElement, param: string): HTMLElement {
        if(param.length > 0)
            parser.warning('Unexpected parameter');
        const el = <HTMLElement>parser.createElement(this.elementName);
        if(this.classes !== undefined && this.classes.length > 0)
            el.className = this.classes.join(' ');
        parent.appendChild(el);
        /*tslint:disable-next-line:no-unsafe-any*/// false positive
        return el;
    }
}

export type CustomElementCreator = (parser: BBCodeParser, parent: HTMLElement, param: string) => HTMLElement | undefined;
export type CustomCloser = (parser: BBCodeParser, current: HTMLElement, parent: HTMLElement, param: string) => void;

export class BBCodeCustomTag extends BBCodeTag {
    constructor(tag: string, private customCreator: CustomElementCreator, private customCloser?: CustomCloser, tagList?: string[]) {
        super(tag, tagList);
    }

    createElement(parser: BBCodeParser, parent: HTMLElement, param: string): HTMLElement | undefined {
        return this.customCreator(parser, parent, param);
    }

    afterClose(parser: BBCodeParser, current: HTMLElement, parent: HTMLElement, param: string): void {
        if(this.customCloser !== undefined)
            this.customCloser(parser, current, parent, param);
    }
}

enum BufferType { Raw, Tag }

class ParserTag {
    constructor(public tag: string, public param: string, public element: HTMLElement, public parent: HTMLElement | undefined,
                public line: number, public column: number) {
    }

    appendElement(child: HTMLElement): void {
        this.element.appendChild(child);
    }

    append(content: string, start: number, end: number): void {
        if(content.length === 0)
            return;
        this.element.appendChild(document.createTextNode(content.substring(start, end)));
    }
}

export class BBCodeParser {
    private _warnings: string[] = [];
    private _tags: {[tag: string]: BBCodeTag | undefined} = {};
    private _line = -1;
    private _column = -1;
    private _currentTag!: ParserTag;
    private _storeWarnings = false;

    parseEverything(input: string): HTMLElement {
        if(input.length === 0)
            return this.createElement('span');
        this._warnings = [];
        this._line = 1;
        this._column = 1;
        const stack: ParserTag[] = this.parse(input, 0, input.length);

        for(let i = stack.length - 1; i > 0; i--) {
            this._currentTag = <ParserTag>stack.pop();
            this.warning('Automatically closing tag at end of input.');
        }
        if(process.env.NODE_ENV !== 'production' && this._warnings.length > 0)
            console.log(this._warnings);
        return stack[0].element;
    }

    createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
        return document.createElement(tag);
    }

    addTag(tag: string, impl: BBCodeTag): void {
        this._tags[tag] = impl;
    }

    removeTag(tag: string): void {
        delete this._tags[tag];
    }

    get warnings(): ReadonlyArray<string> {
        return this._warnings;
    }

    set storeWarnings(store: boolean) {
        this._storeWarnings = store;
        if(!store)
            this._warnings = [];
    }

    warning(message: string): void {
        if(!this._storeWarnings)
            return;
        const cur = this._currentTag;
        const newMessage = `Error on ${this._line}:${this._column} while inside tag [${cur.tag} @ ${cur.line}:${cur.column}]: ${message}`;
        this._warnings.push(newMessage);
    }

    private parse(input: string, start: number, end: number): ParserTag[] {
        const ignoreClosing: {[key: string]: number} = {};

        function ignoreNextClosingTag(tagName: string): void {
            //tslint:disable-next-line:strict-boolean-expressions
            ignoreClosing[tagName] = (ignoreClosing[tagName] || 0) + 1;
        }

        const stack: ParserTag[] = [];

        function stackTop(): ParserTag {
            return stack[stack.length - 1];
        }

        function quickReset(i: number): void {
            stackTop().append(input, start, i + 1);
            start = i + 1;
            curType = BufferType.Raw;
        }

        let curType: BufferType = BufferType.Raw;
        // Root tag collects output.
        const rootTag = new ParserTag('<root>', '', this.createElement('span'), undefined, 1, 1);
        stack.push(rootTag);
        this._currentTag = rootTag;
        let paramStart = -1;
        for(let i = start; i < end; ++i) {
            const c = input[i];
            ++this._column;
            if(c === '\n') {
                ++this._line;
                this._column = 1;
                quickReset(i);
                stackTop().appendElement(this.createElement('br'));
            }
            switch(curType) {
                case BufferType.Raw:
                    if(c === '[') {
                        stackTop().append(input, start, i);
                        start = i;
                        curType = BufferType.Tag;
                    }
                    break;
                case BufferType.Tag:
                    if(c === '[') {
                        stackTop().append(input, start, i);
                        start = i;
                    } else if(c === '=' && paramStart === -1)
                        paramStart = i;
                    else if(c === ']') {
                        const paramIndex = paramStart === -1 ? i : paramStart;
                        let tagKey = input.substring(start + 1, paramIndex).trim();
                        if(tagKey.length === 0) {
                            quickReset(i);
                            continue;
                        }
                        let param = '';
                        if(paramStart !== -1)
                            param = input.substring(paramStart + 1, i).trim();
                        paramStart = -1;
                        const close = tagKey[0] === '/';
                        if(close) tagKey = tagKey.substr(1).trim();
                        if(typeof this._tags[tagKey] === 'undefined') {
                            quickReset(i);
                            continue;
                        }
                        if(!close) {
                            let allowed = true;
                            for(let k = stack.length - 1; k > 0; --k) {
                                allowed = allowed && this._tags[stack[k].tag]!.isAllowed(tagKey);
                                if(!allowed)
                                    break;
                            }
                            const tag = this._tags[tagKey]!;
                            if(!allowed) {
                                ignoreNextClosingTag(tagKey);
                                quickReset(i);
                                continue;
                            }
                            const parent = stackTop().element;
                            const el: HTMLElement | undefined = tag.createElement(this, parent, param);
                            if(el === undefined) {
                                quickReset(i);
                                continue;
                            }
                            (<HTMLElement & {bbcodeTag: string}>el).bbcodeTag = tagKey;
                            if(param.length > 0) (<HTMLElement & {bbcodeParam: string}>el).bbcodeParam = param;
                            if(!this._tags[tagKey]!.noClosingTag)
                                stack.push(new ParserTag(tagKey, param, el, parent, this._line, this._column));
                        } else if(ignoreClosing[tagKey] > 0) {
                            ignoreClosing[tagKey] -= 1;
                            stackTop().append(input, start, i + 1);
                        } else {
                            let closed = false;
                            for(let k = stack.length - 1; k >= 0; --k) {
                                if(stack[k].tag !== tagKey) continue;
                                for(let y = stack.length - 1; y >= k; --y) {
                                    const closeTag = <ParserTag>stack.pop();
                                    this._currentTag = closeTag;
                                    if(y > k)
                                        this.warning(`Unexpected closing ${tagKey} tag. Needed ${closeTag.tag} tag instead.`);
                                    this._tags[closeTag.tag]!.afterClose(this, closeTag.element, closeTag.parent, closeTag.param);
                                }
                                this._currentTag = stackTop();
                                closed = true;
                                break;
                            }
                            if(!closed) {
                                this.warning(`Found closing ${tagKey} tag that was never opened.`);
                                stackTop().append(input, start, i + 1);
                            }
                        }
                        start = i + 1;
                        curType = BufferType.Raw;
                    }
            }
        }
        if(start < input.length)
            stackTop().append(input, start, input.length);

        return stack;
    }
}