<template>
    <sidebar id="user-list" :label="l('users.title')" icon="fa-users" :right="true" :open="expanded">
        <tabs style="flex-shrink:0" :tabs="channel ? [l('users.friends'), l('users.members')] : [l('users.friends')]" v-model="tab"></tabs>
        <div class="users" style="padding-left:10px" v-show="tab == 0">
            <h4>{{l('users.friends')}}</h4>
            <div v-for="character in friends" :key="character.name">
                <user :character="character" :showStatus="true"></user>
            </div>
            <h4>{{l('users.bookmarks')}}</h4>
            <div v-for="character in bookmarks" :key="character.name">
                <user :character="character" :showStatus="true"></user>
            </div>
        </div>
        <div v-if="channel" class="users" style="padding:5px" v-show="tab == 1">
            <h4>{{l('users.memberCount', channel.sortedMembers.length)}}</h4>
            <div v-for="member in channel.sortedMembers" :key="member.character.name">
                <user :character="member.character" :channel="channel" :showStatus="true"></user>
            </div>
        </div>
    </sidebar>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import Tabs from '../components/tabs';
    import core from './core';
    import {Channel, Character, Conversation} from './interfaces';
    import l from './localize';
    import Sidebar from './Sidebar.vue';
    import UserView from './user_view';

    @Component({
        components: {user: UserView, sidebar: Sidebar, tabs: Tabs}
    })
    export default class UserList extends Vue {
        tab = '0';
        expanded = window.innerWidth >= 992;
        l = l;
        sorter = (x: Character, y: Character) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0));

        get friends(): Character[] {
            return core.characters.friends.slice().sort(this.sorter);
        }

        get bookmarks(): Character[] {
            return core.characters.bookmarks.slice().filter((x) => core.characters.friends.indexOf(x) === -1).sort(this.sorter);
        }

        get channel(): Channel {
            return (<Conversation.ChannelConversation>core.conversations.selectedConversation).channel;
        }
    }
</script>

<style lang="scss">
    @import "~bootstrap/scss/functions";
    @import "~bootstrap/scss/variables";
    @import "~bootstrap/scss/mixins/breakpoints";

    #user-list {
        flex-direction: column;
        h4 {
            margin: 5px 0 0 -5px;
            font-size: 17px;
        }

        .users {
            overflow: auto;
        }

        .nav li:first-child a {
            border-left: 0;
            border-top-left-radius: 0;
        }

        @media (min-width: breakpoint-min(md)) {
            .sidebar {
                position: static;
                margin: 0;
                padding: 0;
                height: 100%;
            }

            .modal-backdrop {
                display: none;
            }
        }

        &.open .body {
            display: flex;
        }
    }
</style>