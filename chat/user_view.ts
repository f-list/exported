//  TODO convert this to single-file once Vue supports it for functional components.
//template:
//<span class="gender" :class="genderClass" @click="click" @contextmenu.prevent="showMenu" style="cursor:pointer;" ref="main"><span
//class="fa" :class="statusIcon"></span> <span class="fa" :class="rankIcon"></span>{{character.name}}</span>

import Vue, {CreateElement, RenderContext, VNode} from 'vue';
import {Channel, Character} from './interfaces';

export function getStatusIcon(status: Character.Status): string {
    switch(status) {
        case 'online':
            return 'fa-user-o';
        case 'looking':
            return 'fa-eye';
        case 'dnd':
            return 'fa-minus-circle';
        case 'offline':
            return 'fa-ban';
        case 'away':
            return 'fa-circle-o';
        case 'busy':
            return 'fa-cog';
        case 'idle':
            return 'fa-hourglass';
        case 'crown':
            return 'fa-birthday-cake';
    }
}

//tslint:disable-next-line:variable-name
const UserView = Vue.extend({
    functional: true,
    render(this: Vue, createElement: CreateElement, context?: RenderContext): VNode {
        const props = <{character: Character, channel?: Channel, showStatus?: true}>(
            /*tslint:disable-next-line:no-unsafe-any*///false positive
            context !== undefined && context.props !== undefined ? context.props : this.$options.propsData);
        const character = props.character;
        let rankIcon;
        if(character.isChatOp) rankIcon = 'fa-diamond';
        else if(props.channel !== undefined) {
            const member = props.channel.members[character.name];
            if(member !== undefined)
                rankIcon = member.rank === Channel.Rank.Owner ? 'fa-asterisk' :
                    member.rank === Channel.Rank.Op ? (props.channel.id.substr(0, 4) === 'adh-' ? 'fa-at' : 'fa-play') : '';
            else rankIcon = '';
        } else rankIcon = '';

        const html = (props.showStatus !== undefined ? `<span class="fa fa-fw ${getStatusIcon(character.status)}"></span>` : '') +
            (rankIcon !== '' ? `<span class="fa ${rankIcon}"></span>` : '') + character.name;
        return createElement('span', {
            attrs: {class: `user-view gender-${character.gender !== undefined ? character.gender.toLowerCase() : 'none'}`},
            domProps: {character, channel: props.channel, innerHTML: html}
        });
    }
});

export default UserView;