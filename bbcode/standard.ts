import {CoreBBCodeParser} from './core';
import {InlineDisplayMode} from './interfaces';
import {BBCodeCustomTag, BBCodeSimpleTag} from './parser';

interface InlineImage {
    id: number
    hash: string
    extension: string
    nsfw: boolean
    name?: string
}

interface StandardParserSettings {
    siteDomain: string
    staticDomain: string
    animatedIcons: boolean
    inlineDisplayMode: InlineDisplayMode
}

const usernameRegex = /^[a-zA-Z0-9_\-\s]+$/;

export class StandardBBCodeParser extends CoreBBCodeParser {
    allowInlines = true;
    inlines: {[key: string]: InlineImage | undefined} | undefined;

    createInline(inline: InlineImage): HTMLElement {
        const p1 = inline.hash.substr(0, 2);
        const p2 = inline.hash.substr(2, 2);
        const outerEl = this.createElement('div');
        const el = this.createElement('img');
        el.className = 'inline-image';
        el.title = el.alt = inline.name!;
        el.src = `${this.settings.staticDomain}images/charinline/${p1}/${p2}/${inline.hash}.${inline.extension}`;
        outerEl.appendChild(el);
        return outerEl;
    }

    constructor(public settings: StandardParserSettings) {
        super();
        const hrTag = new BBCodeSimpleTag('hr', 'hr', [], []);
        hrTag.noClosingTag = true;
        this.addTag('hr', hrTag);
        this.addTag('quote', new BBCodeCustomTag('quote', (parser, parent, param) => {
            if(param !== '')
                parser.warning('Unexpected paramter on quote tag.');
            const element = parser.createElement('blockquote');
            const innerElement = parser.createElement('div');
            innerElement.className = 'quoteHeader';
            innerElement.appendChild(document.createTextNode('Quote:'));
            element.appendChild(innerElement);
            parent.appendChild(element);
            return element;
        }));
        this.addTag('left', new BBCodeSimpleTag('left', 'span', ['leftText']));
        this.addTag('right', new BBCodeSimpleTag('right', 'span', ['rightText']));
        this.addTag('center', new BBCodeSimpleTag('center', 'span', ['centerText']));
        this.addTag('justify', new BBCodeSimpleTag('justify', 'span', ['justifyText']));
        this.addTag('big', new BBCodeSimpleTag('big', 'span', ['bigText'], ['url', 'i', 'u', 'b', 'color', 's']));
        this.addTag('small', new BBCodeSimpleTag('small', 'span', ['smallText'], ['url', 'i', 'u', 'b', 'color', 's']));
        this.addTag('indent', new BBCodeSimpleTag('indent', 'div', ['indentText']));
        this.addTag('heading', new BBCodeSimpleTag('heading', 'h2', [], ['url', 'i', 'u', 'b', 'color', 's']));
        this.addTag('collapse', new BBCodeCustomTag('collapse', (parser, parent, param) => {
            if(param === '') { //tslint:disable-line:curly
                parser.warning('title parameter is required.');
                // HACK: Compatability fix with old site. Titles are not trimmed on old site, so empty collapse titles need to be allowed.
                //return null;
            }
            const outer = parser.createElement('div');
            outer.className = 'card bg-light bbcode-collapse';
            const headerText = parser.createElement('div');
            headerText.className = 'card-header bbcode-collapse-header';
            const icon = parser.createElement('i');
            icon.className = 'fas fa-chevron-down';
            icon.style.marginRight = '10px';
            headerText.appendChild(icon);
            headerText.appendChild(document.createTextNode(param));
            outer.appendChild(headerText);
            const body = parser.createElement('div');
            body.className = 'card-body bbcode-collapse-body closed';
            body.style.height = '0';
            outer.appendChild(body);
            headerText.addEventListener('click', () => {
                const isCollapsed = parseInt(body.style.height!, 10) === 0;
                body.style.height = isCollapsed ? `${body.scrollHeight}px` : '0';
                icon.className = `fas fa-chevron-${isCollapsed ? 'up' : 'down'}`;
            });
            parent.appendChild(outer);
            return body;
        }));
        this.addTag('user', new BBCodeCustomTag('user', (parser, parent, _) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, parent, param) => {
            if(param !== '')
                parser.warning('Unexpected parameter on user tag.');
            const content = element.innerText;
            if(!usernameRegex.test(content))
                return;
            const a = parser.createElement('a');
            a.href = `${this.settings.siteDomain}c/${content}`;
            a.target = '_blank';
            a.className = 'character-link';
            a.appendChild(document.createTextNode(content));
            parent.replaceChild(a, element);
        }, []));
        this.addTag('icon', new BBCodeCustomTag('icon', (parser, parent, _) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, parent, param) => {
            if(param !== '')
                parser.warning('Unexpected parameter on icon tag.');
            const content = element.innerText;
            if(!usernameRegex.test(content))
                return;
            const a = parser.createElement('a');
            a.href = `${this.settings.siteDomain}c/${content}`;
            a.target = '_blank';
            const img = parser.createElement('img');
            img.src = `${this.settings.staticDomain}images/avatar/${content.toLowerCase()}.png`;
            img.className = 'character-avatar icon';
            a.appendChild(img);
            parent.replaceChild(a, element);
        }, []));
        this.addTag('eicon', new BBCodeCustomTag('eicon', (parser, parent, _) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, parent, param) => {
            if(param !== '')
                parser.warning('Unexpected parameter on eicon tag.');
            const content = element.innerText;

            if(!usernameRegex.test(content))
                return;
            let extension = '.gif';
            if(!this.settings.animatedIcons)
                extension = '.png';
            const img = parser.createElement('img');
            img.src = `${this.settings.staticDomain}images/eicon/${content.toLowerCase()}${extension}`;
            img.className = 'character-avatar icon';
            parent.replaceChild(img, element);
        }, []));
        this.addTag('img', new BBCodeCustomTag('img', (parser, parent) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (p, element, parent, param) => {
            const content = element.textContent!;
            const parser = <StandardBBCodeParser>p;
            if(!this.allowInlines) {
                parser.warning('Inline images are not allowed here.');
                return undefined;
            }
            if(typeof parser.inlines === 'undefined') {
                parser.warning('This page does not support inline images.');
                return undefined;
            }
            const displayMode = this.settings.inlineDisplayMode;
            if(!/^\d+$/.test(param)) {
                parser.warning('img tag parameters must be numbers.');
                return undefined;
            }
            const inline = parser.inlines[param];
            if(typeof inline !== 'object') {
                parser.warning(`Could not find an inline image with id ${param} It will not be visible.`);
                return undefined;
            }
            inline.name = content;
            if(displayMode === InlineDisplayMode.DISPLAY_NONE || (displayMode === InlineDisplayMode.DISPLAY_SFW && inline.nsfw)) {
                const el = parser.createElement('a');
                el.className = 'unloadedInline';
                el.href = '#';
                el.dataset.inlineId = param;
                el.onclick = () => {
                    Array.prototype.forEach.call(document.getElementsByClassName('unloadedInline'), ((e: HTMLElement) => {
                        const showInline = parser.inlines![e.dataset.inlineId!];
                        if(typeof showInline !== 'object') return;
                        e.parentElement!.replaceChild(parser.createInline(showInline), e);
                    }));
                    return false;
                };
                const prefix = inline.nsfw ? '[NSFW Inline] ' : '[Inline] ';
                el.appendChild(document.createTextNode(prefix));
                parent.replaceChild(el, element);
            } else parent.replaceChild(parser.createInline(inline), element);
        }, []));
    }
}

export let standardParser: StandardBBCodeParser;

export function initParser(settings: StandardParserSettings): void {
    standardParser = new StandardBBCodeParser(settings);
}