<template>
    <span>
        <a href="#" @click.prevent="showLogs" class="btn">
            <span class="fa" :class="isPersistent ? 'fa-file-text-o' : 'fa-download'"></span>
            <span class="btn-text">{{l('logs.title')}}</span>
        </a>
        <modal v-if="isPersistent" :buttons="false" ref="dialog" id="logs-dialog" :action="l('logs.title')" dialogClass="modal-lg"
            @open="onOpen" class="form-horizontal">
            <div class="form-group">
                <label class="col-sm-2">{{l('logs.conversation')}}</label>
                <div class="col-sm-10">
                    <filterable-select v-model="selectedConversation" :options="conversations" :filterFunc="filterConversation"
                        buttonClass="form-control" :placeholder="l('filter')"  @input="loadMessages">
                        <template slot-scope="s">{{s.option && ((s.option.id[0] == '#' ? '#' : '') + s.option.name)}}</template>
                    </filterable-select>
                </div>
            </div>
            <div class="form-group">
                <label for="date" class="col-sm-2">{{l('logs.date')}}</label>
                <div class="col-sm-10" style="display:flex">
                    <select class="form-control" v-model="selectedDate" id="date" @change="loadMessages">
                        <option v-for="date in dates" :value="date.getTime()">{{formatDate(date)}}</option>
                    </select>
                <button @click="downloadDay" class="btn btn-default" :disabled="!selectedDate"><span class="fa fa-download"></span></button>
                </div>
            </div>
            <div class="messages-both" style="overflow: auto">
                <message-view v-for="message in filteredMessages" :message="message" :key="message.id"></message-view>
            </div>
            <input class="form-control" v-model="filter" :placeholder="l('filter')" v-show="messages"/>
        </modal>
    </span>
</template>

<script lang="ts">
    import {format} from 'date-fns';
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import FilterableSelect from '../components/FilterableSelect.vue';
    import Modal from '../components/Modal.vue';
    import {messageToString} from './common';
    import core from './core';
    import {Conversation, Logs as LogInterfaces} from './interfaces';
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
    export default class Logs extends Vue {
        //tslint:disable:no-null-keyword
        @Prop({required: true})
        readonly conversation: Conversation;
        selectedConversation: {id: string, name: string} | null = null;
        selectedDate: string | null = null;
        isPersistent = LogInterfaces.isPersistent(core.logs);
        conversations = LogInterfaces.isPersistent(core.logs) ? core.logs.conversations : undefined;
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

        mounted(): void {
            (<Modal>this.$refs['dialog']).fixDropdowns();
            this.conversationChanged();
        }

        filterConversation(filter: RegExp, conversation: {id: string, name: string}): boolean {
            return filter.test(conversation.name);
        }

        @Watch('conversation')
        conversationChanged(): void {
            this.selectedConversation =
                //tslint:disable-next-line:strict-boolean-expressions
                this.conversations !== undefined && this.conversations.filter((x) => x.id === this.conversation.key)[0] || null;
        }

        async showLogs(): Promise<void> {
            if(this.isPersistent) (<Modal>this.$refs['dialog']).show();
            else this.download(`logs-${this.conversation.name}.txt`, await core.logs.getBacklog(this.conversation));
        }

        download(file: string, logs: ReadonlyArray<Conversation.Message>): void {
            const blob = new Blob(logs.map((x) => messageToString(x, formatTime)));
            //tslint:disable-next-line:strict-type-predicates
            if(navigator.msSaveBlob !== undefined) {
                navigator.msSaveBlob(blob, file);
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            if('download' in a) {
                a.href = url;
                a.setAttribute('download', file);
                a.style.display = 'none';
                document.body.appendChild(a);
                setTimeout(() => {
                    a.click();
                    document.body.removeChild(a);
                });
            } else {
                const iframe = document.createElement('iframe');
                document.body.appendChild(iframe);
                iframe.src = url;
                setTimeout(() => document.body.removeChild(iframe));
            }
            setTimeout(() => self.URL.revokeObjectURL(a.href));
        }

        downloadDay(): void {
            if(this.selectedConversation === null || this.selectedDate === null || this.messages.length === 0) return;
            this.download(`${this.selectedConversation.name}-${formatDate(new Date(this.selectedDate))}.txt`, this.messages);
        }

        async onOpen(): Promise<void> {
            this.conversations = (<LogInterfaces.Persistent>core.logs).conversations;
            this.$forceUpdate();
            await this.loadMessages();
        }

        get dates(): ReadonlyArray<Date> | undefined {
            if(!LogInterfaces.isPersistent(core.logs) || this.selectedConversation === null) return;
            return core.logs.getLogDates(this.selectedConversation.id).slice().reverse();
        }

        async loadMessages(): Promise<ReadonlyArray<Conversation.Message>> {
            if(this.selectedDate === null || this.selectedConversation === null || !LogInterfaces.isPersistent(core.logs))
                return this.messages = [];
            return this.messages = await core.logs.getLogs(this.selectedConversation.id, new Date(this.selectedDate));
        }
    }
</script>