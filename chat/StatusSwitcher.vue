<template>
    <modal :action="l('chat.setStatus')" @submit="setStatus" @close="reset">
        <div class="form-group" id="statusSelector">
            <label class="control-label">{{l('chat.setStatus.status')}}</label>
            <div class="dropdown form-control" style="padding: 0;">
                <button class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true"
                        aria-expanded="false" style="width:100%; text-align:left; display:flex; align-items:center">
                    <span style="flex: 1;"><span class="fa fa-fw" :class="getStatusIcon(status)"></span>{{l('status.' + status)}}</span>
                    <span class="caret"></span>
                </button>
                <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                    <li><a href="#" v-for="item in statuses" @click.prevent="status = item">
                        <span class="fa fa-fw" :class="getStatusIcon(item)"></span>{{l('status.' + item)}}
                    </a></li>
                </ul>
            </div>
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
    import Modal from '../components/Modal.vue';
    import {Editor} from './bbcode';
    import {getByteLength} from './common';
    import core from './core';
    import {Character, userStatuses} from './interfaces';
    import l from './localize';
    import {getStatusIcon} from './user_view';

    @Component({
        components: {modal: Modal, editor: Editor}
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