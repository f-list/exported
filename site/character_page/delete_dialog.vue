<template>
    <div id="deleteDialog" tabindex="-1" class="modal" ref="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">&times;</button>
                    <h4 class="modal-title">Delete character {{name}}</h4>
                </div>
                <div class="modal-body">
                    Are you sure you want to permanently delete {{ name }}?<br/>
                    Character deletion cannot be undone for any reason.
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" @click="deleteCharacter" :disabled="deleting">Delete Character</button>
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
    export default class DeleteDialog extends Vue {
        @Prop({required: true})
        private readonly character: Character;

        deleting = false;

        get name(): string {
            return this.character.character.name;
        }

        show(): void {
            $(this.$refs['dialog']).modal('show');
        }

        async deleteCharacter(): Promise<void> {
            try {
                this.deleting = true;
                await methods.characterDelete(this.character.character.id);
                $(this.$refs['dialog']).modal('hide');
                window.location.assign('/');
            } catch(e) {
                Utils.ajaxError(e, 'Unable to delete character');
            }
            this.deleting = false;
        }
    }
</script>