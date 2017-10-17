import Vue, {Component, CreateElement, RenderContext, VNode} from 'vue';
import {CoreBBCodeParser} from '../bbcode/core';
//tslint:disable-next-line:match-default-export-name
import BaseEditor from '../bbcode/Editor.vue';
import {BBCodeCustomTag} from '../bbcode/parser';
import ChannelView from './ChannelView.vue';
import {characterImage} from './common';
import core from './core';
import {Character} from './interfaces';
import UserView from './user_view';

export const BBCodeView: Component = {
    functional: true,
    render(createElement: CreateElement, context: RenderContext): VNode {
        /*tslint:disable:no-unsafe-any*///because we're not actually supposed to do any of this
        context.data.hook = {
            insert(): void {
                if(vnode.elm !== undefined)
                    vnode.elm.appendChild(core.bbCodeParser.parseEverything(
                        context.props.text !== undefined ? context.props.text : context.props.unsafeText));
            },
            destroy(): void {
                const element = (<BBCodeElement>(<Element>vnode.elm).firstChild);
                if(element.cleanup !== undefined) element.cleanup();
            }
        };
        context.data.staticClass = `bbcode${context.data.staticClass !== undefined ? ` ${context.data.staticClass}` : ''}`;
        const vnode = createElement('span', context.data);
        vnode.key = context.props.text;
        return vnode;
        //tslint:enable
    }
};

export class Editor extends BaseEditor {
    parser = core.bbCodeParser;
}

export type BBCodeElement = HTMLElement & {cleanup?(): void};

export default class BBCodeParser extends CoreBBCodeParser {
    cleanup: Vue[] = [];

    constructor() {
        super();
        this.addTag('user', new BBCodeCustomTag('user', (parser, parent) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, _, param) => {
            if(param.length > 0)
                parser.warning('Unexpected parameter on user tag.');
            const content = element.innerText;
            element.innerText = '';
            const uregex = /^[a-zA-Z0-9_\-\s]+$/;
            if(!uregex.test(content))
                return;
            const view = new UserView({el: element, propsData: {character: core.characters.get(content)}});
            this.cleanup.push(view);
        }, []));
        this.addTag('icon', new BBCodeCustomTag('icon', (parser, parent) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, parent, param) => {
            if(param.length > 0)
                parser.warning('Unexpected parameter on icon tag.');
            const content = element.innerText;
            const uregex = /^[a-zA-Z0-9_\-\s]+$/;
            if(!uregex.test(content))
                return;
            const img = parser.createElement('img');
            img.src = characterImage(content);
            img.style.cursor = 'pointer';
            img.className = 'characterAvatarIcon';
            img.title = img.alt = content;
            (<HTMLImageElement & {character: Character}>img).character = core.characters.get(content);
            parent.replaceChild(img, element);
        }, []));
        this.addTag('eicon', new BBCodeCustomTag('eicon', (parser, parent) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (parser, element, parent, param) => {
            if(param.length > 0)
                parser.warning('Unexpected parameter on eicon tag.');
            const content = element.innerText;
            const uregex = /^[a-zA-Z0-9_\-\s]+$/;
            if(!uregex.test(content))
                return;
            const extension = core.state.settings.animatedEicons ? 'gif' : 'png';
            const img = parser.createElement('img');
            img.src = `https://static.f-list.net/images/eicon/${content.toLowerCase()}.${extension}`;
            img.title = img.alt = content;
            img.className = 'characterAvatarIcon';
            parent.replaceChild(img, element);
        }, []));
        this.addTag('session', new BBCodeCustomTag('session', (parser, parent) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (_, element, __, param) => {
            const content = element.innerText;
            element.innerText = '';
            const view = new ChannelView({el: element, propsData: {id: content, text: param}});
            this.cleanup.push(view);
        }, []));
        this.addTag('channel', new BBCodeCustomTag('channel', (parser, parent) => {
            const el = parser.createElement('span');
            parent.appendChild(el);
            return el;
        }, (_, element, __, ___) => {
            const content = element.innerText;
            element.innerText = '';
            const view = new ChannelView({el: element, propsData: {id: content, text: content}});
            this.cleanup.push(view);
        }, []));
    }

    parseEverything(input: string): BBCodeElement {
        const elm = <BBCodeElement>super.parseEverything(input);
        if(this.cleanup.length > 0)
            elm.cleanup = ((cleanup: Vue[]) => () => {
                for(const component of cleanup) component.$destroy();
            })(this.cleanup);
        this.cleanup = [];
        return elm;
    }
}