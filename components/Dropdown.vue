<template>
    <div class="dropdown">
        <button class="form-control custom-select" aria-haspopup="true" :aria-expanded="isOpen" @click="isOpen = true"
            @blur="isOpen = false" style="width:100%;text-align:left;display:flex;align-items:center" role="button" tabindex="-1">
            <div style="flex:1">
                <slot name="title" style="flex:1"></slot>
            </div>
        </button>
        <div class="dropdown-menu" :style="open ? 'display:block' : ''" @mousedown.stop.prevent @click="isOpen = false"
            ref="menu">
            <slot></slot>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';

    @Component
    export default class Dropdown extends Vue {
        isOpen = false;
        @Prop()
        readonly keepOpen?: boolean;

        get open(): boolean {
            return this.keepOpen || this.isOpen;
        }

        @Watch('open')
        onToggle(): void {
            const menu = this.$refs['menu'] as HTMLElement;
            if(!this.isOpen) {
                menu.style.cssText = '';
                return;
            }
            let element: HTMLElement | null = this.$el;
            while(element !== null) {
                if(getComputedStyle(element).position === 'fixed') {
                    menu.style.display = 'block';
                    const offset = menu.getBoundingClientRect();
                    menu.style.position = 'fixed';
                    menu.style.left = `${offset.left}px`;
                    menu.style.top = (offset.bottom < window.innerHeight) ? menu.style.top = `${offset.top}px` :
                        `${this.$el.getBoundingClientRect().top - offset.bottom + offset.top}px`;
                    break;
                }
                element = element.parentElement;
            }
        }
    }
</script>