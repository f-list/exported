<template>
    <modal :action="l('settings.action')" @submit="submit" @close="init()" id="settings">
        <ul class="nav nav-tabs">
            <li role="presentation" v-for="tab in tabs" :class="{active: tab == selectedTab}">
                <a href="#" @click.prevent="selectedTab = tab">{{l('settings.tabs.' + tab)}}</a>
            </li>
        </ul>
        <div v-show="selectedTab == 'general'">
            <div class="form-group">
                <label class="control-label" for="disallowedTags">{{l('settings.disallowedTags')}}</label>
                <input id="disallowedTags" class="form-control" v-model="disallowedTags"/>
            </div>
            <div class="form-group">
                <label class="control-label" for="clickOpensMessage">
                    <input type="checkbox" id="clickOpensMessage" v-model="clickOpensMessage"/>
                    {{l('settings.clickOpensMessage')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="showAvatars">
                    <input type="checkbox" id="showAvatars" v-model="showAvatars"/>
                    {{l('settings.showAvatars')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="animatedEicons">
                    <input type="checkbox" id="animatedEicons" v-model="animatedEicons"/>
                    {{l('settings.animatedEicons')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="idleTimer">{{l('settings.idleTimer')}}</label>
                <input id="idleTimer" class="form-control" type="number" v-model="idleTimer"/>
            </div>
            <div class="form-group">
                <label class="control-label" for="messageSeparators">
                    <input type="checkbox" id="messageSeparators" v-model="messageSeparators"/>
                    {{l('settings.messageSeparators')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="logMessages">
                    <input type="checkbox" id="logMessages" v-model="logMessages"/>
                    {{l('settings.logMessages')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="logAds">
                    <input type="checkbox" id="logAds" v-model="logAds"/>
                    {{l('settings.logAds')}}
                </label>
            </div>
        </div>
        <div v-show="selectedTab == 'notifications'">
            <div class="form-group">
                <label class="control-label" for="playSound">
                    <input type="checkbox" id="playSound" v-model="playSound"/>
                    {{l('settings.playSound')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="notifications">
                    <input type="checkbox" id="notifications" v-model="notifications"/>
                    {{l('settings.notifications')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="highlight">
                    <input type="checkbox" id="highlight" v-model="highlight"/>
                    {{l('settings.highlight')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="highlightWords">{{l('settings.highlightWords')}}</label>
                <input id="highlightWords" class="form-control" v-model="highlightWords"/>
            </div>
            <div class="form-group">
                <label class="control-label" for="eventMessages">
                    <input type="checkbox" id="eventMessages" v-model="eventMessages"/>
                    {{l('settings.eventMessages')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="joinMessages">
                    <input type="checkbox" id="joinMessages" v-model="joinMessages"/>
                    {{l('settings.joinMessages')}}
                </label>
            </div>
            <div class="form-group">
                <label class="control-label" for="alwaysNotify">
                    <input type="checkbox" id="alwaysNotify" v-model="alwaysNotify"/>
                    {{l('settings.alwaysNotify')}}
                </label>
            </div>
        </div>
        <div v-show="selectedTab == 'import'" style="display:flex;padding-top:10px">
            <select id="import" class="form-control" v-model="importCharacter" style="flex:1;">
                <option value="">{{l('settings.import.selectCharacter')}}</option>
                <option v-for="character in availableImports" :value="character">{{character}}</option>
            </select>
            <button class="btn btn-default" @click="doImport" :disabled="!importCharacter">{{l('settings.import')}}</button>
        </div>
    </modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import CustomDialog from '../components/custom_dialog';
    import Modal from '../components/Modal.vue';
    import {requestNotificationsPermission} from './common';
    import core from './core';
    import {Settings as SettingsInterface} from './interfaces';
    import l from './localize';

    @Component(
        {components: {modal: Modal}}
    )
    export default class SettingsView extends CustomDialog {
        l = l;
        availableImports: ReadonlyArray<string> = [];
        selectedTab = 'general';
        importCharacter = '';
        playSound: boolean;
        clickOpensMessage: boolean;
        disallowedTags: string;
        notifications: boolean;
        highlight: boolean;
        highlightWords: string;
        showAvatars: boolean;
        animatedEicons: boolean;
        idleTimer: string;
        messageSeparators: boolean;
        eventMessages: boolean;
        joinMessages: boolean;
        alwaysNotify: boolean;
        logMessages: boolean;
        logAds: boolean;

        constructor() {
            super();
            this.init();
        }

        async created(): Promise<void> {
            const available = core.settingsStore.getAvailableCharacters();
            this.availableImports = available !== undefined ? (await available).filter((x) => x !== core.connection.character) : [];
        }

        init = function(this: SettingsView): void {
            const settings = core.state.settings;
            this.playSound = settings.playSound;
            this.clickOpensMessage = settings.clickOpensMessage;
            this.disallowedTags = settings.disallowedTags.join(',');
            this.notifications = settings.notifications;
            this.highlight = settings.highlight;
            this.highlightWords = settings.highlightWords.join(',');
            this.showAvatars = settings.showAvatars;
            this.animatedEicons = settings.animatedEicons;
            this.idleTimer = settings.idleTimer.toString();
            this.messageSeparators = settings.messageSeparators;
            this.eventMessages = settings.eventMessages;
            this.joinMessages = settings.joinMessages;
            this.alwaysNotify = settings.alwaysNotify;
            this.logMessages = settings.logMessages;
            this.logAds = settings.logAds;
        };

        async doImport(): Promise<void> {
            if(!confirm(l('settings.import.confirm', this.importCharacter, core.connection.character))) return;
            const importKey = async(key: keyof SettingsInterface.Keys) => {
                const settings = await core.settingsStore.get(key, this.importCharacter);
                if(settings !== undefined) await core.settingsStore.set(key, settings);
            };
            await importKey('settings');
            await importKey('pinned');
            await importKey('conversationSettings');
            this.init();
            core.reloadSettings();
            core.conversations.reloadSettings();
        }

        get tabs(): ReadonlyArray<string> {
            return this.availableImports.length > 0 ? ['general', 'notifications', 'import'] : ['general', 'notifications'];
        }

        async submit(): Promise<void> {
            core.state.settings = {
                playSound: this.playSound,
                clickOpensMessage: this.clickOpensMessage,
                disallowedTags: this.disallowedTags.split(',').map((x) => x.trim()).filter((x) => x.length),
                notifications: this.notifications,
                highlight: this.highlight,
                highlightWords: this.highlightWords.split(',').map((x) => x.trim()).filter((x) => x.length),
                showAvatars: this.showAvatars,
                animatedEicons: this.animatedEicons,
                idleTimer: this.idleTimer.length > 0 ? parseInt(this.idleTimer, 10) : 0,
                messageSeparators: this.messageSeparators,
                eventMessages: this.eventMessages,
                joinMessages: this.joinMessages,
                alwaysNotify: this.alwaysNotify,
                logMessages: this.logMessages,
                logAds: this.logAds
            };
            if(this.notifications) await requestNotificationsPermission();
        }
    }
</script>

<style>
    #settings .form-group {
        margin-left: 0;
        margin-right: 0;
    }
</style>