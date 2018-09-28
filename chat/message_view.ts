import {Component, CreateElement, RenderContext, VNode, VNodeChildrenArrayContents} from 'vue';
import {Channel} from '../fchat';
import {BBCodeView} from './bbcode';
import {formatTime} from './common';
import core from './core';
import {Conversation} from './interfaces';
import UserView from './user_view';
//  TODO convert this to single-file once Vue supports it for functional components.
// template:
// <span>[{{formatTime(message.time)}}]</span>
// <span v-show="message.type == MessageTypes.Action">*</span>
// <span><user :character="message.sender" :reportDialog="$refs['reportDialog']"></user></span>
// <span v-show="message.type == MessageTypes.Message">:</span>
// <bbcode :text="message.text"></bbcode>

const userPostfix: {[key: number]: string | undefined} = {
    [Conversation.Message.Type.Message]: ': ',
    [Conversation.Message.Type.Ad]: ': ',
    [Conversation.Message.Type.Action]: ''
};
//tslint:disable-next-line:variable-name
const MessageView: Component = {
    functional: true,
    render(createElement: CreateElement,
           context: RenderContext<{message: Conversation.Message, classes?: string, channel?: Channel}>): VNode {
        const message = context.props.message;
        const children: VNodeChildrenArrayContents =
            [createElement('span', {staticClass: 'message-time'}, `[${formatTime(message.time)}] `)];
        const separators = core.connection.isOpen ? core.state.settings.messageSeparators : false;
        /*tslint:disable-next-line:prefer-template*///unreasonable here
        let classes = `message message-${Conversation.Message.Type[message.type].toLowerCase()}` + (separators ? ' message-block' : '') +
            (message.type !== Conversation.Message.Type.Event && message.sender.name === core.connection.character ? ' message-own' : '') +
            ((context.props.classes !== undefined) ? ` ${context.props.classes}` : '');
        if(message.type !== Conversation.Message.Type.Event) {
            children.push((message.type === Conversation.Message.Type.Action) ? '*' : '',
                createElement(UserView, {props: {character: message.sender, channel: context.props.channel}}),
                userPostfix[message.type] !== undefined ? userPostfix[message.type]! : ' ');
            if(message.isHighlight) classes += ' message-highlight';
        }
        children.push(createElement(BBCodeView,
            {props: {unsafeText: message.text, afterInsert: message.type === Conversation.Message.Type.Ad ? (elm: HTMLElement) => {
            setImmediate(() => {
                elm = elm.parentElement!;
                if(elm.scrollHeight > elm.offsetHeight) {
                    const expand = document.createElement('div');
                    expand.className = 'expand fas fa-caret-down';
                    expand.addEventListener('click', function(): void { this.parentElement!.className += ' expanded'; });
                    elm.appendChild(expand);
                }
            });
        } : undefined}}));
        const node = createElement('div', {attrs: {class: classes}}, children);
        node.key = context.data.key;
        return node;
    }
};

export default MessageView;