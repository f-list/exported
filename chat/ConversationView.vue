<template>
    <div style="height:100%; display:flex; flex-direction:column; flex:1; margin:0 5px; position:relative;" id="conversation">
        <div style="display:flex" v-if="conversation.character" class="header">
            <img :src="characterImage" style="height:60px;width:60px;margin-right:10px" v-if="settings.showAvatars"/>
            <div style="flex:1;position:relative;display:flex;flex-direction:column">
                <div>
                    <user :character="conversation.character"></user>
                    <a href="#" @click.prevent="$refs['logsDialog'].show()" class="btn">
                        <span class="fa fa-file-alt"></span> <span class="btn-text">{{l('logs.title')}}</span>
                    </a>
                    <a href="#" @click.prevent="$refs['settingsDialog'].show()" class="btn">
                        <span class="fa fa-cog"></span> <span class="btn-text">{{l('conversationSettings.title')}}</span>
                    </a>
                    <a href="#" @click.prevent="reportDialog.report();" class="btn">
                        <span class="fa fa-exclamation-triangle"></span><span class="btn-text">{{l('chat.report')}}</span></a>
                </div>
                <div style="overflow:auto;max-height:50px">
                    {{l('status.' + conversation.character.status)}}
                    <span v-show="conversation.character.statusText"> – <bbcode :text="conversation.character.statusText"></bbcode></span>
                </div>
            </div>
        </div>
        <div v-else-if="conversation.channel" class="header">
            <div style="display: flex; align-items: center;">
                <div style="flex: 1;">
                    <span v-show="conversation.channel.id.substr(0, 4) !== 'adh-'" class="fa fa-star" :title="l('channel.official')"
                        style="margin-right:5px;vertical-align:sub"></span>
                    <h5 style="margin:0;display:inline;vertical-align:middle">{{conversation.name}}</h5>
                    <a @click="descriptionExpanded = !descriptionExpanded" class="btn">
                        <span class="fa" :class="{'fa-chevron-down': !descriptionExpanded, 'fa-chevron-up': descriptionExpanded}"></span>
                        <span class="btn-text">{{l('channel.description')}}</span>
                    </a>
                    <manage-channel :channel="conversation.channel" v-if="isChannelMod"></manage-channel>
                    <a href="#" @click.prevent="$refs['logsDialog'].show()" class="btn">
                        <span class="fa fa-file-alt"></span> <span class="btn-text">{{l('logs.title')}}</span>
                    </a>
                    <a href="#" @click.prevent="$refs['settingsDialog'].show()" class="btn">
                        <span class="fa fa-cog"></span> <span class="btn-text">{{l('conversationSettings.title')}}</span>
                    </a>
                    <a href="#" @click.prevent="reportDialog.report();" class="btn">
                        <span class="fa fa-exclamation-triangle"></span><span class="btn-text">{{l('chat.report')}}</span></a>
                </div>
                <ul class="nav nav-pills mode-switcher">
                    <li v-for="mode in modes" class="nav-item">
                        <a :class="{active: conversation.mode == mode, disabled: conversation.channel.mode != 'both'}"
                            class="nav-link" href="#" @click.prevent="setMode(mode)">{{l('channel.mode.' + mode)}}</a>
                    </li>
                </ul>
            </div>
            <div style="z-index:5;position:absolute;left:0;right:0;max-height:60%;overflow:auto"
                :style="'display:' + (descriptionExpanded ? 'block' : 'none')" class="bg-solid-text">
                <bbcode :text="conversation.channel.description"></bbcode>
            </div>
        </div>
        <div v-else class="header" style="display:flex;align-items:center">
            <h4>{{l('chat.consoleTab')}}</h4>
            <a href="#" @click.prevent="$refs['logsDialog'].show()" class="btn">
                <span class="fa fa-file-alt"></span> <span class="btn-text">{{l('logs.title')}}</span>
            </a>
        </div>
        <div class="search" v-show="showSearch" style="position:relative">
            <input v-model="searchInput" @keydown.esc="showSearch = false; searchInput = ''" @keypress="lastSearchInput = Date.now()"
                :placeholder="l('chat.search')" ref="searchField" class="form-control"/>
            <a class="btn btn-sm btn-light" style="position:absolute;right:5px;top:50%;transform:translateY(-50%);line-height:0"
                @click="showSearch = false"><i class="fas fa-times"></i></a>
        </div>
        <div class="border-top messages" :class="'messages-' + conversation.mode" style="flex:1;overflow:auto;margin-top:2px"
            ref="messages" @scroll="onMessagesScroll">
            <template v-for="message in messages">
                <message-view :message="message" :channel="conversation.channel" :key="message.id"
                    :classes="message == conversation.lastRead ? 'last-read' : ''">
                </message-view>
                <span v-if="message.sfc && message.sfc.action == 'report'" :key="message.id">
                    <a :href="'https://www.f-list.net/fchat/getLog.php?log=' + message.sfc.logid"
                        v-if="message.sfc.logid">{{l('events.report.viewLog')}}</a>
                    <span v-else>{{l('events.report.noLog')}}</span>
                    <span v-show="!message.sfc.confirmed">
                        | <a href="#" @click.prevent="acceptReport(message.sfc)">{{l('events.report.confirm')}}</a>
                    </span>
                </span>
            </template>
        </div>
        <div>
            <span v-if="conversation.typingStatus && conversation.typingStatus !== 'clear'">
                {{l('chat.typing.' + conversation.typingStatus, conversation.name)}}
            </span>
            <div v-show="conversation.infoText" style="display:flex;align-items:center">
                <span class="fa fa-times" style="cursor:pointer" @click.stop="conversation.infoText = ''"></span>
                <span style="flex:1;margin-left:5px">{{conversation.infoText}}</span>
            </div>
            <div v-show="conversation.errorText" style="display:flex;align-items:center">
                <span class="fa fa-times" style="cursor:pointer" @click.stop="conversation.errorText = ''"></span>
                <span class="redText" style="flex:1;margin-left:5px">{{conversation.errorText}}</span>
            </div>
            <div style="position:relative;margin-top:5px">
                <bbcode-editor v-model="conversation.enteredText" @keydown="onKeyDown" :extras="extraButtons" @input="keepScroll"
                    :classes="'form-control chat-text-box' + (conversation.isSendingAds ? ' ads-text-box' : '')"
                    ref="textBox" style="position:relative" :maxlength="conversation.maxMessageLength">
                    <div style="float:right;text-align:right;display:flex;align-items:center">
                        <div v-show="conversation.maxMessageLength" style="margin-right:5px">
                            {{getByteLength(conversation.enteredText)}} / {{conversation.maxMessageLength}}
                        </div>
                        <ul class="nav nav-pills send-ads-switcher" v-if="conversation.channel"
                            style="position:relative;z-index:10;margin-right:5px">
                            <li class="nav-item">
                                <a href="#" :class="{active: !conversation.isSendingAds, disabled: conversation.channel.mode != 'both'}"
                                    class="nav-link" @click.prevent="setSendingAds(false)">{{l('channel.mode.chat')}}</a>
                            </li>
                            <li class="nav-item">
                                <a href="#" :class="{active: conversation.isSendingAds, disabled: conversation.channel.mode != 'both'}"
                                    class="nav-link" @click.prevent="setSendingAds(true)">{{adsMode}}</a>
                            </li>
                        </ul>
                        <div class="btn btn-sm btn-primary" v-show="!settings.enterSend" @click="conversation.send()">{{l('chat.send')}}</div>
                    </div>
                </bbcode-editor>
            </div>
        </div>
        <command-help ref="helpDialog"></command-help>
        <settings ref="settingsDialog" :conversation="conversation"></settings>
        <logs ref="logsDialog" :conversation="conversation"></logs>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import {EditorButton, EditorSelection} from '../bbcode/editor';
    import {Keys} from '../keys';
    import {BBCodeView, Editor} from './bbcode';
    import CommandHelp from './CommandHelp.vue';
    import {characterImage, getByteLength, getKey} from './common';
    import ConversationSettings from './ConversationSettings.vue';
    import core from './core';
    import {Channel, channelModes, Character, Conversation, Settings} from './interfaces';
    import l from './localize';
    import Logs from './Logs.vue';
    import ManageChannel from './ManageChannel.vue';
    import MessageView from './message_view';
    import ReportDialog from './ReportDialog.vue';
    import {isCommand} from './slash_commands';
    import UserView from './user_view';

    @Component({
        components: {
            user: UserView, 'bbcode-editor': Editor, 'manage-channel': ManageChannel, settings: ConversationSettings,
            logs: Logs, 'message-view': MessageView, bbcode: BBCodeView, 'command-help': CommandHelp
        }
    })
    export default class ConversationView extends Vue {
        @Prop({required: true})
        readonly reportDialog!: ReportDialog;
        modes = channelModes;
        descriptionExpanded = false;
        l = l;
        extraButtons: EditorButton[] = [];
        getByteLength = getByteLength;
        tabOptions: string[] | undefined;
        tabOptionsIndex!: number;
        tabOptionSelection!: EditorSelection;
        showSearch = false;
        searchInput = '';
        search = '';
        lastSearchInput = 0;
        messageCount = 0;
        searchTimer = 0;
        windowHeight = window.innerHeight;
        resizeHandler = () => {
            const messageView = <HTMLElement>this.$refs['messages'];
            if(this.windowHeight - window.innerHeight + messageView.scrollTop + messageView.offsetHeight >= messageView.scrollHeight - 15)
                messageView.scrollTop = messageView.scrollHeight - messageView.offsetHeight;
            this.windowHeight = window.innerHeight;
        }
        keydownHandler!: EventListener;

        created(): void {
            this.extraButtons = [{
                title: 'Help\n\nClick this button for a quick overview of slash commands.',
                tag: '?',
                icon: 'fa-question',
                handler: () => (<CommandHelp>this.$refs['helpDialog']).show()
            }];
            window.addEventListener('resize', this.resizeHandler);
            window.addEventListener('keydown', this.keydownHandler = ((e: KeyboardEvent) => {
                if(getKey(e) === Keys.KeyF && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                    this.showSearch = true;
                    this.$nextTick(() => (<HTMLElement>this.$refs['searchField']).focus());
                }
            }) as EventListener);
            this.searchTimer = window.setInterval(() => {
                if(Date.now() - this.lastSearchInput > 500 && this.search !== this.searchInput)
                    this.search = this.searchInput;
            }, 500);
        }

        destroyed(): void {
            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('keydown', this.keydownHandler);
            clearInterval(this.searchTimer);
        }

        get conversation(): Conversation {
            return core.conversations.selectedConversation;
        }

        get messages(): ReadonlyArray<Conversation.Message> {
            return this.search !== '' ? this.conversation.messages.filter((x) => x.text.indexOf(this.search) !== -1)
                : this.conversation.messages;
        }

        @Watch('conversation')
        conversationChanged(): void {
            (<Editor>this.$refs['textBox']).focus();
        }

        @Watch('conversation.messages')
        messageAdded(newValue: Conversation.Message[]): void {
            const messageView = <HTMLElement>this.$refs['messages'];
            if(!this.keepScroll() && newValue.length === this.messageCount)
                messageView.scrollTop -= (<HTMLElement>messageView.firstElementChild).clientHeight;
            this.messageCount = newValue.length;
        }

        keepScroll(): boolean {
            const messageView = <HTMLElement>this.$refs['messages'];
            if(messageView.scrollTop + messageView.offsetHeight >= messageView.scrollHeight - 15) {
                this.$nextTick(() => setTimeout(() => messageView.scrollTop = messageView.scrollHeight, 0));
                return true;
            }
            return false;
        }

        onMessagesScroll(): void {
            const messageView = <HTMLElement | undefined>this.$refs['messages'];
            if(messageView !== undefined && messageView.scrollTop < 50) this.conversation.loadMore();
        }

        @Watch('conversation.errorText')
        @Watch('conversation.infoText')
        textChanged(newValue: string, oldValue: string): void {
            if(oldValue.length === 0 && newValue.length > 0) this.keepScroll();
        }

        @Watch('conversation.typingStatus')
        typingStatusChanged(_: string, oldValue: string): void {
            if(oldValue === 'clear') this.keepScroll();
        }

        async onKeyDown(e: KeyboardEvent): Promise<void> {
            const editor = <Editor>this.$refs['textBox'];
            if(getKey(e) === Keys.Tab) {
                e.preventDefault();
                if(this.conversation.enteredText.length === 0 || this.isConsoleTab) return;
                if(this.tabOptions === undefined) {
                    const selection = editor.getSelection();
                    if(selection.text.length === 0) {
                        const match = /\b[\w]+$/.exec(editor.text.substring(0, selection.end));
                        if(match === null) return;
                        selection.start = match.index < 0 ? 0 : match.index;
                        selection.text = editor.text.substring(selection.start, selection.end);
                        if(selection.text.length === 0) return;
                    }
                    const search = new RegExp(`^${selection.text.replace(/[^\w]/gi, '\\$&')}`, 'i');
                    const c = (<Conversation.PrivateConversation>this.conversation);
                    let options: ReadonlyArray<{character: Character}>;
                    options = Conversation.isChannel(this.conversation) ? this.conversation.channel.sortedMembers :
                        [{character: c.character}, {character: core.characters.ownCharacter}];
                    this.tabOptions = options.filter((x) => search.test(x.character.name)).map((x) => x.character.name);
                    this.tabOptionsIndex = 0;
                    this.tabOptionSelection = selection;
                }
                if(this.tabOptions.length > 0) {
                    const selection = editor.getSelection();
                    if(selection.end !== this.tabOptionSelection.end) return;
                    if(this.tabOptionsIndex >= this.tabOptions.length) this.tabOptionsIndex = 0;
                    const name = this.tabOptions[this.tabOptionsIndex];
                    const userName = (isCommand(this.conversation.enteredText) ? name : `[user]${name}[/user]`);
                    this.tabOptionSelection.end = this.tabOptionSelection.start + userName.length;
                    this.conversation.enteredText = this.conversation.enteredText.substr(0, this.tabOptionSelection.start) + userName +
                        this.conversation.enteredText.substr(selection.end);
                    ++this.tabOptionsIndex;
                }
            } else {
                if(this.tabOptions !== undefined) this.tabOptions = undefined;
                if(getKey(e) === Keys.ArrowUp && this.conversation.enteredText.length === 0
                    && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey)
                    this.conversation.loadLastSent();
                else if(getKey(e) === Keys.Enter) {
                    if(e.shiftKey === this.settings.enterSend) return;
                    e.preventDefault();
                    await this.conversation.send();
                }
            }
        }

        setMode(mode: Channel.Mode): void {
            const conv = (<Conversation.ChannelConversation>this.conversation);
            if(conv.channel.mode === 'both') conv.mode = mode;
        }

        acceptReport(sfc: {callid: number}): void {
            core.connection.send('SFC', {action: 'confirm', callid: sfc.callid});
        }

        setSendingAds(is: boolean): void {
            const conv = (<Conversation.ChannelConversation>this.conversation);
            if(conv.channel.mode === 'both') {
                conv.isSendingAds = is;
                (<Editor>this.$refs['textBox']).focus();
            }
        }

        get adsMode(): string | undefined {
            if(!Conversation.isChannel(this.conversation)) return;
            if(this.conversation.adCountdown <= 0) return l('channel.mode.ads');
            else return l('channel.mode.ads.countdown',
                Math.floor(this.conversation.adCountdown / 60).toString(), (this.conversation.adCountdown % 60).toString());
        }

        get characterImage(): string {
            return characterImage(this.conversation.name);
        }

        get settings(): Settings {
            return core.state.settings;
        }

        get isConsoleTab(): boolean {
            return this.conversation === core.conversations.consoleTab;
        }

        get isChannelMod(): boolean {
            if(core.characters.ownCharacter.isChatOp) return true;
            const conv = (<Conversation.ChannelConversation>this.conversation);
            const member = conv.channel.members[core.connection.character];
            return member !== undefined && member.rank > Channel.Rank.Member;
        }
    }
</script>

<style lang="scss">
    @import "~bootstrap/scss/functions";
    @import "~bootstrap/scss/variables";
    @import "~bootstrap/scss/mixins/breakpoints";

    #conversation {
        .header {
            @media (min-width: breakpoint-min(md)) {
                margin-right: 32px;
            }
            .btn {
                padding: 2px 5px;
            }
        }

        .send-ads-switcher a {
            padding: 3px 10px;
        }

        @media (max-width: breakpoint-max(sm)) {
            .mode-switcher a {
                padding: 5px 8px;
            }
        }
    }
</style>