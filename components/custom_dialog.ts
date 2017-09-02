import Vue from 'vue';
import Modal from './Modal.vue';

export default class CustomDialog extends Vue {
    show(): void {
        (<Modal>this.$children[0]).show();
    }

    hide(): void {
        (<Modal>this.$children[0]).hide();
    }
}