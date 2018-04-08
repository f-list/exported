<template>
    <modal :action="l('chat.report')" @submit.prevent="submit" :disabled="submitting">
        <div class="alert alert-danger" v-show="error">{{error}}</div>
        <h4>{{reporting}}</h4>
        <span v-show="!character">{{l('chat.report.channel.description')}}</span>
        <div ref="caption"></div>
        <br/>
        <div class="form-group">
            <label>{{l('chat.report.text')}}</label>
            <textarea class="form-control" v-model="text"></textarea>
        </div>
    </modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import CustomDialog from '../components/custom_dialog';
    import Modal from '../components/Modal.vue';
    import BBCodeParser, {BBCodeElement} from './bbcode';
    import {errorToString, messageToString} from './common';
    import core from './core';
    import {Character, Conversation} from './interfaces';
    import l from './localize';

    @Component({
        components: {modal: Modal}
    })
    export default class ReportDialog extends CustomDialog {
        //tslint:disable:no-null-keyword
        character: Character | null = null;
        text = '';
        l = l;
        error = '';
        submitting = false;

        mounted(): void {
            (<Element>this.$refs['caption']).appendChild(new BBCodeParser().parseEverything(l('chat.report.description')));
        }

        beforeDestroy(): void {
            (<BBCodeElement>(<Element>this.$refs['caption']).firstChild).cleanup!();
        }

        get reporting(): string {
            const conversation = core.conversations.selectedConversation;
            const isChannel = !Conversation.isPrivate(conversation);
            if(isChannel && this.character === null) return l('chat.report.channel', conversation.name);
            if(this.character === null) return '';
            const key = `chat.report.${(isChannel ? 'channel.user' : 'private')}`;
            return l(key, this.character.name, conversation.name);
        }

        report(character?: Character): void {
            this.error = '';
            this.text = '';
            const current = core.conversations.selectedConversation;
            this.character = character !== undefined ? character : Conversation.isPrivate(current) ? current.character : null;
            this.show();
        }

        async submit(): Promise<void> {
            const conversation = core.conversations.selectedConversation;
            /*tslint:disable-next-line:no-unnecessary-callback-wrapper*///https://github.com/palantir/tslint/issues/2430
            const log = conversation.reportMessages.map((x) => messageToString(x));
            const tab = (Conversation.isChannel(conversation) ? `${conversation.name} (${conversation.channel.id})`
                : Conversation.isPrivate(conversation) ? `Conversation with ${conversation.name}` : 'Console');
            const text = (this.character !== null ? `Reporting user: [user]${this.character.name}[/user] | ` : '') + this.text;
            const data = {
                character: core.connection.character,
                reportText: this.text,
                log: JSON.stringify(log),
                channel: tab,
                text: true,
                reportUser: <string | undefined>undefined
            };
            if(this.character !== null) data.reportUser = this.character.name;
            try {
                this.submitting = true;
                const report = <{log_id?: number}>(await core.connection.queryApi('report-submit.php', data));
                //tslint:disable-next-line:strict-boolean-expressions
                if(!report.log_id) return;
                core.connection.send('SFC', {action: 'report', logid: report.log_id, report: text, tab: conversation.name});
                this.hide();
            } catch(e) {
                this.error = errorToString(e);
            } finally {
                this.submitting = false;
            }
        }
    }
</script>