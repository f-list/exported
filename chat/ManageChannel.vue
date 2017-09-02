<template>
    <span>
        <a href="#" @click.prevent="openDialog" class="btn">
            <span class="fa fa-edit"></span> {{l('manageChannel.open')}}
        </a>
        <modal ref="dialog" :action="l('manageChannel.action', channel.name)" :buttonText="l('manageChannel.submit')" @submit="submit">
            <div class="form-group" v-show="channel.id.substr(0, 4) === 'adh-'">
                <label class="control-label" for="isPublic">
                    <input type="checkbox" id="isPublic" v-model="isPublic"/>
                    {{l('manageChannel.isPublic')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="mode">{{l('manageChannel.mode')}}</label>
                <select v-model="mode" class="form-control" id="mode">
                    <option v-for="mode in modes" :value="mode">{{l('channel.mode.' + mode)}}</option>
                </select>
            </div>
            <div class="form-group">
                <label>{{l('manageChannel.description')}}</label>
                <bbcode-editor classes="form-control" id="description" v-model="description" style="position:relative" :maxlength="50000">
                    <div style="float:right;text-align:right;">
                        {{getByteLength(description)}} / {{maxLength}}
                    </div>
                </bbcode-editor>
            </div>
            <div v-if="isChannelOwner">
                <h4>{{l('manageChannel.mods')}}</h4>
                <div v-for="(mod, index) in opList">
                    <a href="#" @click.prevent="opList.splice(index, 1)" class="btn fa fa-times"
                        style="padding:0;vertical-align:baseline"></a>
                    {{mod}}
                </div>
                <div style="display:flex;margin-top:5px">
                    <input :placeholder="l('manageChannel.modAddName')" v-model="modAddName" class="form-control"/>
                    <button class="btn btn-default" @click="modAdd" :disabled="!modAddName">{{l('manageChannel.modAdd')}}</button>
                </div>
            </div>
        </modal>
    </span>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import Modal from '../components/Modal.vue';
    import {Editor} from './bbcode';
    import {getByteLength} from './common';
    import core from './core';
    import {Channel, channelModes} from './interfaces';
    import l from './localize';

    @Component({
        components: {modal: Modal, 'bbcode-editor': Editor}
    })
    export default class ManageChannel extends Vue {
        @Prop({required: true})
        readonly channel: Channel;
        modes = channelModes;
        isPublic = this.channelIsPublic;
        mode = this.channel.mode;
        description = this.channel.description;
        l = l;
        getByteLength = getByteLength;
        modAddName = '';
        opList: string[] = [];
        maxLength = 50000; //core.connection.vars.cds_max;

        @Watch('channel')
        channelChanged(): void {
            this.mode = this.channel.mode;
            this.isPublic = this.channelIsPublic;
            this.description = this.channel.description;
        }

        get channelIsPublic(): boolean {
            return core.channels.openRooms[this.channel.id] !== undefined;
        }

        get isChannelOwner(): boolean {
            return this.channel.owner === core.connection.character || core.characters.ownCharacter.isChatOp;
        }

        modAdd(): void {
            this.opList.push(this.modAddName);
            this.modAddName = '';
        }

        submit(): void {
            if(this.isPublic !== this.channelIsPublic) {
                core.connection.send('RST', {channel: this.channel.id, status: this.isPublic ? 'public' : 'private'});
                core.connection.send('ORS');
            }
            if(this.mode !== this.channel.mode)
                core.connection.send('RMO', {channel: this.channel.id, mode: this.mode});
            if(this.description !== this.channel.description)
                core.connection.send('CDS', {channel: this.channel.id, description: this.description});
            for(const op of this.channel.opList) {
                const index = this.opList.indexOf(op);
                if(index !== -1) this.opList.splice(index, 1);
                else core.connection.send('COR', {channel: this.channel.id, character: op});
            }
            for(const op of this.opList) core.connection.send('COA', {channel: this.channel.id, character: op});
        }

        openDialog(): void {
            (<Modal>this.$refs['dialog']).show();
            this.opList = this.channel.opList.slice();
        }
    }
</script>