<template>
    <span class="localizable-date" :title="secondary">{{primary}}</span>
</template>

<script lang="ts">
    import {distanceInWordsToNow, format} from 'date-fns';
    import Vue, {ComponentOptions} from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import {Settings} from '../site/utils';

    @Component
    export default class DateDisplay extends Vue {
        @Prop({required: true})
        readonly time: string | null | number;
        primary: string;
        secondary: string;

        constructor(options?: ComponentOptions<Vue>) {
            super(options);
            if(this.time === null || this.time === 0)
                return;
            const date = isNaN(+this.time) ? new Date(`${this.time}+00:00`) : new Date(+this.time * 1000);
            const absolute = format(date, 'YYYY-MM-DD HH:mm');
            const relative = distanceInWordsToNow(date, {addSuffix: true});
            if(Settings.fuzzyDates) {
                this.primary = relative;
                this.secondary = absolute;
            } else {
                this.primary = absolute;
                this.secondary = relative;
            }
        }
    }
</script>