<template>
    <a href="#" @click.prevent="joinChannel" :disabled="channel && channel.isJoined"><span class="fa fa-hashtag"></span>{{displayText}}</a>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import core from './core';
    import {Channel} from './interfaces';

    @Component
    export default class ChannelView extends Vue {
        @Prop({required: true})
        readonly id!: string;
        @Prop({required: true})
        readonly text!: string;

        mounted(): void {
            core.channels.requestChannelsIfNeeded(300000);
        }

        joinChannel(): void {
            if(this.channel === undefined || !this.channel.isJoined)
                core.channels.join(this.id);
        }

        get displayText(): string {
            return this.channel !== undefined ? `${this.channel.name} (${this.channel.memberCount})` : this.text;
        }

        get channel(): Channel.ListItem | undefined {
            return core.channels.getChannelItem(this.id);
        }
    }
</script>