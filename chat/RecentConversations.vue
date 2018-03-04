<template>
    <modal :buttons="false" :action="l('chat.recentConversations')" dialogClass="w-100">
        <div style="display:flex; flex-direction:column; max-height:500px; flex-wrap:wrap;">
            <div v-for="recent in recentConversations" style="margin: 3px;">
                <user-view v-if="recent.character" :character="getCharacter(recent.character)"></user-view>
                <channel-view v-else :id="recent.channel" :text="recent.name"></channel-view>
            </div>
        </div>
    </modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import CustomDialog from '../components/custom_dialog';
    import Modal from '../components/Modal.vue';
    import ChannelView from './ChannelView.vue';
    import core from './core';
    import {Character, Conversation} from './interfaces';
    import l from './localize';
    import UserView from './user_view';

    @Component({
        components: {'user-view': UserView, 'channel-view': ChannelView, modal: Modal}
    })
    export default class RecentConversations extends CustomDialog {
        l = l;

        get recentConversations(): ReadonlyArray<Conversation.RecentConversation> {
            return core.conversations.recent;
        }

        getCharacter(name: string): Character {
            return core.characters.get(name);
        }
    }
</script>