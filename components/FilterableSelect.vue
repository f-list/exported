<template>
    <div class="dropdown filterable-select">
        <button class="btn btn-default dropdown-toggle" :class="buttonClass" data-toggle="dropdown">
            <span style="flex:1">
                <template v-if="multiple">{{label}}</template>
                <slot v-else :option="selected">{{label}}</slot>
            </span>
            <span class="caret" style="align-self:center;margin-left:5px"></span>
        </button>
        <div class="dropdown-menu filterable-select" @click.stop>
            <div style="padding:10px;">
                <input v-model="filter" class="form-control" :placeholder="placeholder"/>
            </div>
            <ul class="dropdown-menu">
                <template v-if="multiple">
                    <li v-for="option in filtered">
                        <a href="#" @click.stop="select(option)">
                            <input type="checkbox" :checked="selected.indexOf(option) !== -1"/>
                            <slot :option="option">{{option}}</slot>
                        </a>
                    </li>
                </template>
                <template v-else>
                    <li v-for="option in filtered">
                        <a href="#" @click="select(option)">
                            <slot :option="option">{{option}}</slot>
                        </a>
                    </li>
                </template>
            </ul>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';

    @Component
    export default class FilterableSelect extends Vue {
        //tslint:disable:no-null-keyword
        @Prop()
        readonly placeholder?: string;
        @Prop({required: true})
        readonly options: object[];
        @Prop({default: () => ((filter: RegExp, value: string) => filter.test(value))})
        readonly filterFunc: (filter: RegExp, value: object) => boolean;
        @Prop()
        readonly multiple?: true;
        @Prop()
        readonly value?: object | object[];
        @Prop()
        readonly title?: string;
        @Prop()
        readonly buttonClass?: string;
        filter = '';
        selected: object | object[] | null = this.value !== undefined ? this.value : (this.multiple !== undefined ? [] : null);

        @Watch('value')
        watchValue(newValue: object | object[] | null): void {
            this.selected = newValue;
        }

        select(item: object): void {
            if(this.multiple !== undefined) {
                const selected = <object[]>this.selected;
                const index = selected.indexOf(item);
                if(index === -1) selected.push(item);
                else selected.splice(index, 1);
            } else {
                this.selected = item;
                $('.dropdown-toggle', this.$el).dropdown('toggle');
            }
            this.$emit('input', this.selected);
        }

        get filtered(): object[] {
            return this.options.filter((x) => this.filterFunc(this.filterRegex, x));
        }

        get label(): string | undefined {
            return this.multiple !== undefined ? `${this.title} - ${(<object[]>this.selected).length}` :
                (this.selected !== null ? this.selected.toString() : this.title);
        }

        get filterRegex(): RegExp {
            return new RegExp(this.filter.replace(/[^\w]/gi, '\\$&'), 'i');
        }
    }
</script>

<style lang="less">
    .filterable-select {
        ul.dropdown-menu {
            padding: 0;
            max-height: 200px;
            overflow-y: auto;
            position: static;
            display: block;
            border: 0;
            box-shadow: none;
            width: 100%;
        }
        button {
            display: flex;
            text-align: left
        }

        input[type=checkbox] {
            vertical-align: text-bottom;
            margin-right: 5px;
        }
    }
</style>