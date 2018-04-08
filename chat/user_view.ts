//  TODO convert this to single-file once Vue supports it for functional components.
//template:
//<span class="gender" :class="genderClass" @click="click" @contextmenu.prevent="showMenu" style="cursor:pointer;" ref="main"><span
//class="fa" :class="statusIcon"></span> <span class="fa" :class="rankIcon"></span>{{character.name}}</span>

import Vue, {CreateElement, RenderContext, VNode} from 'vue';
import {Channel, Character} from '../fchat';
import core from './core';

export function getStatusIcon(status: Character.Status): string {
    switch(status) {
        case 'online':
            return 'far fa-user';
        case 'looking':
            return 'fa fa-eye';
        case 'dnd':
            return 'fa fa-minus-circle';
        case 'offline':
            return 'fa fa-ban';
        case 'away':
            return 'far fa-circle';
        case 'busy':
            return 'fa fa-cog';
        case 'idle':
            return 'far fa-clock';
        case 'crown':
            return 'fa fa-birthday-cake';
    }
}

//tslint:disable-next-line:variable-name
const UserView = Vue.extend({
    functional: true,
    render(this: void | Vue, createElement: CreateElement, context?: RenderContext): VNode {
        const props = <{character: Character, channel?: Channel, showStatus?: true}>(
            context !== undefined ? context.props : (<Vue>this).$options.propsData);
        const character = props.character;
        let rankIcon;
        if(character.isChatOp) rankIcon = 'far fa-gem';
        else if(props.channel !== undefined)
            rankIcon = props.channel.owner === character.name ? 'fa fa-key' : props.channel.opList.indexOf(character.name) !== -1 ?
                (props.channel.id.substr(0, 4) === 'adh-' ? 'fa fa-shield-alt' : 'fa fa-star') : '';
        else rankIcon = '';
        const children: (VNode | string)[] = [character.name];
        if(rankIcon !== '') children.unshift(createElement('span', {staticClass: rankIcon}));
        if(props.showStatus !== undefined || character.status === 'crown')
            children.unshift(createElement('span', {staticClass: `fa-fw ${getStatusIcon(character.status)}`}));
        const gender = character.gender !== undefined ? character.gender.toLowerCase() : 'none';
        const isBookmark = core.connection.isOpen && core.state.settings.colorBookmarks && (character.isFriend || character.isBookmarked);
        return createElement('span', {
            attrs: {class: `user-view gender-${gender}${isBookmark ? ' user-bookmark' : ''}`},
            domProps: {character, channel: props.channel, bbcodeTag: 'user'}
        }, children);
    }
});

export default UserView;