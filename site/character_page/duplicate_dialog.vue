<template>
    <div id="duplicateDialog" tabindex="-1" class="modal" ref="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">&times;</button>
                    <h4 class="modal-title">Duplicate character {{name}}</h4>
                </div>
                <div class="modal-body form-horizontal">
                    <p>This will duplicate the character, kinks, infotags, customs, subkinks and images. Guestbook
                        entries, friends, groups, and bookmarks are not duplicated.</p>
                    <div class="form-group">
                        <label class="col-xs-1 control-label">Name:</label>

                        <div class="col-xs-5">
                            <input type="text" class="form-control" maxlength="60" v-model="newName"
                                :class="{'has-error': error}"/>
                        </div>
                        <div class="col-xs-2">
                            <button type="button" class="btn btn-default" @click="checkName"
                                :disabled="newName.length < 2 || checking">
                                Check Name
                            </button>
                        </div>
                        <div class="col-xs-3">
                            <ul>
                                <li v-show="valid" class="text-success">Name available and valid.</li>
                            </ul>
                            <ul>
                                <li v-show="error" class="text-danger">{{ error }}</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-success" @click="duplicate"
                        :disabled="duplicating || checking">
                        Duplicate Character
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
    import {Character} from './interfaces';

    @Component
    export default class DuplicateDialog extends Vue {
        @Prop({required: true})
        private readonly character: Character;

        error = '';
        private newName = '';
        valid = false;

        checking = false;
        duplicating = false;

        get name(): string {
            return this.character.character.name;
        }

        show(): void {
            $(this.$refs['dialog']).modal('show');
        }

        async checkName(): Promise<boolean> {
            try {
                this.checking = true;
                const result = await methods.characterNameCheck(this.newName);
                this.valid = result.valid;
                this.error = '';
                return true;
            } catch(e) {
                this.valid = false;
                this.error = '';
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                return false;
            } finally {
                this.checking = false;
            }
        }

        async duplicate(): Promise<void> {
            try {
                this.duplicating = true;
                const result = await methods.characterDuplicate(this.character.character.id, this.newName);
                $(this.$refs['dialog']).modal('hide');
                window.location.assign(result.next);
            } catch(e) {
                Utils.ajaxError(e, 'Unable to duplicate character');
                this.valid = false;
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
            }
            this.duplicating = false;
        }
    }
</script>