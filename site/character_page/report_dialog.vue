<template>
    <div id="reportDialog" tabindex="-1" class="modal" ref="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal"
                        aria-label="Close">&times;
                    </button>
                    <h4 class="modal-title">Report Character {{ name }}</h4>
                </div>
                <div class="modal-body form-horizontal">
                    <div class="form-group">
                        <label class="col-xs-4 control-label">Type:</label>

                        <div class="col-xs-8">
                            <select v-select="validTypes" v-model="type" class="form-control">
                            </select>
                        </div>
                    </div>
                    <div v-if="type !== 'takedown'">
                        <div class="form-group" v-if="type === 'profile'">
                            <label class="col-xs-4 control-label">Violation Type:</label>

                            <div class="col-xs-8">
                                <select v-select="violationTypes" v-model="violation" class="form-control">
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="col-xs-4 control-label">Your Character:</label>

                            <div class="col-xs-8">
                                <character-select v-model="ourCharacter"></character-select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="col-xs-4 control-label">Reason/Message:</label>

                            <div class="col-xs-8">
                                <bbcode-editor v-model="message" :maxlength="45000"
                                    :classes="'form-control'"></bbcode-editor>
                            </div>
                        </div>
                    </div>
                    <div v-show="type === 'takedown'" class="alert alert-info">
                        Please file art takedowns from the <a :href="ticketUrl">tickets page.</a>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">
                        Close
                    </button>
                    <button :disabled="!dataValid || submitting" class="btn btn-primary" @click="submitReport">
                        Report Character
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import * as Utils from '../utils';
    import {methods} from './data_store';
    import {Character, SelectItem} from './interfaces';

    @Component
    export default class ReportDialog extends Vue {
        @Prop({required: true})
        private readonly character: Character;

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

        show(): void {
            $(this.$refs['dialog']).modal('show');
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
                $(this.$refs['dialog']).modal('hide');
                Utils.flashSuccess('Character reported.');
            } catch(e) {
                this.submitting = false;
                Utils.ajaxError(e, 'Unable to report character');
            }
        }
    }
</script>