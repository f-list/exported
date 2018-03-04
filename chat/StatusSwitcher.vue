<template>
    <modal :action="l('chat.setStatus')" @submit="setStatus" @close="reset" dialogClass="w-100 modal-lg">
        <div class="form-group" id="statusSelector">
            <label class="control-label">{{l('chat.setStatus.status')}}</label>
            <dropdown class="dropdown form-control" style="padding:0">
                <span slot="title"><span class="fa fa-fw" :class="getStatusIcon(status)"></span>{{l('status.' + status)}}</span>
                <a href="#" class="dropdown-item" v-for="item in statuses" @click.prevent="status = item">
                    <span class="fa fa-fw" :class="getStatusIcon(item)"></span>{{l('status.' + item)}}
                </a>
            </dropdown>
        </div>
        <div class="form-group">
            <label class="control-label">{{l('chat.setStatus.message')}}</label>
            <editor id="text" v-model="text" classes="form-control" maxlength="255" style="position:relative;">
                <div style="float:right;text-align:right;">
                    {{getByteLength(text)}} / 255
                </div>
            </editor>
        </div>
    </modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import CustomDialog from '../components/custom_dialog';
    import Dropdown from '../components/Dropdown.vue';
    import Modal from '../components/Modal.vue';
    import {Editor} from './bbcode';
    import {getByteLength} from './common';
    import core from './core';
    import {Character, userStatuses} from './interfaces';
    import l from './localize';
    import {getStatusIcon} from './user_view';

    @Component({
        components: {modal: Modal, editor: Editor, dropdown: Dropdown}
    })
    export default class StatusSwitcher extends CustomDialog {
        //tslint:disable:no-null-keyword
        selectedStatus: Character.Status | null = null;
        enteredText: string | null = null;
        statuses = userStatuses;
        l = l;
        getByteLength = getByteLength;
        getStatusIcon = getStatusIcon;

        get status(): Character.Status {
            return this.selectedStatus !== null ? this.selectedStatus : this.character.status;
        }

        set status(status: Character.Status) {
            this.selectedStatus = status;
        }

        get text(): string {
            return this.enteredText !== null ? this.enteredText : this.character.statusText;
        }

        set text(text: string) {
            this.enteredText = text;
        }

        get character(): Character {
            return core.characters.ownCharacter;
        }

        setStatus(): void {
            core.connection.send('STA', {status: this.status, statusmsg: this.text});
        }

        reset(): void {
            this.selectedStatus = null;
            this.enteredText = null;
        }
    }
</script>