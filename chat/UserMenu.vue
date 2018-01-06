<template>
    <div>
        <div id="userMenu" class="dropdown-menu" v-show="showContextMenu" :style="position"
            style="position:fixed;padding:10px 10px 5px;display:block;width:200px;z-index:1100" ref="menu">
            <div v-if="character">
                <div style="min-height: 65px;" @click.stop>
                    <img :src="characterImage" style="width: 60px; height:60px; margin-right: 5px; float: left;" v-if="showAvatars"/>
                    <h4 style="margin:0;">{{character.name}}</h4>
                    {{l('status.' + character.status)}}
                </div>
                <bbcode :text="character.statusText" @click.stop></bbcode>
                <ul class="dropdown-menu border-top" role="menu"
                    style="display:block; position:static; border-width:1px 0 0 0; box-shadow:none; padding:0; width:100%; border-radius:0;">
                    <li><a tabindex="-1" :href="profileLink" target="_blank" v-if="showProfileFirst">
                        <span class="fa fa-fw fa-user"></span>{{l('user.profile')}}</a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="openConversation(true)">
                        <span class="fa fa-fw fa-comment"></span>{{l('user.messageJump')}}</a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="openConversation(false)">
                        <span class="fa fa-fw fa-plus"></span>{{l('user.message')}}</a></li>
                    <li><a tabindex="-1" :href="profileLink" target="_blank" v-if="!showProfileFirst">
                        <span class="fa fa-fw fa-user"></span>{{l('user.profile')}}</a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="showMemo">
                        <span class="fa fa-fw fa-sticky-note-o"></span>{{l('user.memo')}}</a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="setBookmarked">
                        <span class="fa fa-fw fa-bookmark-o"></span>{{l('user.' + (character.isBookmarked ? 'unbookmark' : 'bookmark'))}}
                    </a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="setIgnored">
                        <span class="fa fa-fw fa-minus-circle"></span>{{l('user.' + (character.isIgnored ? 'unignore' : 'ignore'))}}
                    </a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="setHidden">
                        <span class="fa fa-fw fa-eye-slash"></span>{{l('user.' + (isHidden ? 'unhide' : 'hide'))}}
                    </a></li>
                    <li><a tabindex="-1" href="#" @click.prevent="report">
                        <span class="fa fa-fw fa-exclamation-triangle"></span>{{l('user.report')}}</a></li>
                    <li v-show="isChannelMod"><a tabindex="-1" href="#" @click.prevent="channelKick">
                        <span class="fa fa-fw fa-ban"></span>{{l('user.channelKick')}}</a></li>
                    <li v-show="isChatOp"><a tabindex="-1" href="#" @click.prevent="chatKick" style="color:#f00">
                        <span class="fa fa-fw fa-trash-o"></span>{{l('user.chatKick')}}</a>
                    </li>
                </ul>
            </div>
        </div>
        <modal :action="l('user.memo.action')" ref="memo" :disabled="memoLoading" @submit="updateMemo">
            <div style="float:right;text-align:right;">{{getByteLength(memo)}} / 1000</div>
            <textarea class="form-control" v-model="memo" :disabled="memoLoading" maxlength="1000"></textarea>
        </modal>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import Modal from '../components/Modal.vue';
    import {BBCodeView} from './bbcode';
    import {characterImage, errorToString, getByteLength, profileLink} from './common';
    import core from './core';
    import {Channel, Character} from './interfaces';
    import l from './localize';
    import ReportDialog from './ReportDialog.vue';

    @Component({
        components: {bbcode: BBCodeView, modal: Modal}
    })
    export default class UserMenu extends Vue {
        //tslint:disable:no-null-keyword
        @Prop({required: true})
        readonly reportDialog: ReportDialog;
        l = l;
        showContextMenu = false;
        getByteLength = getByteLength;
        character: Character | null = null;
        position = {left: '', top: ''};
        characterImage: string | null = null;
        touchTimer: number | undefined;
        channel: Channel | null = null;
        memo = '';
        memoId: number;
        memoLoading = false;

        openConversation(jump: boolean): void {
            const conversation = core.conversations.getPrivate(this.character!);
            if(jump) conversation.show();
        }

        setIgnored(): void {
            core.connection.send('IGN', {action: this.character!.isIgnored ? 'delete' : 'add', character: this.character!.name});
        }

        setBookmarked(): void {
            core.connection.queryApi(`bookmark-${this.character!.isBookmarked ? 'remove' : 'add'}.php`, {name: this.character!.name})
                .catch((e: object) => alert(errorToString(e)));
        }

        setHidden(): void {
            const index = core.state.hiddenUsers.indexOf(this.character!.name);
            if(index !== -1) core.state.hiddenUsers.splice(index, 1);
            else core.state.hiddenUsers.push(this.character!.name);
        }

        report(): void {
            this.reportDialog.report(this.character!);
        }

        channelKick(): void {
            core.connection.send('CKU', {channel: this.channel!.id, character: this.character!.name});
        }

        chatKick(): void {
            core.connection.send('KIK', {character: this.character!.name});
        }

        async showMemo(): Promise<void> {
            this.memoLoading = true;
            this.memo = '';
            (<Modal>this.$refs['memo']).show();
            try {
                const memo = <{note: string | null, id: number}>await core.connection.queryApi('character-memo-get2.php',
                    {target: this.character!.name});
                this.memoId = memo.id;
                this.memo = memo.note !== null ? memo.note : '';
                this.memoLoading = false;
            } catch(e) {
                alert(errorToString(e));
            }
        }

        updateMemo(): void {
            core.connection.queryApi('character-memo-save.php', {target: this.memoId, note: this.memo})
                .catch((e: object) => alert(errorToString(e)));
        }

        get isChannelMod(): boolean {
            if(this.channel === null) return false;
            if(core.characters.ownCharacter.isChatOp) return true;
            const member = this.channel.members[core.connection.character];
            return member !== undefined && member.rank > Channel.Rank.Member;
        }

        get isHidden(): boolean {
            return core.state.hiddenUsers.indexOf(this.character!.name) !== -1;
        }

        get isChatOp(): boolean {
            return core.characters.ownCharacter.isChatOp;
        }

        get showProfileFirst(): boolean {
            return core.state.settings.clickOpensMessage;
        }

        get showAvatars(): boolean {
            return core.state.settings.showAvatars;
        }

        get profileLink(): string | undefined {
            return profileLink(this.character!.name);
        }

        handleEvent(e: MouseEvent | TouchEvent): void {
            const touch = e instanceof TouchEvent ? e.changedTouches[0] : e;
            let node = <HTMLElement & {character?: Character, channel?: Channel}>touch.target;
            while(node !== document.body) {
                if(e.type !== 'click' && node === this.$refs['menu']) return;
                if(node.character !== undefined || node.dataset['character'] !== undefined || node.parentNode === null) break;
                node = node.parentElement!;
            }
            if(node.dataset['touch'] === 'false' && e.type !== 'contextmenu') return;
            if(node.character === undefined)
                if(node.dataset['character'] !== undefined) node.character = core.characters.get(node.dataset['character']!);
                else {
                    this.showContextMenu = false;
                    return;
                }
            switch(e.type) {
                case 'click':
                    if(node.dataset['character'] === undefined) this.onClick(node.character);
                    e.preventDefault();
                    break;
                case 'touchstart':
                    this.touchTimer = window.setTimeout(() => {
                        this.openMenu(touch, node.character!, node.channel);
                        this.touchTimer = undefined;
                    }, 500);
                    break;
                case 'touchend':
                    if(this.touchTimer !== undefined) {
                        clearTimeout(this.touchTimer);
                        this.touchTimer = undefined;
                        if(node.dataset['character'] === undefined) this.onClick(node.character);
                    }
                    break;
                case 'contextmenu':
                    this.openMenu(touch, node.character, node.channel);
                    e.preventDefault();
            }
        }

        private onClick(character: Character): void {
            this.character = character;
            if(core.state.settings.clickOpensMessage) this.openConversation(true);
            else window.open(this.profileLink);
            this.showContextMenu = false;
        }

        private openMenu(touch: MouseEvent | Touch, character: Character, channel: Channel | undefined): void {
            this.channel = channel !== undefined ? channel : null;
            this.character = character;
            this.characterImage = null;
            this.showContextMenu = true;
            this.position = {left: `${touch.clientX}px`, top: `${touch.clientY}px`};
            this.$nextTick(() => {
                const menu = <HTMLElement>this.$refs['menu'];
                this.characterImage = characterImage(character.name);
                if((parseInt(this.position.left, 10) + menu.offsetWidth) > window.innerWidth)
                    this.position.left = `${window.innerWidth - menu.offsetWidth - 1}px`;
                if((parseInt(this.position.top, 10) + menu.offsetHeight) > window.innerHeight)
                    this.position.top = `${window.innerHeight - menu.offsetHeight - 1}px`;
            });
        }
    }
</script>

<style>
    #userMenu li a {
        padding: 3px 0;
    }

    .user-view {
        cursor: pointer;
    }
</style>