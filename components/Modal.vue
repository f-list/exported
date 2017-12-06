<template>
    <div tabindex="-1" class="modal flex-modal" :style="isShown ? 'display:flex' : ''"
        style="align-items: flex-start; padding: 30px; justify-content: center;">
        <div class="modal-dialog" :class="dialogClass" style="display: flex; flex-direction: column; max-height: 100%; margin: 0;">
            <div class="modal-content" style="display:flex; flex-direction: column;">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">&times;</button>
                    <h4 class="modal-title">
                        <slot name="title">{{action}}</slot>
                    </h4>
                </div>
                <div class="modal-body" style="overflow: auto; display: flex; flex-direction: column">
                    <slot></slot>
                </div>
                <div class="modal-footer" v-if="buttons">
                    <button type="button" class="btn btn-default" data-dismiss="modal" v-if="showCancel">Cancel</button>
                    <button type="button" class="btn" :class="buttonClass" @click="submit" :disabled="disabled">
                        {{submitText}}
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
        element: JQuery;

        get submitText(): string {
            return this.buttonText !== undefined ? this.buttonText : this.action;
        }

        submit(e: Event): void {
            this.$emit('submit', e);
            if(!e.defaultPrevented) this.hide();
        }

        /*tslint:disable-next-line:typedef*///https://github.com/palantir/tslint/issues/711
        show(keepOpen = false): void {
            if(keepOpen) this.element.on('hide.bs.modal', (e) => e.preventDefault());
            this.element.modal('show');
            this.isShown = true;
        }

        hide(): void {
            this.element.off('hide.bs.modal');
            this.element.modal('hide');
            this.isShown = false;
        }

        fixDropdowns(): void {
            //tslint:disable-next-line:no-this-assignment
            const vm = this;
            $('.dropdown', this.$el).on('show.bs.dropdown', function(this: HTMLElement & {menu?: HTMLElement}): void {
                $(document).off('focusin.bs.modal');
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

        mounted(): void {
            this.element = $(this.$el);
            this.element.on('shown.bs.modal', () => this.$emit('open'));
            this.element.on('hidden.bs.modal', () => this.$emit('close'));
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