<template>
    <div class="form-group" :class="allClasses">
        <slot></slot>
        <div :class="classes" v-if="hasErrors">
            <ul>
                <li v-for="error in errorList">{{ error }}</li>
            </ul>
        </div>
    </div>
</template>


<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';

    @Component
    export default class FormErrors extends Vue {
        @Prop({required: true})
        readonly errors: {[key: string]: string[] | undefined};
        @Prop({required: true})
        readonly field: string;
        @Prop({default: 'col-xs-3'})
        readonly classes: string;
        @Prop()
        readonly extraClasses?: {[key: string]: boolean};

        get hasErrors(): boolean {
            return typeof this.errors[this.field] !== 'undefined';
        }

        get errorList(): string[] {
            return this.errors[this.field] !== undefined ? this.errors[this.field]! : [];
        }

        get allClasses(): {[key: string]: boolean} {
            const classes: {[key: string]: boolean} = {'hash-error': this.hasErrors};
            if(this.extraClasses === undefined) return classes;
            for(const key in this.extraClasses)
                classes[key] = this.extraClasses[key];

            return classes;
        }
    }
</script>
