<template>
    <Modal id="memoDialog" :action="'Memo for ' + name" buttonText="Save and Close" @close="onClose" @submit="save">
        <div class="form-group" v-if="editing">
            <textarea v-model="message" maxlength="1000" class="form-control"></textarea>
        </div>
        <div v-else>
            <p>{{message}}</p>

            <p><a href="#" @click="editing=true">Edit</a></p>
        </div>
    </Modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import CustomDialog from '../../components/custom_dialog';
    import Modal from '../../components/Modal.vue';
    import * as Utils from '../utils';
    import {methods} from './data_store';
    import {Character} from './interfaces';

    @Component({
        components: {Modal}
    })
    export default class MemoDialog extends CustomDialog {
        @Prop({required: true})
        private readonly character: Character;

        private message = '';
        editing = false;
        saving = false;

        get name(): string {
            return this.character.character.name;
        }

        show(): void {
            super.show();
            if(this.character.memo !== undefined)
                this.message = this.character.memo.memo;
        }

        onClose(): void {
            this.editing = false;
        }

        async save(): Promise<void> {
            try {
                this.saving = true;
                const memoReply = await methods.memoUpdate(this.character.character.id, this.message);
                this.$emit('memo', this.message !== '' ? memoReply : undefined);
                this.hide();
            } catch(e) {
                Utils.ajaxError(e, 'Unable to set memo.');
            }
            this.saving = false;
        }
    }
</script>