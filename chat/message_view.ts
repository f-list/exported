import Vue, {Component, CreateElement, RenderContext, VNode, VNodeChildren} from 'vue';
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
    render(this: Vue, createElement: CreateElement, context: RenderContext): VNode {
        /*tslint:disable:no-unsafe-any*///context.props is any
        const message: Conversation.Message = context.props.message;
        const children: (VNode | string | VNodeChildren)[] = [`[${formatTime(message.time)}] `];
        /*tslint:disable-next-line:prefer-template*///unreasonable here
        let classes = `message message-${Conversation.Message.Type[message.type].toLowerCase()}` +
            (core.state.settings.messageSeparators ? ' message-block' : '') +
            (message.type !== Conversation.Message.Type.Event && message.sender.name === core.connection.character ? ' message-own' : '') +
            ((context.props.classes !== undefined) ? ` ${context.props.classes}` : '');
        if(message.type !== Conversation.Message.Type.Event) {
            children.push((message.type === Conversation.Message.Type.Action) ? '*' : '',
                createElement(UserView, {props: {character: message.sender, channel: context.props.channel}}),
                userPostfix[message.type] !== undefined ? userPostfix[message.type]! : ' ');
            if(message.isHighlight) classes += ' message-highlight';
        }
        children.push(createElement(BBCodeView, {props: {unsafeText: message.text}}));
        const node = createElement('div', {attrs: {class: classes}}, children);
        node.key = context.data.key;
        return node;
        //tslint:enable
    }
};

export default MessageView;