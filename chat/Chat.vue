<template>
    <div style="display:flex; flex-direction: column; height:100%; justify-content: center">
        <div class="card bg-light" style="width:400px;max-width:100%;margin:0 auto" v-if="!connected">
            <div class="alert alert-danger" v-show="error">{{error}}</div>
            <h3 class="card-header" style="margin-top:0">{{l('title')}}</h3>
            <div class="card-body">
                <h4 class="card-title">{{l('login.selectCharacter')}}</h4>
                <select v-model="selectedCharacter" class="form-control custom-select">
                    <option v-for="character in ownCharacters" :value="character">{{character}}</option>
                </select>
                <div style="text-align:right;margin-top:10px">
                    <button class="btn btn-primary" @click="connect" :disabled="connecting">
                        {{l(connecting ? 'login.connecting' : 'login.connect')}}
                    </button>
                </div>
            </div>
        </div>
        <chat v-else></chat>
        <modal :action="l('chat.disconnected.title')" :buttonText="l('action.cancel')" ref="reconnecting" @submit="cancelReconnect"
            :showCancel="false" buttonClass="btn-danger">
            <div class="alert alert-danger" v-show="error">{{error}}</div>
            {{l('chat.disconnected')}}
        </modal>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import Modal from '../components/Modal.vue';
    import Channels from '../fchat/channels';
    import Characters from '../fchat/characters';
    import ChatView from './ChatView.vue';
    import {errorToString} from './common';
    import Conversations from './conversations';
    import core from './core';
    import l from './localize';

    type BBCodeNode = Node & {bbcodeTag?: string, bbcodeParam?: string, bbcodeHide?: boolean};

    function copyNode(str: string, node: BBCodeNode, range: Range, flags: {endFound?: true, rootFound?: true}): string {
        if(node.bbcodeTag !== undefined)
            str = `[${node.bbcodeTag}${node.bbcodeParam !== undefined ? `=${node.bbcodeParam}` : ''}]${str}[/${node.bbcodeTag}]`;
        if(node.nextSibling !== null && !flags.endFound) {
            if(node instanceof HTMLElement && getComputedStyle(node).display === 'block') str += '\n';
            str += scanNode(node.nextSibling!, range, flags);
        }
        if(node.parentElement === null) flags.rootFound = true;
        if(flags.rootFound && flags.endFound) return str;
        return copyNode(str, node.parentNode!, range, flags);
    }

    function scanNode(node: BBCodeNode, range: Range, flags: {endFound?: true}): string {
        if(node.bbcodeHide) return '';
        if(node === range.endContainer) {
            flags.endFound = true;
            return node.nodeValue!.substr(0, range.endOffset);
        }
        let str = '';
        if(node.bbcodeTag !== undefined) str += `[${node.bbcodeTag}${node.bbcodeParam !== undefined ? `=${node.bbcodeParam}` : ''}]`;
        if(node instanceof Text) str += node.nodeValue;
        if(node.firstChild !== null) str += scanNode(node.firstChild, range, flags);
        if(node.bbcodeTag !== undefined) str += `[/${node.bbcodeTag}]`;
        if(node instanceof HTMLElement && getComputedStyle(node).display === 'block') str += '\n';
        if(node.nextSibling !== null && !flags.endFound) str += scanNode(node.nextSibling, range, flags);
        return str;
    }

    @Component({
        components: {chat: ChatView, modal: Modal}
    })
    export default class Chat extends Vue {
        @Prop({required: true})
        readonly ownCharacters!: string[];
        @Prop({required: true})
        readonly defaultCharacter!: string | undefined;
        selectedCharacter = this.defaultCharacter || this.ownCharacters[0]; //tslint:disable-line:strict-boolean-expressions
        error = '';
        connecting = false;
        connected = false;
        l = l;

        mounted(): void {
            document.addEventListener('copy', ((e: ClipboardEvent) => {
                const selection = document.getSelection();
                if(selection.isCollapsed) return;
                const range = selection.getRangeAt(0);
                e.clipboardData.setData('text/plain', copyNode(range.startContainer.nodeValue!.substr(range.startOffset),
                    range.startContainer, range, {}));
                e.preventDefault();
            }) as EventListener);
            core.register('characters', Characters(core.connection));
            core.register('channels', Channels(core.connection, core.characters));
            core.register('conversations', Conversations());
            core.connection.onEvent('closed', (isReconnect) => {
                if(isReconnect) (<Modal>this.$refs['reconnecting']).show(true);
                if(this.connected) core.notifications.playSound('logout');
                this.connected = false;
                this.connecting = false;
            });
            core.connection.onEvent('connecting', async() => {
                this.connecting = true;
                if(core.state.settings.notifications) await core.notifications.requestPermission();
            });
            core.connection.onEvent('connected', () => {
                (<Modal>this.$refs['reconnecting']).hide();
                this.error = '';
                this.connecting = false;
                this.connected = true;
                core.notifications.playSound('login');
            });
            core.connection.onError((e) => {
                this.error = errorToString(e);
                this.connecting = false;
                this.connected = false;
            });
        }

        cancelReconnect(): void {
            core.connection.close();
            (<Modal>this.$refs['reconnecting']).hide();
        }

        connect(): void {
            this.connecting = true;
            core.connection.connect(this.selectedCharacter).catch((e) => {
                if((<Error & {request?: object}>e).request !== undefined) this.error = l('login.connectError'); //catch axios network errors
                else throw e;
            });
        }
    }
</script>