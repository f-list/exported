<template>
    <div style="height:100%; display: flex; position: relative;" id="chatView" @click="$refs['userMenu'].handleEvent($event)"
        @contextmenu="$refs['userMenu'].handleEvent($event)" @touchstart="$refs['userMenu'].handleEvent($event)"
        @touchend="$refs['userMenu'].handleEvent($event)">
        <div class="sidebar sidebar-left" id="sidebar">
            <button @click="sidebarExpanded = !sidebarExpanded" class="btn btn-default btn-xs expander" :aria-label="l('chat.menu')">
                <span class="fa" :class="{'fa-chevron-up': sidebarExpanded, 'fa-chevron-down': !sidebarExpanded}"></span>
                <span class="fa fa-bars fa-rotate-90" style="vertical-align: middle"></span>
            </button>
            <div class="body" :style="sidebarExpanded ? 'display:block' : ''"
                style="width: 200px; padding-right: 5px; height: 100%; overflow: auto;">
                <img :src="characterImage(ownCharacter.name)" v-if="showAvatars" style="float:left; margin-right:5px; width:60px;"/>
                {{ownCharacter.name}}
                <a href="#" @click.prevent="logOut" class="btn"><span class="fa fa-sign-out"></span>{{l('chat.logout')}}</a><br/>
                <div>
                    {{l('chat.status')}}
                    <a href="#" @click.prevent="$refs['statusDialog'].show()" class="btn">
                        <span class="fa fa-fw" :class="getStatusIcon(ownCharacter.status)"></span>{{l('status.' + ownCharacter.status)}}
                    </a>
                </div>
                <div style="clear:both;">
                    <a href="#" @click.prevent="$refs['searchDialog'].show()" class="btn"><span class="fa fa-search"></span>
                        {{l('characterSearch.open')}}</a>
                </div>
                <div><a href="#" @click.prevent="$refs['settingsDialog'].show()" class="btn"><span class="fa fa-cog"></span>
                    {{l('settings.open')}}</a></div>
                <div><a href="#" @click.prevent="$refs['recentDialog'].show()" class="btn"><span class="fa fa-history"></span>
                    {{l('chat.recentConversations')}}</a></div>
                <div>
                    <div class="list-group conversation-nav">
                        <a :class="getClasses(conversations.consoleTab)" href="#" @click.prevent="conversations.consoleTab.show()"
                            class="list-group-item list-group-item-action">
                            {{conversations.consoleTab.name}}
                        </a>
                    </div>
                </div>
                <div>
                    {{l('chat.pms')}}
                    <div class="list-group conversation-nav" ref="privateConversations">
                        <a v-for="conversation in conversations.privateConversations" href="#" @click.prevent="conversation.show()"
                            :class="getClasses(conversation)" :data-character="conversation.character.name"
                            class="list-group-item list-group-item-action item-private" :key="conversation.key">
                            <img :src="characterImage(conversation.character.name)" v-if="showAvatars"/>
                            <div class="name">
                                <span>{{conversation.character.name}}</span>
                                <div style="text-align:right;line-height:0">
                                    <span class="fa"
                                        :class="{'fa-commenting': conversation.typingStatus == 'typing', 'fa-comment': conversation.typingStatus == 'paused'}"
                                    ></span><span class="pin fa fa-thumb-tack" :class="{'active': conversation.isPinned}" @mousedown.prevent
                                    @click.stop="conversation.isPinned = !conversation.isPinned" :aria-label="l('chat.pinTab')"></span>
                                    <span class="fa fa-times leave" @click.stop="conversation.close()"
                                        :aria-label="l('chat.closeTab')"></span>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>
                <div>
                    <a href="#" @click.prevent="$refs['channelsDialog'].show()" class="btn"><span class="fa fa-list"></span>
                        {{l('chat.channels')}}</a>
                    <div class="list-group conversation-nav" ref="channelConversations">
                        <a v-for="conversation in conversations.channelConversations" href="#" @click.prevent="conversation.show()"
                            :class="getClasses(conversation)" class="list-group-item list-group-item-action item-channel"
                            :key="conversation.key"><span class="name">{{conversation.name}}</span><span><span class="pin fa fa-thumb-tack"
                            :class="{'active': conversation.isPinned}" @click.stop="conversation.isPinned = !conversation.isPinned"
                            :aria-label="l('chat.pinTab')" @mousedown.prevent></span><span class="fa fa-times leave"
                            @click.stop="conversation.close()" :aria-label="l('chat.closeTab')"></span></span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div style="width: 100%; display:flex; flex-direction:column;">
            <div id="quick-switcher" class="list-group">
                <a v-for="conversation in conversations.privateConversations" href="#" @click.prevent="conversation.show()"
                    :class="getClasses(conversation)" class="list-group-item list-group-item-action" :key="conversation.key">
                    <img :src="characterImage(conversation.character.name)" v-if="showAvatars"/>
                    <span class="fa fa-user-circle-o conversation-icon" v-else></span>
                    <div class="name">{{conversation.character.name}}</div>
                </a>
                <a v-for="conversation in conversations.channelConversations" href="#" @click.prevent="conversation.show()"
                    :class="getClasses(conversation)" class="list-group-item list-group-item-action" :key="conversation.key">
                    <span class="fa fa-hashtag conversation-icon"></span>
                    <div class="name">{{conversation.name}}</div>
                </a>
            </div>
            <conversation :reportDialog="$refs['reportDialog']"></conversation>
        </div>
        <user-list></user-list>
        <channels ref="channelsDialog"></channels>
        <status-switcher ref="statusDialog"></status-switcher>
        <character-search ref="searchDialog"></character-search>
        <settings ref="settingsDialog"></settings>
        <report-dialog ref="reportDialog"></report-dialog>
        <user-menu ref="userMenu" :reportDialog="$refs['reportDialog']"></user-menu>
        <recent-conversations ref="recentDialog"></recent-conversations>
    </div>
