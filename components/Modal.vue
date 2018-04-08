<template>
    <span v-show="isShown">
        <div tabindex="-1" class="modal" @click.self="hideWithCheck" style="display:flex">
            <div class="modal-dialog" :class="dialogClass" style="display:flex;align-items:center">
                <div class="modal-content" style="max-height:100%">
                    <div class="modal-header" style="flex-shrink:0">
                        <h4 class="modal-title">
                            <slot name="title">{{action}}</slot>
                        </h4>
                        <button type="button" class="close" @click="hide" aria-label="Close" v-show="!keepOpen">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow:auto">
                        <slot></slot>
                    </div>
                    <div class="modal-footer" v-if="buttons">
                        <button type="button" class="btn btn-secondary" @click="hideWithCheck" v-if="showCancel">Cancel</button>
                        <button type="button" class="btn" :class="buttonClass" @click="submit" :disabled="disabled">
                            {{submitText}}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-backdrop show"></div>
    </span>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import {getKey} from '../chat/common';
    import {Keys} from '../keys';

    const dialogStack: Modal[] = [];
    window.addEventListener('keydown', (e) => {
        if(getKey(e) === Keys.Escape && dialogStack.length > 0) dialogStack[dialogStack.length - 1].hideWithCheck();
    });
    window.addEventListener('backbutton', (e) => {
        if(dialogStack.length > 0) {
            e.stopPropagation();
            e.preventDefault();
            dialogStack.pop()!.isShown = false;
        }
    }, true);

    @Component
    export default class Modal extends Vue {
        @Prop({default: ''})
        readonly action!: string;
        @Prop()
        readonly dialogClass?: {string: boolean};
        @Prop({default: true})
        readonly buttons!: boolean;
        @Prop({default: () => ({'btn-primary': true})})
        readonly buttonClass!: {string: boolean};
        @Prop()
        readonly disabled?: boolean;
        @Prop({default: true})
        readonly showCancel!: boolean;
        @Prop()
        readonly buttonText?: string;
        isShown = false;
        keepOpen = false;

        get submitText(): string {
            return this.buttonText !== undefined ? this.buttonText : this.action;
        }

        submit(e: Event): void {
            this.$emit('submit', e);
            if(!e.defaultPrevented) this.hideWithCheck();
        }

        /*tslint:disable-next-line:typedef*///https://github.com/palantir/tslint/issues/711
        show(keepOpen = false): void {
            this.isShown = true;
            this.keepOpen = keepOpen;
            dialogStack.push(this);
            this.$emit('open');
        }

        hide(): void {
            this.isShown = false;
            this.$emit('close');
            dialogStack.pop();
        }

        hideWithCheck(): void {
            if(this.keepOpen) return;
            this.hide();
        }

        beforeDestroy(): void {
            if(this.isShown) this.hide();
        }
    }
</script>

<style>
    .flex-modal .modal-body > .form-group {
        margin-left: 0;
        margin-right: 0;
    }
</style>