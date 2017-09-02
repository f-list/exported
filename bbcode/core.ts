import {BBCodeCustomTag, BBCodeParser, BBCodeSimpleTag} from './parser';

const urlFormat = '((?:(?:https?|ftps?|irc):)?\\/\\/[^\\s\\/$.?#"\']+\\.[^\\s"]*)';
export const findUrlRegex = new RegExp(`((?!\\[url(?:\\]|=))(?:.{4}[^\\s])\\s+|^.{0,4}\\s|^)${urlFormat}`, 'g');
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
        this.addTag('b', new BBCodeSimpleTag('b', 'strong'));
        this.addTag('i', new BBCodeSimpleTag('i', 'em'));
        this.addTag('u', new BBCodeSimpleTag('u', 'u'));
        this.addTag('s', new BBCodeSimpleTag('s', 'del'));
        this.addTag('noparse', new BBCodeSimpleTag('noparse', 'span', [], []));
        this.addTag('sub', new BBCodeSimpleTag('sub', 'sub', [], ['b', 'i', 'u', 's']));
        this.addTag('sup', new BBCodeSimpleTag('sup', 'sup', [], ['b', 'i', 'u', 's']));
        this.addTag('color', new BBCodeCustomTag('color', (parser, parent, param) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            const cregex = /^(red|blue|white|yellow|pink|gray|green|orange|purple|black|brown|cyan)$/;
            if(!cregex.test(param)) {
                parser.warning('Invalid color parameter provided.');
                return el;
            }
            el.className = `${param}Text`;
            return el;
        }));
        this.addTag('url', new BBCodeCustomTag('url', (parser, parent, _) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, _, param) => {
            const content = element.innerText.trim();
            while(element.firstChild !== null) element.removeChild(element.firstChild);

            let url: string, display: string = content;
            if(param.length > 0) {
                url = param.trim();
                if(content.length === 0) display = param;
            } else if(content.length > 0) url = content;
            else {
                parser.warning('url tag contains no url.');
                element.innerText = ''; //Dafuq!?
                return;
            }

            // This fixes problems where content based urls are marked as invalid if they contain spaces.
            url = fixURL(url);
            if(!urlRegex.test(url)) {
                element.innerText = `[BAD URL] ${url}`;
                return;
            }
            const a = parser.createElement('a');
            a.href = url;
            a.rel = 'nofollow noreferrer noopener';
            a.target = '_blank';
            a.className = 'link-graphic';
            a.title = url;
            a.innerText = display;
            element.appendChild(a);
            const span = document.createElement('span');
            span.className = 'link-domain';
            span.textContent = ` [${domain(url)}]`;
            element.appendChild(span);
        }, []));
    }

    parseEverything(input: string): HTMLElement {
        if(this.makeLinksClickable && input.length > 0) input = input.replace(findUrlRegex, '$1[url]$2[/url]');
        return super.parseEverything(input);
    }
}