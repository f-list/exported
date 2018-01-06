<template>
    <span v-show="isShown">
        <div tabindex="-1" class="modal flex-modal" @click.self="hideWithCheck"
            style="align-items:flex-start;padding:30px;justify-content:center;display:flex">
            <div class="modal-dialog" :class="dialogClass" style="display:flex;flex-direction:column;max-height:100%;margin:0">
                <div class="modal-content" style="display:flex;flex-direction:column;flex-grow:1">
                    <div class="modal-header" style="flex-shrink:0">
                        <button type="button" class="close" @click="hide" aria-label="Close" v-show="!keepOpen">&times;</button>
                        <h4 class="modal-title">
                            <slot name="title">{{action}}</slot>
                        </h4>
                    </div>
                    <div class="modal-body" style="overflow: auto; display: flex; flex-direction: column">
                        <slot></slot>
                    </div>
                    <div class="modal-footer" v-if="buttons">
                        <button type="button" class="btn btn-default" @click="hideWithCheck" v-if="showCancel">Cancel</button>
                        <button type="button" class="btn" :class="buttonClass" @click="submit" :disabled="disabled">
                            {{submitText}}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-backdrop in"></div>
    </span>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import {getKey} from '../chat/common';

    const dialogStack: Modal[] = [];
    window.addEventListener('keydown', (e) => {
        if(getKey(e) === 'escape' && dialogStack.length > 0) dialogStack.pop()!.isShown = false;
    });

    @Component
    export default class Modal extends Vue {
        @Prop({default: ''})
        readonly action: string;
        @Prop()
        readonly dialogClass?: {string: boolean};
        @Prop({default: true})
        readonly buttons: boolean;
        @Prop({default: () => ({'btn-primary': true})})
        readonly buttonClass: {string: boolean};
        @Prop()
        readonly disabled?: boolean;
        @Prop({default: true})
        readonly showCancel: boolean;
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

        private hideWithCheck(): void {
            if(this.keepOpen) return;
            this.hide();
        }

        fixDropdowns(): void {
            //tslint:disable-next-line:no-this-assignment
            const vm = this;
            $('.dropdown', this.$el).on('show.bs.dropdown', function(this: HTMLElement & {menu?: HTMLElement}): void {
                if(this.menu !== undefined) {
                    this.menu.style.display = 'block';
                    return;
                }
                const $this = $(this).children('.dropdown-menu');
                this.menu = $this[0];
                vm.$nextTick(() => {
                    const offset = $this.offset();
                    if(offset === undefined) return;
                    $('body').append($this.css({
                        display: 'block',
                        left: offset.left,
                        position: 'absolute',
                        top: offset.top,
                        'z-index': 1100
                    }).detach());
                });
            }).on('hide.bs.dropdown', function(this: HTMLElement & {menu: HTMLElement}): void {
                this.menu.style.display = 'none';
            });
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