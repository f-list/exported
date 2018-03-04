<template>
    <modal id="reportDialog" :action="'Report character' + name" :disabled="!dataValid || submitting" @submit.prevent="submitReport">
        <div class="form-group">
            <label>Type</label>
            <select v-select="validTypes" v-model="type" class="form-control"></select>
        </div>
        <div v-if="type !== 'takedown'">
            <div class="form-group" v-if="type === 'profile'">
                <label>Violation Type</label>
                <select v-select="violationTypes" v-model="violation" class="form-control"></select>
            </div>
            <div class="form-group">
                <label>Your Character</label>
                <character-select v-model="ourCharacter"></character-select>
            </div>
            <div class="form-group">
                <label>Reason/Message</label>
                <bbcode-editor v-model="message" :maxlength="45000" :classes="'form-control'"></bbcode-editor>
            </div>
        </div>
        <div v-show="type === 'takedown'" class="alert alert-info">
            Please file art takedowns from the <a :href="ticketUrl">tickets page.</a>
        </div>
    </modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import CustomDialog from '../../components/custom_dialog';
    import Modal from '../../components/Modal.vue';
    import * as Utils from '../utils';
    import {methods} from './data_store';
    import {Character, SelectItem} from './interfaces';

    @Component({
        components: {modal: Modal}
    })
    export default class ReportDialog extends CustomDialog {
        @Prop({required: true})
        private readonly character!: Character;

        private ourCharacter = Utils.Settings.defaultCharacter;
        private type = '';
        private violation = '';
        private message = '';

        submitting = false;

        ticketUrl = `${Utils.siteDomain}tickets/new`;

        validTypes: ReadonlyArray<SelectItem> = [
            {text: 'None', value: ''},
            {text: 'Profile Violation', value: 'profile'},
            {text: 'Name Request', value: 'name_request'},
            {text: 'Art Takedown', value: 'takedown'},
            {text: 'Other', value: 'other'}
        ];
        violationTypes: ReadonlyArray<string> = [
            'Real life images on underage character',
            'Real life animal images on sexual character',
            'Amateur/farmed real life images',
            'Defamation',
            'OOC Kinks',
            'Real life contact information',
            'Solicitation for real life contact',
            'Other'
        ];

        get name(): string {
            return this.character.character.name;
        }

        get dataValid(): boolean {
            if(this.type === '' || this.type === 'takedown')
                return false;
            if(this.message === '')
                return false;
            if(this.type === 'profile' && this.violation === '')
                return false;
            return true;
        }

        async submitReport(): Promise<void> {
            try {
                this.submitting = true;
                const message = (this.type === 'profile' ? `Reporting character for violation: ${this.violation}\n\n` : '') + this.message;
                await methods.characterReport({
                    subject: (this.type === 'name_request' ? 'Requesting name: ' : 'Reporting character: ') + this.name,
                    message,
                    character: this.ourCharacter,
                    type: this.type,
                    url: Utils.characterURL(this.name),
                    reported_character: this.character.character.id
                });
                this.submitting = false;
                this.hide();
                Utils.flashSuccess('Character reported.');
            } catch(e) {
                this.submitting = false;
                Utils.ajaxError(e, 'Unable to report character');
            }
        }
    }
</script>