<template>
    <div id="copyCustomDialog" tabindex="-1" class="modal" ref="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">&times;</button>
                    <h4 class="modal-title">Copy Custom Kink</h4>
                </div>
                <div class="modal-body form-horizontal">
                    <form-errors :errors="errors" field="name">
                        <label class="col-xs-3 control-label">Name:</label>

                        <div class="col-xs-9">
                            <input type="text" class="form-control" maxlength="60" v-model="name"/>
                        </div>
                    </form-errors>
                    <form-errors :errors="errors" field="description">
                        <label class="col-xs-3 control-label">Description:</label>

                        <div class="col-xs-9">
                            <input type="text" class="form-control" maxlength="60" v-model="description"/>
                        </div>
                    </form-errors>
                    <form-errors :errors="errors" field="choice">
                        <label class="col-xs-3 control-label">Choice:</label>
                        <div class="col-xs-9">
                            <select v-model="choice" class="form-control">
                                <option value="favorite">Favorite</option>
                                <option value="yes">Yes</option>
                                <option value="maybe">Maybe</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                    </form-errors>
                    <form-errors :errors="errors" field="target">
                        <label class="col-xs-3 control-label">Target Character:</label>
                        <div class="col-xs-9">
                            <character-select v-model="target"></character-select>
                        </div>
                    </form-errors>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-success" @click="copyCustom"
                        :disabled="!valid || submitting">
                        Copy Custom Kink
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import FormErrors from '../../components/form_errors.vue';
    import * as Utils from '../utils';
    import {methods} from './data_store';
    import {KinkChoice} from './interfaces';


    @Component({
        components: {
            'form-errors': FormErrors
        }
    })
    export default class CopyCustomDialog extends Vue {
        private name = '';
        private description = '';
        private choice: KinkChoice = 'favorite';
        private target = Utils.Settings.defaultCharacter;
        errors = {};
        submitting = false;

        show(name: string, description: string): void {
            this.name = name;
            this.description = description;
            $(this.$refs['dialog']).modal('show');
        }

        async copyCustom(): Promise<void> {
            try {
                this.errors = {};
                this.submitting = true;
                await methods.characterCustomKinkAdd(this.target, this.name, this.description, this.choice);
                this.submitting = false;
            } catch(e) {
                this.submitting = false;
                Utils.ajaxError(e, 'Unable to copy custom kink');
                if(Utils.isJSONError(e))
                    this.errors = e.response.data;
            }
        }

        get valid(): boolean {
            return this.name.length > 0 && this.description.length > 0;
        }
    }
</script>