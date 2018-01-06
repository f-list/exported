<template>
    <div class="sidebar-wrapper" :class="{open: expanded}">
        <div :class="'sidebar sidebar-' + (right ? 'right' : 'left')">
            <button @click="expanded = !expanded" class="btn btn-default btn-xs expander" :aria-label="label">
                <span :class="'fa fa-rotate-270 ' + icon" style="vertical-align: middle" v-if="right"></span>
                <span class="fa" :class="{'fa-chevron-down': !expanded, 'fa-chevron-up': expanded}"></span>
                <span :class="'fa fa-rotate-90 ' + icon" style="vertical-align: middle" v-if="!right"></span>
            </button>
            <div class="body">
                <slot></slot>
            </div>
        </div>
        <div class="modal-backdrop in" @click="expanded = false"></div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';

    @Component
    export default class Sidebar extends Vue {
        @Prop()
        readonly right?: true;
        @Prop()
        readonly label?: string;
        @Prop({required: true})
        readonly icon: string;
        @Prop({default: false})
        readonly open: boolean;
        expanded = this.open;

        @Watch('open')
        watchOpen(): void {
            this.expanded = this.open;
        }
    }
</script>