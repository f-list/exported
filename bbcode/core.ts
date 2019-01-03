import {BBCodeCustomTag, BBCodeParser, BBCodeSimpleTag, BBCodeTextTag} from './parser';

const urlFormat = '((?:https?|ftps?|irc)://[^\\s/$.?#"\']+\\.[^\\s"]+)';
export const findUrlRegex = new RegExp(`(\\[url[=\\]]\\s*)?${urlFormat}`, 'gi');
export const urlRegex = new RegExp(`^${urlFormat}$`);

function domain(url: string): string | undefined {
    const pieces = urlRegex.exec(url);
    if(pieces === null) return;
    const match = pieces[1].match(/(?:(https?|ftps?|irc):)?\/\/(?:www.)?([^\/]+)/);
    return match !== null ? match[2] : undefined;
}

function fixURL(url: string): string {
    if(/^www\./.test(url))
        url = `https://${url}`;
    return url.replace(/ /g, '%20');
}

export class CoreBBCodeParser extends BBCodeParser {
    /*tslint:disable-next-line:typedef*///https://github.com/palantir/tslint/issues/711
    constructor(public makeLinksClickable = true) {
        super();
        this.addTag(new BBCodeSimpleTag('b', 'strong'));
        this.addTag(new BBCodeSimpleTag('i', 'em'));
        this.addTag(new BBCodeSimpleTag('u', 'u'));
        this.addTag(new BBCodeSimpleTag('s', 'del'));
        this.addTag(new BBCodeSimpleTag('noparse', 'span', [], []));
        this.addTag(new BBCodeSimpleTag('sub', 'sub', [], ['b', 'i', 'u', 's', 'color']));
        this.addTag(new BBCodeSimpleTag('sup', 'sup', [], ['b', 'i', 'u', 's', 'color']));
        this.addTag(new BBCodeCustomTag('color', (parser, parent, param) => {
            const cregex = /^(red|blue|white|yellow|pink|gray|green|orange|purple|black|brown|cyan)$/;
            if(!cregex.test(param)) {
                parser.warning('Invalid color parameter provided.');
                return undefined;
            }
            const el = parser.createElement('span');
            el.className = `${param}Text`;
            parent.appendChild(el);
            return el;
        }));
        this.addTag(new BBCodeTextTag('url', (parser, parent, param, content) => {
            const element = parser.createElement('span');
            parent.appendChild(element);

            let url: string, display: string = content;
            if(param.length > 0) {
                url = param.trim();
                if(content.length === 0) display = param;
            } else if(content.length > 0) url = content;
            else {
                parser.warning('url tag contains no url.');
                element.textContent = '';
                return;
            }

            // This fixes problems where content based urls are marked as invalid if they contain spaces.
            url = fixURL(url);
            if(!urlRegex.test(url)) {
                element.textContent = `[BAD URL] ${url}`;
                return;
            }
            const fa = parser.createElement('i');
            fa.className = 'fa fa-link';
            element.appendChild(fa);
            const a = parser.createElement('a');
            a.href = url;
            a.rel = 'nofollow noreferrer noopener';
            a.target = '_blank';
            a.className = 'user-link';
            a.title = url;
            a.textContent = display;
            element.appendChild(a);
            const span = document.createElement('span');
            span.className = 'link-domain bbcode-pseudo';
            span.textContent = ` [${domain(url)}]`;
            element.appendChild(span);
            return element;
        }));
    }

    parseEverything(input: string): HTMLElement {
        if(this.makeLinksClickable && input.length > 0)
            input = input.replace(findUrlRegex, (match, tag) => tag === undefined ? `[url]${match}[/url]` : match);
        return super.parseEverything(input);
    }
}