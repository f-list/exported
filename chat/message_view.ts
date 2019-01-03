import {Component, Prop} from '@f-list/vue-ts';
import {CreateElement, default as Vue, VNode, VNodeChildrenArrayContents} from 'vue';
import {Channel} from '../fchat';
import {BBCodeView} from './bbcode';
import {formatTime} from './common';
import core from './core';
import {Conversation} from './interfaces';
import UserView from './user_view';

const userPostfix: {[key: number]: string | undefined} = {
    [Conversation.Message.Type.Message]: ': ',
    [Conversation.Message.Type.Ad]: ': ',
    [Conversation.Message.Type.Action]: ''
};
@Component({
    render(this: MessageView, createElement: CreateElement): VNode {
        const message = this.message;
        const children: VNodeChildrenArrayContents =
            [createElement('span', {staticClass: 'message-time'}, `[${formatTime(message.time)}] `)];
        const separators = core.connection.isOpen ? core.state.settings.messageSeparators : false;
        /*tslint:disable-next-line:prefer-template*///unreasonable here
        let classes = `message message-${Conversation.Message.Type[message.type].toLowerCase()}` + (separators ? ' message-block' : '') +
            (message.type !== Conversation.Message.Type.Event && message.sender.name === core.connection.character ? ' message-own' : '') +
            ((this.classes !== undefined) ? ` ${this.classes}` : '');
        if(message.type !== Conversation.Message.Type.Event) {
            children.push((message.type === Conversation.Message.Type.Action) ? '*' : '',
                createElement(UserView, {props: {character: message.sender, channel: this.channel}}),
                userPostfix[message.type] !== undefined ? userPostfix[message.type]! : ' ');
            if(message.isHighlight) classes += ' message-highlight';
        }
        const isAd = message.type === Conversation.Message.Type.Ad && !this.logs;
        children.push(createElement(BBCodeView, {props: {unsafeText: message.text, afterInsert: isAd ? (elm: HTMLElement) => {
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
        node.key = message.id;
        return node;
    }
})
export default class MessageView extends Vue {
    @Prop({required: true})
    readonly message!: Conversation.Message;
    @Prop
    readonly classes?: string;
    @Prop
    readonly channel?: Channel;
    @Prop
    readonly logs?: true;
}