<template>
    <modal :buttons="false" :action="l('chat.channels')" @close="closed">
        <div style="display: flex; flex-direction: column;">
            <ul class="nav nav-tabs">
                <li role="presentation" :class="{active: !privateTabShown}">
                    <a href="#" @click.prevent="privateTabShown = false">{{l('channelList.public')}}</a>
                </li>
                <li role="presentation" :class="{active: privateTabShown}">
                    <a href="#" @click.prevent="privateTabShown = true">{{l('channelList.private')}}</a>
                </li>
            </ul>
            <div style="display: flex; flex-direction: column">
                <div style="display:flex; padding: 10px 0; flex-shrink: 0;">
                    <input class="form-control" style="flex:1; margin-right:10px;" v-model="filter" :placeholder="l('filter')"/>
                    <a href="#" @click.prevent="sortCount = !sortCount">
                        <span class="fa fa-2x" :class="{'fa-sort-amount-desc': sortCount, 'fa-sort-alpha-asc': !sortCount}"></span>
                    </a>
                </div>
                <div style="overflow: auto;" v-show="!privateTabShown">
                    <div v-for="channel in officialChannels" :key="channel.id">
                        <label :for="channel.id">
                            <input type="checkbox" :checked="channel.isJoined" :id="channel.id" @click.prevent="setJoined(channel)"/>
                            {{channel.name}} ({{channel.memberCount}})
                        </label>
                    </div>
                </div>
                <div style="overflow: auto;" v-show="privateTabShown">
                    <div v-for="channel in openRooms" :key="channel.id">
                        <label :for="channel.id">
                            <input type="checkbox" :checked="channel.isJoined" :id="channel.id" @click.prevent="setJoined(channel)"/>
                            {{channel.name}} ({{channel.memberCount}})
                        </label>
                    </div>
                </div>
                <div style="display:flex; padding: 10px 0; flex-shrink: 0;">
                    <input class="form-control" style="flex:1; margin-right:10px;" v-model="createName"
                           :placeholder="l('channelList.createName')"/>
                    <button class="btn btn-primary" @click="create">{{l('channelList.create')}}</button>
                </div>
            </div>
        </div>
    </modal>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import CustomDialog from '../components/custom_dialog';
    import Modal from '../components/Modal.vue';
    import core from './core';
    import {Channel} from './interfaces';
    import l from './localize';
    import ListItem = Channel.ListItem;

    @Component({
        components: {modal: Modal}
    })
    export default class ChannelList extends CustomDialog {
        privateTabShown = false;
        l = l;
        sortCount = true;
        filter = '';
        createName = '';

        get openRooms(): ReadonlyArray<Channel.ListItem> {
            return this.applyFilter(core.channels.openRooms);
        }

        get officialChannels(): ReadonlyArray<Channel.ListItem> {
            return this.applyFilter(core.channels.officialChannels);
        }

        applyFilter(list: {[key: string]: Channel.ListItem | undefined}): ReadonlyArray<Channel.ListItem> {
            const channels: Channel.ListItem[] = [];
            if(this.filter.length > 0) {
                const search = new RegExp(this.filter.replace(/[^\w]/gi, '\\$&'), 'i');
                //tslint:disable-next-line:forin
                for(const key in list) {
                    const item = list[key]!;
                    if(search.test(item.name)) channels.push(item);
                }
            } else
                for(const key in list) channels.push(list[key]!);
            channels.sort(this.sortCount ? (x, y) => y.memberCount - x.memberCount : (x, y) => x.name.localeCompare(y.name));
            return channels;
        }

        create(): void {
            core.connection.send('CCR', {channel: this.createName});
            this.hide();
        }

        closed(): void {
            this.createName = '';
        }

        setJoined(channel: ListItem): void {
            channel.isJoined ? core.channels.leave(channel.id) : core.channels.join(channel.id);
        }
    }
</script>