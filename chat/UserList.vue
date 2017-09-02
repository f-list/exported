<template>
    <div id="user-list" class="sidebar sidebar-right">
        <button @click="expanded = !expanded" class="btn btn-default btn-xs expander" :aria-label="l('users.title')">
            <span class="fa fa-users fa-rotate-270" style="vertical-align: middle"></span>
            <span class="fa" :class="{'fa-chevron-down': !expanded, 'fa-chevron-up': expanded}"></span>
        </button>
        <div class="body" :style="expanded ? 'display:flex' : ''" style="min-width: 200px; flex-direction:column; max-height: 100%;">
            <ul class="nav nav-tabs" style="flex-shrink:0">
                <li role="presentation" :class="{active: !channel || !memberTabShown}">
                    <a href="#" @click.prevent="memberTabShown = false">{{l('users.friends')}}</a>
                </li>
                <li role="presentation" :class="{active: memberTabShown}" v-show="channel">
                    <a href="#" @click.prevent="memberTabShown = true">{{l('users.members')}}</a>
                </li>
            </ul>
            <div v-show="!channel || !memberTabShown" class="users" style="padding-left: 10px;">
                <h4>{{l('users.friends')}}</h4>
                <div v-for="character in friends" :key="character.name">
                    <user :character="character" :showStatus="true"></user>
                </div>
                <h4>{{l('users.bookmarks')}}</h4>
                <div v-for="character in bookmarks" :key="character.name">
                    <user :character="character" :showStatus="true"></user>
                </div>
            </div>
            <div v-if="channel" v-show="memberTabShown" class="users" style="padding: 5px;">
                <div v-for="member in channel.sortedMembers" :key="member.character.name">
                    <user :character="member.character" :channel="channel"></user>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import core from './core';
    import {Channel, Character, Conversation} from './interfaces';
    import l from './localize';
    import UserView from './user_view';

    @Component({
        components: {user: UserView}
    })
    export default class UserList extends Vue {
        memberTabShown = false;
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

<style lang="less">
    @import '~bootstrap/less/variables.less';

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

        @media (min-width: @screen-sm-min) {
            position: static;
        }
    }
</style>