</template>

<script lang="ts">
    //tslint:disable-next-line:no-require-imports
    import Sortable = require('sortablejs');
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import ChannelList from './ChannelList.vue';
    import CharacterSearch from './CharacterSearch.vue';
    import {characterImage, getKey} from './common';
    import ConversationView from './ConversationView.vue';
    import core from './core';
    import {Character, Connection, Conversation} from './interfaces';
    import l from './localize';
    import RecentConversations from './RecentConversations.vue';
    import ReportDialog from './ReportDialog.vue';
    import SettingsView from './SettingsView.vue';
    import StatusSwitcher from './StatusSwitcher.vue';
    import {getStatusIcon} from './user_view';
    import UserList from './UserList.vue';
    import UserMenu from './UserMenu.vue';

    const unreadClasses = {
        [Conversation.UnreadState.None]: '',
        [Conversation.UnreadState.Mention]: 'list-group-item-warning',
        [Conversation.UnreadState.Unread]: 'has-new'
    };

    @Component({
        components: {
            'user-list': UserList, channels: ChannelList, 'status-switcher': StatusSwitcher, 'character-search': CharacterSearch,
            settings: SettingsView, conversation: ConversationView, 'report-dialog': ReportDialog,
            'user-menu': UserMenu, 'recent-conversations': RecentConversations
        }
    })
    export default class ChatView extends Vue {
        l = l;
        sidebarExpanded = false;
        characterImage = characterImage;
        conversations = core.conversations;
        getStatusIcon = getStatusIcon;
        keydownListener: (e: KeyboardEvent) => void;

        mounted(): void {
            this.keydownListener = (e: KeyboardEvent) => this.onKeyDown(e);
            document.addEventListener('keydown', this.keydownListener);
            this.setFontSize(core.state.settings.fontSize);
            Sortable.create(this.$refs['privateConversations'], {
                animation: 50,
                onEnd: (e: {oldIndex: number, newIndex: number}) => core.conversations.privateConversations[e.oldIndex].sort(e.newIndex)
            });
            Sortable.create(this.$refs['channelConversations'], {
                animation: 50,
                onEnd: (e: {oldIndex: number, newIndex: number}) => core.conversations.channelConversations[e.oldIndex].sort(e.newIndex)
            });
            const ownCharacter = core.characters.ownCharacter;
            let idleTimer: number | undefined, idleStatus: Connection.ClientCommands['STA'] | undefined, lastUpdate = 0;
            window.focus = () => {
                core.notifications.isInBackground = false;
                if(idleTimer !== undefined) {
                    clearTimeout(idleTimer);
                    idleTimer = undefined;
                }
                window.setTimeout(() => {
                    if(idleStatus !== undefined) {
                        core.connection.send('STA', idleStatus);
                        idleStatus = undefined;
                    }
                }, Math.max(lastUpdate + 5 /*core.connection.vars.sta_flood*/ * 1000 + 1000 - Date.now(), 0));
            };
            window.blur = () => {
                core.notifications.isInBackground = true;
                if(idleTimer !== undefined) clearTimeout(idleTimer);
                if(core.state.settings.idleTimer !== 0)
                    idleTimer = window.setTimeout(() => {
                        lastUpdate = Date.now();
                        idleStatus = {status: ownCharacter.status, statusmsg: ownCharacter.statusText};
                        core.connection.send('STA', {status: 'idle', statusmsg: ownCharacter.statusText});
                    }, core.state.settings.idleTimer * 60000);
            };
            core.connection.onEvent('closed', () => {
                if(idleTimer !== undefined) {
                    window.clearTimeout(idleTimer);
                    idleTimer = undefined;
                }
            });
            core.watch<number>(function(): number {
                return this.state.settings.fontSize;
            }, (value) => {
                this.setFontSize(value);
            });
        }

        destroyed(): void {
            document.removeEventListener('keydown', this.keydownListener);
        }

        onKeyDown(e: KeyboardEvent): void {
            const selected = this.conversations.selectedConversation;
            const pms = this.conversations.privateConversations;
            const channels = this.conversations.channelConversations;
            const console = this.conversations.consoleTab;
            if(getKey(e) === 'ArrowUp' && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                if(selected === console) return;
                if(Conversation.isPrivate(selected)) {
                    const index = pms.indexOf(selected);
                    if(index === 0) console.show();
                    else pms[index - 1].show();
                } else {
                    const index = channels.indexOf(<Conversation.ChannelConversation>selected);
                    if(index === 0)
                        if(pms.length > 0) pms[pms.length - 1].show();
                        else console.show();
                    else channels[index - 1].show();
                }
            } else if(getKey(e) === 'ArrowDown' && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey)
                if(selected === console) { //tslint:disable-line:curly - false positive
                    if(pms.length > 0) pms[0].show();
                    else if(channels.length > 0) channels[0].show();
                } else if(Conversation.isPrivate(selected)) {
                    const index = pms.indexOf(selected);
                    if(index === pms.length - 1) {
                        if(channels.length > 0) channels[0].show();
                    } else pms[index + 1].show();
                } else {
                    const index = channels.indexOf(<Conversation.ChannelConversation>selected);
                    if(index !== channels.length - 1) channels[index + 1].show();
                }
        }

        setFontSize(fontSize: number): void {
            let overrideEl = <HTMLStyleElement | null>document.getElementById('overrideFontSize');
            if(overrideEl !== null)
                document.body.removeChild(overrideEl);
            overrideEl = document.createElement('style');
            overrideEl.id = 'overrideFontSize';
            document.body.appendChild(overrideEl);
            const sheet = <CSSStyleSheet>overrideEl.sheet;
            const selectorList = ['#chatView', '.btn', '.form-control'];
            for(const selector of selectorList)
                sheet.insertRule(`${selector} { font-size: ${fontSize}px; }`, sheet.cssRules.length);

            const lineHeightBase = 1.428571429;
            const lineHeight = Math.floor(fontSize * 1.428571429);
            const formHeight = (lineHeight + (6 * 2) + 2);
            sheet.insertRule(`.form-control { line-height: ${lineHeightBase}; height: ${formHeight}px; }`, sheet.cssRules.length);
            sheet.insertRule(`select.form-control { line-height: ${lineHeightBase}; height: ${formHeight}px; }`, sheet.cssRules.length);
        }

        logOut(): void {
            if(confirm(l('chat.confirmLeave'))) core.connection.close();
        }

        get showAvatars(): boolean {
            return core.state.settings.showAvatars;
        }

        get ownCharacter(): Character {
            return core.characters.ownCharacter;
        }

        getClasses(conversation: Conversation): string {
            return unreadClasses[conversation.unread] + (conversation === core.conversations.selectedConversation ? ' active' : '');
        }
    }
