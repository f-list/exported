<template>
    <modal :buttons="false" ref="dialog" id="logs-dialog" :action="l('logs.title')"
        dialogClass="modal-lg w-100 modal-dialog-centered" @open="onOpen">
        <div class="form-group row" style="flex-shrink:0">
            <label class="col-2 col-form-label">{{l('logs.conversation')}}</label>
            <div class="col-10">
                <filterable-select v-model="selectedConversation" :options="conversations" :filterFunc="filterConversation"
                    :placeholder="l('filter')" @input="loadMessages">
                    <template slot-scope="s">
                        {{s.option && ((s.option.key[0] == '#' ? '#' : '') + s.option.name) || l('logs.selectConversation')}}</template>
                </filterable-select>
            </div>
        </div>
        <div class="form-group row" style="flex-shrink:0">
            <label for="date" class="col-2 col-form-label">{{l('logs.date')}}</label>
            <div class="col-8">
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
        <div class="messages-both" style="overflow: auto">
            <message-view v-for="message in filteredMessages" :message="message" :key="message.id"></message-view>
        </div>
        <input class="form-control" v-model="filter" :placeholder="l('filter')" v-show="messages" type="text"/>
    </modal>
</template>

<script lang="ts">
    import {format} from 'date-fns';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import CustomDialog from '../components/custom_dialog';
    import FilterableSelect from '../components/FilterableSelect.vue';
    import Modal from '../components/Modal.vue';
    import {messageToString} from './common';
    import core from './core';
    import {Conversation} from './interfaces';
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
        @Prop({required: true})
        readonly conversation!: Conversation;
        selectedConversation: {key: string, name: string} | null = null;
        dates: ReadonlyArray<Date> = [];
        selectedDate: string | null = null;
        conversations = core.logs.conversations.slice();
        l = l;
        filter = '';
        messages: ReadonlyArray<Conversation.Message> = [];
        formatDate = formatDate;

        get filteredMessages(): ReadonlyArray<Conversation.Message> {
            if(this.filter.length === 0) return this.messages;
            const filter = new RegExp(this.filter.replace(/[^\w]/gi, '\\$&'), 'i');
            return this.messages.filter(
                (x) => filter.test(x.text) || x.type !== Conversation.Message.Type.Event && filter.test(x.sender.name));
        }

        async mounted(): Promise<void> {
            return this.conversationChanged();
        }

        filterConversation(filter: RegExp, conversation: {key: string, name: string}): boolean {
            return filter.test(conversation.name);
        }

        @Watch('conversation')
        async conversationChanged(): Promise<void> {
            //tslint:disable-next-line:strict-boolean-expressions
            this.selectedConversation = this.conversations.filter((x) => x.key === this.conversation.key)[0] || null;
        }

        @Watch('selectedConversation')
        async conversationSelected(): Promise<void> {
            this.dates = this.selectedConversation === null ? [] :
                (await core.logs.getLogDates(this.selectedConversation.key)).slice().reverse();
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
            this.conversations = core.logs.conversations.slice();
            this.conversations.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0)));
            this.$forceUpdate();
            await this.loadMessages();
        }

        async loadMessages(): Promise<ReadonlyArray<Conversation.Message>> {
            if(this.selectedDate === null || this.selectedConversation === null)
                return this.messages = [];
            return this.messages = await core.logs.getLogs(this.selectedConversation.key, new Date(this.selectedDate));
        }
    }
</script>

<style>
    #logs-dialog .modal-body {
        display: flex;
        flex-direction: column;
    }
</style>