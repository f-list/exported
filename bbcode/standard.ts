import * as $ from 'jquery';
import {CoreBBCodeParser} from './core';
import {InlineDisplayMode} from './interfaces';
import {BBCodeCustomTag, BBCodeSimpleTag} from './parser';

interface InlineImage {
    id: number
    hash: string
    extension: string
    nsfw: boolean
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
            outer.className = 'collapseHeader';
            const headerText = parser.createElement('div');
            headerText.className = 'collapseHeaderText';
            outer.appendChild(headerText);
            const innerText = parser.createElement('span');
            innerText.appendChild(document.createTextNode(param));
            headerText.appendChild(innerText);
            const body = parser.createElement('div');
            body.className = 'collapseBlock';
            outer.appendChild(body);
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
        this.addTag('img', new BBCodeCustomTag('img', (p, parent, param) => {
            const parser = <StandardBBCodeParser>p;
            if(!this.allowInlines) {
                parser.warning('Inline images are not allowed here.');
                return undefined;
            }
            if(typeof parser.inlines === 'undefined') {
                parser.warning('This page does not support inline images.');
                return undefined;
            }
            let p1: string, p2: string, inline;
            const displayMode = this.settings.inlineDisplayMode;
            if(!/^\d+$/.test(param)) {
                parser.warning('img tag parameters must be numbers.');
                return undefined;
            }
            if(typeof parser.inlines[param] !== 'object') {
                parser.warning(`Could not find an inline image with id ${param} It will not be visible.`);
                return undefined;
            }
            inline = parser.inlines[param]!;
            p1 = inline.hash.substr(0, 2);
            p2 = inline.hash.substr(2, 2);

            if(displayMode === InlineDisplayMode.DISPLAY_NONE || (displayMode === InlineDisplayMode.DISPLAY_SFW && inline.nsfw)) {
                const el = parser.createElement('a');
                el.className = 'unloadedInline';
                el.href = '#';
                el.dataset.inlineId = param;
                el.onclick = () => {
                    $('.unloadedInline').each((_, element) => {
                        const inlineId = $(element).data('inline-id');
                        if(typeof parser.inlines![inlineId] !== 'object')
                            return;
                        const showInline = parser.inlines![inlineId]!;
                        const showP1 = showInline.hash.substr(0, 2);
                        const showP2 = showInline.hash.substr(2, 2);
                        //tslint:disable-next-line:max-line-length
                        $(element).replaceWith(`<div><img class="inline-image" src="${this.settings.staticDomain}images/charinline/${showP1}/${showP2}/${showInline.hash}.${showInline.extension}"/></div>`);
                    });
                    return false;
                };
                const prefix = inline.nsfw ? '[NSFW Inline] ' : '[Inline] ';
                el.appendChild(document.createTextNode(prefix));
                parent.appendChild(el);
                return el;
            } else {
                const outerEl = parser.createElement('div');
                const el = parser.createElement('img');
                el.className = 'inline-image';
                el.src = `${this.settings.staticDomain}images/charinline/${p1}/${p2}/${inline.hash}.${inline.extension}`;
                outerEl.appendChild(el);
                parent.appendChild(outerEl);
                return el;
            }
        }, (_, element, __, ___) => {
            // Need to remove any appended contents, because this is a total hack job.
            if(element.className !== 'inline-image')
                return;
            while(element.firstChild !== null)
                element.removeChild(element.firstChild);
        }, []));
    }
}

export function initCollapse(): void {
    $('.collapseHeader[data-bound!=true]').each((_, element) => {
        const $element = $(element);
        const $body = $element.children('.collapseBlock');
        $element.children('.collapseHeaderText').on('click', () => {
            if($element.hasClass('expandedHeader')) {
                $body.css('max-height', '0');
                $element.removeClass('expandedHeader');
            } else {
                $body.css('max-height', 'none');
                const height = $body.outerHeight();
                $body.css('max-height', '0');
                $element.addClass('expandedHeader');
                setTimeout(() => $body.css('max-height', height!), 1);
                setTimeout(() => $body.css('max-height', 'none'), 250);
            }
        });
    });
    $('.collapseHeader').attr('data-bound', 'true');
}

export let standardParser: StandardBBCodeParser;

export function initParser(settings: StandardParserSettings): void {
    standardParser = new StandardBBCodeParser(settings);
}