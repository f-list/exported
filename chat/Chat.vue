<template>
    <div style="display:flex; flex-direction: column; height:100%; justify-content: center">
        <div class="well" style="width:400px; max-width:100%; margin:0 auto;" v-if="!connected">
            <div class="alert alert-danger" v-show="error">{{error}}</div>
            <h3 class="card-header" style="margin-top:0">{{l('title')}}</h3>
            <div class="card-block">
                <h4 class="card-title">{{l('login.selectCharacter')}}</h4>
                <select v-model="selectedCharacter" class="form-control">
                    <option v-for="character in ownCharacters" :value="character">{{character}}</option>
                </select>
                <div style="text-align: right; margin-top: 10px;">
                    <button class="btn btn-primary" @click="connect" :disabled="connecting">
                        {{l(connecting ? 'login.connecting' : 'login.connect')}}
                    </button>
                </div>
            </div>
        </div>
        <chat v-else></chat>
        <modal :action="l('chat.disconnected.title')" :buttonText="l('action.cancel')" ref="reconnecting" @submit="cancelReconnect"
            :showCancel="false" buttonClass="btn-danger">
            <div class="alert alert-danger" v-show="error">{{error}}</div>
            {{l('chat.disconnected')}}
        </modal>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import Modal from '../components/Modal.vue';
    import Channels from '../fchat/channels';
    import Characters from '../fchat/characters';
    import ChatView from './ChatView.vue';
    import {errorToString, requestNotificationsPermission} from './common';
    import Conversations from './conversations';
    import core from './core';
    import l from './localize';

    @Component({
        components: {chat: ChatView, modal: Modal}
    })
    export default class Chat extends Vue {
        @Prop({required: true})
        readonly ownCharacters: string[];
        @Prop({required: true})
        readonly defaultCharacter: string;
        selectedCharacter = this.defaultCharacter;
        error = '';
        connecting = false;
        connected = false;
        l = l;

        mounted(): void {
            core.register('characters', Characters(core.connection));
            core.register('channels', Channels(core.connection, core.characters));
            core.register('conversations', Conversations());
            core.connection.onEvent('closed', (isReconnect) => {
                if(isReconnect) (<Modal>this.$refs['reconnecting']).show(true);
                if(this.connected) core.notifications.playSound('logout');
                this.connected = false;
            });
            core.connection.onEvent('connecting', async() => {
                this.connecting = true;
                if(core.state.settings.notifications) await requestNotificationsPermission();
            });
            core.connection.onEvent('connected', () => {
                (<Modal>this.$refs['reconnecting']).hide();
                this.error = '';
                this.connecting = false;
                this.connected = true;
                core.notifications.playSound('login');
            });
            core.connection.onError((e) => {
                this.error = errorToString(e);
                this.connecting = false;
            });
        }

        cancelReconnect(): void {
            core.connection.close();
            (<Modal>this.$refs['reconnecting']).hide();
        }

        connect(): void {
            this.connecting = true;
            core.connection.connect(this.selectedCharacter);
        }
    }
</script>