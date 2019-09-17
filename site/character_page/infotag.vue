<template>
    <div class="infotag">
        <span class="infotag-label">{{infotag.name}}: </span>
        <span v-if="infotag.infotag_group !== contactGroupId" class="infotag-value">{{value}}</span>
        <span v-else class="infotag-value"><a :href="contactLink">{{contactValue}}</a></span>
    </div>
</template>

<script lang="ts">
    import {Component, Prop} from '@f-list/vue-ts';
    import Vue from 'vue';
    import {CharacterInfotag, Infotag, ListItem} from '../../interfaces';
    import {formatContactLink, formatContactValue} from './contact_utils';
    import {Store} from './data_store';
    import {CONTACT_GROUP_ID} from './interfaces';

    @Component
    export default class InfotagView extends Vue {
        @Prop({required: true})
        readonly infotag!: Infotag;
        @Prop({required: true})
        readonly data!: CharacterInfotag;
        readonly contactGroupId = CONTACT_GROUP_ID;

        get contactLink(): string | undefined {
            return formatContactLink(this.infotag, this.data.string!);
        }

        get contactValue(): string {
            return formatContactValue(this.infotag, this.data.string!);
        }

        get value(): string {
            switch(this.infotag.type) {
                case 'text':
                    return this.data.string!;
                case 'number':
                    if(this.infotag.allow_legacy && !this.data.number)
                        return this.data.string !== undefined ? this.data.string : '';
                    return this.data.number!.toPrecision();
            }
            const listitem = <ListItem | undefined>Store.shared.listItems[this.data.list!];
            if(typeof listitem === 'undefined')
                return '';
            return listitem.value;
        }
    }
</script>