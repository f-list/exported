<template>
    <div id="memoDialog" tabindex="-1" class="modal" ref="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">&times;</button>
                    <h4 class="modal-title">Memo for {{name}}</h4>
                </div>
                <div class="modal-body">
                    <div class="form-group" v-if="editing">
                        <textarea v-model="message" maxlength="1000" class="form-control"></textarea>
                    </div>
                    <div v-if="!editing">
                        <p>{{message}}</p>

                        <p><a href="#" @click="editing=true">Edit</a></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">
                        Close
                    </button>
                    <button v-if="editing" class="btn btn-primary" @click="save" :disabled="saving">Save and Close</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import {methods} from './data_store';
    import {Character} from './interfaces';

    @Component
    export default class MemoDialog extends Vue {
        @Prop({required: true})
        private readonly character: Character;

        private message = '';
        editing = false;
        saving = false;

        get name(): string {
            return this.character.character.name;
        }

        show(): void {
            if(this.character.memo !== undefined)
                this.message = this.character.memo.memo;
            $(this.$refs['dialog']).modal('show');
        }

        async save(): Promise<void> {
            try {
                this.saving = true;
                const memoReply = await methods.memoUpdate(this.character.character.id, this.message);
                if(this.message === '')
                    this.$emit('memo', undefined);
                else
                    this.$emit('memo', memoReply);
                this.saving = false;
                $(this.$refs['dialog']).modal('hide');
            } catch(e) {
                this.saving = false;
            }
        }
    }
</script>