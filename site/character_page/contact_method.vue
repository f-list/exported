<template>
    <div class="contact-method" :title="altText">
        <span v-if="contactLink" class="contact-link">
            <a :href="contactLink" target="_blank" rel="nofollow noreferrer noopener">
                <img :src="iconUrl"><span class="contact-value">{{value}}</span>
            </a>
        </span>
        <span v-else>
            <img :src="iconUrl"><span class="contact-value">{{value}}</span>
        </span>
    </div>
</template>

<script lang="ts">
    import {Component, Prop} from '@f-list/vue-ts';
    import Vue from 'vue';
    import {formatContactLink, formatContactValue} from './contact_utils';
    import {methods, Store} from './data_store';

    interface DisplayContactMethod {
        id: number
        value: string
    }

    @Component
    export default class ContactMethodView extends Vue {
        @Prop({required: true})
        private readonly method!: DisplayContactMethod;

        get iconUrl(): string {
            const infotag = Store.kinks.infotags[this.method.id];
            if(typeof infotag === 'undefined')
                return 'Unknown Infotag';
            return methods.contactMethodIconUrl(infotag.name);
        }

        get value(): string {
            return formatContactValue(this.method.id, this.method.value);
        }

        get altText(): string {
            const infotag = Store.kinks.infotags[this.method.id];
            if(typeof infotag === 'undefined')
                return '';
            return infotag.name;
        }

        get contactLink(): string | undefined {
            return formatContactLink(this.method.id, this.method.value);
        }
    }
</script>