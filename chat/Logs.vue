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
            <div :class="canZip ? 'col-sm-8 col-10 col-xl-9' : 'col-sm-10'">
                <select class="form-control" v-model="selectedCharacter" id="character" @change="loadCharacter">
                    <option value="">{{l('logs.selectCharacter')}}</option>
                    <option v-for="character in characters">{{character}}</option>
                </select>
            </div>
            <div class="col-2 col-xl-1" v-if="canZip">
                <button @click="downloadCharacter" class="btn btn-secondary form-control" :disabled="!selectedCharacter"><span
                    class="fa fa-download"></span></button>
            </div>
        </div>
        <div class="form-group row" style="flex-shrink:0" v-show="showFilters">
            <label class="col-sm-2 col-form-label">{{l('logs.conversation')}}</label>
            <div :class="canZip ? 'col-sm-8 col-10 col-xl-9' : 'col-sm-10'">
                <filterable-select v-model="selectedConversation" :options="conversations" :filterFunc="filterConversation"
                    :placeholder="l('filter')">
                    <template slot-scope="s">
                        {{s.option && ((s.option.key[0] == '#' ? '#' : '') + s.option.name) || l('logs.selectConversation')}}
                    </template>
                </filterable-select>
            </div>
            <div class="col-2 col-xl-1" v-if="canZip">
                <button @click="downloadConversation" class="btn btn-secondary form-control" :disabled="!selectedConversation"><span
                    class="fa fa-download"></span></button>
            </div>
        </div>
        <div class="form-group row" style="flex-shrink:0" v-show="showFilters">
            <label for="date" class="col-sm-2 col-form-label">{{l('logs.date')}}</label>
            <div class="col-sm-8 col-10 col-xl-9">
                <select class="form-control" v-model="selectedDate" id="date" @change="loadMessages">
                    <option :value="null">{{l('logs.allDates')}}</option>
                    <option v-for="date in dates" :value="date.getTime()">{{formatDate(date)}}</option>
                </select>
            </div>
            <div class="col-2 col-xl-1">
                <button @click="downloadDay" class="btn btn-secondary form-control" :disabled="!selectedDate"><span
                    class="fa fa-download"></span></button>
            </div>
        </div>
        <div class="messages-both" style="overflow:auto" ref="messages" tabindex="-1" @scroll="onMessagesScroll">
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
    import {formatTime, getKey, messageToString} from './common';
    import core from './core';
    import {Conversation, Logs as LogInterface} from './interfaces';
    import l from './localize';
    import MessageView from './message_view';
    import Zip from './zip';

    function formatDate(this: void, date: Date): string {
        return format(date, 'YYYY-MM-DD');
    }

    function getLogs(messages: ReadonlyArray<Conversation.Message>): string {
        return messages.reduce((acc, x) => acc + messageToString(x, (date) => formatTime(date, true)), '');
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
        canZip = core.logs.canZip;
        dateOffset = -1;

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
            this.dateOffset = -1;
            this.filter = '';
            await this.loadMessages();
        }

        @Watch('filter')
        onFilterChanged(): void {
            this.$nextTick(async() => this.onMessagesScroll());
        }

        download(file: string, logs: string): void {
            const a = document.createElement('a');
            a.href = logs;
            a.setAttribute('download', file);
            a.style.display = 'none';
            document.body.appendChild(a);
            setTimeout(() => {
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(logs);
            });
        }

        downloadDay(): void {
            if(this.selectedConversation === null || this.selectedDate === null || this.messages.length === 0) return;
            const name = `${this.selectedConversation.name}-${formatDate(new Date(this.selectedDate))}.txt`;
            this.download(name, `data:${encodeURIComponent(name)},${encodeURIComponent(getLogs(this.messages))}`);
        }

        async downloadConversation(): Promise<void> {
            if(this.selectedConversation === null) return;
            const zip = new Zip();
            for(const date of this.dates) {
                const messages = await core.logs.getLogs(this.selectedCharacter, this.selectedConversation.key, date);
                zip.addFile(`${formatDate(date)}.txt`, getLogs(messages));
            }
            this.download(`${this.selectedConversation.name}.zip`, URL.createObjectURL(zip.build()));
        }

        async downloadCharacter(): Promise<void> {
            if(this.selectedCharacter === '' || !confirm(l('logs.confirmExport', this.selectedCharacter))) return;
            const zip = new Zip();
            for(const conv of this.conversations) {
                zip.addFile(`${conv.name}/`, '');
                const dates = await core.logs.getLogDates(this.selectedCharacter, conv.key);
                for(const date of dates) {
                    const messages = await core.logs.getLogs(this.selectedCharacter, conv.key, date);
                    zip.addFile(`${conv.name}/${formatDate(date)}.txt`, getLogs(messages));
                }
            }
            this.download(`${this.selectedCharacter}.zip`, URL.createObjectURL(zip.build()));
        }

        async onOpen(): Promise<void> {
            if(this.selectedCharacter !== '') {
                this.conversations = (await core.logs.getConversations(this.selectedCharacter)).slice();
                this.conversations.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0)));
                this.dates = this.selectedConversation === null ? [] :
                    (await core.logs.getLogDates(this.selectedCharacter, this.selectedConversation.key)).slice().reverse();
                await this.loadMessages();
            }
            this.keyDownListener = (e) => {
                if(getKey(e) === Keys.KeyA && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    const selection = document.getSelection();
                    if(selection === null) return;
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
            if(this.selectedConversation === null)
                return this.messages = [];
            if(this.selectedDate !== null) {
                this.dateOffset = -1;
                return this.messages = await core.logs.getLogs(this.selectedCharacter, this.selectedConversation.key,
                    new Date(this.selectedDate));
            }
            if(this.dateOffset === -1) {
                this.messages = [];
                this.dateOffset = 0;
            }
            this.$nextTick(async() => this.onMessagesScroll());
            return this.messages;
        }

        async onMessagesScroll(): Promise<void> {
            const list = <HTMLElement | undefined>this.$refs['messages'];
            if(this.selectedConversation === null || this.selectedDate !== null || list === undefined || list.scrollTop > 15
                || !this.dialog.isShown || this.dateOffset >= this.dates.length) return;
            const messages = await core.logs.getLogs(this.selectedCharacter, this.selectedConversation.key,
                this.dates[this.dateOffset++]);
            this.messages = messages.concat(this.messages);
            const noOverflow = list.offsetHeight === list.scrollHeight;
            const firstMessage = <HTMLElement>list.firstElementChild!;
            this.$nextTick(() => {
                if(list.offsetHeight === list.scrollHeight) return this.onMessagesScroll();
                else if(noOverflow) setTimeout(() => list.scrollTop = list.scrollHeight, 0);
                else setTimeout(() => list.scrollTop = firstMessage.offsetTop, 0);
            });
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