</script>

<style lang="less">
    @import '~bootstrap/less/variables.less';

    .list-group.conversation-nav {
        margin-bottom: 10px;
        .list-group-item {
            padding: 5px;
            display: flex;
            align-items: center;
            .name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .fa {
                font-size: 16px;
                padding: 0 3px;
                &:first-child {
                    padding-left: 0;
                }
                &:last-child {
                    padding-right: 0;
                }
            }
            &.item-private {
                padding-left: 0;
                padding-top: 0;
                padding-bottom: 0;
            }
            img {
                height: 40px;
                margin: -1px 5px -1px -1px;
            }
            &:first-child img {
                border-top-left-radius: 4px;
            }
            &:last-child img {
                border-bottom-left-radius: 4px;
            }
        }
    }

    #quick-switcher {
        margin: 0 45px 5px;
        overflow: auto;
        display: none;

        @media (max-width: @screen-xs-max) {
            display: flex;
        }

        a {
            width: 40px;
            text-align: center;
            line-height: 1;
            padding: 5px 5px 0;
            &:first-child {
                border-radius: 4px 0 0 4px;
                &:last-child {
                    border-radius: 4px;
                }
            }
            &:last-child {
                border-radius: 0 4px 4px 0;
            }
        }

        img {
            width: 30px;
        }

        .name {
            overflow: hidden;
            white-space: nowrap;
        }

        .conversation-icon {
            font-size: 2em;
            height: 30px;
        }
    }

    #sidebar {
        .body a.btn {
            padding: 2px 0;
        }
        @media (min-width: @screen-sm-min) {
            position: static;
            .body {
                display: block;
            }

            .expander {
                display: none;
            }
        }
    }
</style>