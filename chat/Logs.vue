<template>
    <modal :buttons="false" ref="dialog" @open="onOpen" @close="onClose" style="width:98%" dialogClass="logs-dialog">
        <template slot="title">
            {{l('logs.title')}}
            <div class="logs-fab btn btn-secondary" slot="title" @click="showFilters = !showFilters">
                <span class="fas" :class="'fa-chevron-' + (showFilters ? 'up' : 'down')"></span>
            </div>
        </template>
        <div class="form-group row" style="flex-shrink:0" v-show="showFilters">
            <label for="character" class="col-sm-2 col-form-label">{{l('logs.character')}}</label>
            <div class="col-sm-10">
                <select class="form-control" v-model="selectedCharacter" id="character" @change="loadCharacter">
                    <option value="">{{l('logs.selectCharacter')}}</option>
                    <option v-for="character in characters">{{character}}</option>
                </select>
            </div>
        </div>
        <div class="form-group row" style="flex-shrink:0" v-show="showFilters">
            <label class="col-sm-2 col-form-label">{{l('logs.conversation')}}</label>
            <div class="col-sm-10">
                <filterable-select v-model="selectedConversation" :options="conversations" :filterFunc="filterConversation"
                    :placeholder="l('filter')">
                    <template slot-scope="s">
                        {{s.option && ((s.option.key[0] == '#' ? '#' : '') + s.option.name) || l('logs.selectConversation')}}</template>
                </filterable-select>
            </div>
        </div>
        <div class="form-group row" style="flex-shrink:0" v-show="showFilters">
            <label for="date" class="col-sm-2 col-form-label">{{l('logs.date')}}</label>
            <div class="col-sm-8 col-10">
                <select class="form-control" v-model="selectedDate" id="date" @change="loadMessages">
                    <option :value="null">{{l('logs.selectDate')}}</option>
                    <option v-for="date in dates" :value="date.getTime()">{{formatDate(date)}}</option>
                </select>
            </div>
            <div class="col-2">
                <button @click="downloadDay" class="btn btn-secondary form-control" :disabled="!selectedDate"><span
                    class="fa fa-download"></span></button>
            </div>
        </div>
        <div class="messages-both" style="overflow: auto" ref="messages" tabindex="-1">
            <message-view v-for="message in filteredMessages" :message="message" :key="message.id"></message-view>
        </div>
        <div class="input-group" style="flex-shrink:0">
            <div class="input-group-prepend">
                <div class="input-group-text"><span class="fas fa-search"></span></div>
            </div>
            <input class="form-control" v-model="filter" :placeholder="l('filter')" v-show="messages" type="text"/>
        </div>
    </modal>
</template>

<script lang="ts">
    import {format} from 'date-fns';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import CustomDialog from '../components/custom_dialog';
    import FilterableSelect from '../components/FilterableSelect.vue';
    import Modal from '../components/Modal.vue';
    import {Keys} from '../keys';
    import {getKey, messageToString} from './common';
    import core from './core';
    import {Conversation, Logs as LogInterface} from './interfaces';
    import l from './localize';
    import MessageView from './message_view';

    function formatDate(this: void, date: Date): string {
        return format(date, 'YYYY-MM-DD');
    }

    function formatTime(this: void, date: Date): string {
        return format(date, 'YYYY-MM-DD HH:mm');
    }

    @Component({
        components: {modal: Modal, 'message-view': MessageView, 'filterable-select': FilterableSelect}
    })
    export default class Logs extends CustomDialog {
        //tslint:disable:no-null-keyword
        @Prop()
        readonly conversation?: Conversation;
        selectedConversation: LogInterface.Conversation | null = null;
        dates: ReadonlyArray<Date> = [];
        selectedDate: string | null = null;
        conversations: LogInterface.Conversation[] = [];
        l = l;
        filter = '';
        messages: ReadonlyArray<Conversation.Message> = [];
        formatDate = formatDate;
        keyDownListener?: (e: KeyboardEvent) => void;
        characters: ReadonlyArray<string> = [];
        selectedCharacter = core.connection.character;
        showFilters = true;

        get filteredMessages(): ReadonlyArray<Conversation.Message> {
            if(this.filter.length === 0) return this.messages;
            const filter = new RegExp(this.filter.replace(/[^\w]/gi, '\\$&'), 'i');
            return this.messages.filter(
                (x) => filter.test(x.text) || x.type !== Conversation.Message.Type.Event && filter.test(x.sender.name));
        }

        async mounted(): Promise<void> {
            this.characters = await core.logs.getAvailableCharacters();
            await this.loadCharacter();
            return this.conversationChanged();
        }

        async loadCharacter(): Promise<void> {
            if(this.selectedCharacter === '') return;
            this.conversations = (await core.logs.getConversations(this.selectedCharacter)).slice();
            this.conversations.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0)));
            this.selectedConversation = null;
        }

        filterConversation(filter: RegExp, conversation: {key: string, name: string}): boolean {
            return filter.test(conversation.name);
        }

        @Watch('conversation')
        async conversationChanged(): Promise<void> {
            if(this.conversation === undefined) return;
            //tslint:disable-next-line:strict-boolean-expressions
            this.selectedConversation = this.conversations.filter((x) => x.key === this.conversation!.key)[0] || null;
        }

        @Watch('selectedConversation')
        async conversationSelected(): Promise<void> {
            this.dates = this.selectedConversation === null ? [] :
                (await core.logs.getLogDates(this.selectedCharacter, this.selectedConversation.key)).slice().reverse();
            this.selectedDate = null;
            await this.loadMessages();
        }

        download(file: string, logs: ReadonlyArray<Conversation.Message>): void {
            const a = document.createElement('a');
            a.target = '_blank';
            a.href = `data:${encodeURIComponent(file)},${encodeURIComponent(logs.map((x) => messageToString(x, formatTime)).join(''))}`;
            a.setAttribute('download', file);
            a.style.display = 'none';
            document.body.appendChild(a);
            setTimeout(() => {
                a.click();
                document.body.removeChild(a);
            });
        }

        downloadDay(): void {
            if(this.selectedConversation === null || this.selectedDate === null || this.messages.length === 0) return;
            this.download(`${this.selectedConversation.name}-${formatDate(new Date(this.selectedDate))}.txt`, this.messages);
        }

        async onOpen(): Promise<void> {
            if(this.selectedCharacter !== '') {
                this.conversations = (await core.logs.getConversations(this.selectedCharacter)).slice();
                this.conversations.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0)));
                await this.loadMessages();
            }
            this.keyDownListener = (e) => {
                if(getKey(e) === Keys.KeyA && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    const selection = document.getSelection();
                    selection.removeAllRanges();
                    if(this.messages.length > 0) {
                        const range = document.createRange();
                        const messages = this.$refs['messages'] as Node;
                        range.setStartBefore(messages.firstChild!);
                        range.setEndAfter(messages.lastChild!);
                        selection.addRange(range);
                    }
                }
            };
            window.addEventListener('keydown', this.keyDownListener);
        }

        onClose(): void {
            window.removeEventListener('keydown', this.keyDownListener!);
        }

        async loadMessages(): Promise<ReadonlyArray<Conversation.Message>> {
            if(this.selectedDate === null || this.selectedConversation === null)
                return this.messages = [];
            return this.messages = await core.logs.getLogs(this.selectedCharacter, this.selectedConversation.key,
                new Date(this.selectedDate));
        }
    }
</script>

<style>
    .logs-dialog {
        max-width: 98% !important;
        width: 98% !important;
    }

    .logs-dialog .modal-body {
        display: flex;
        flex-direction: column;
    }
</style>