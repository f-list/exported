<template>
    <select class="form-control" :value="value" @change="emit">
        <option v-for="o in characters" :value="o.value" v-once>{{o.text}}</option>
        <slot></slot>
    </select>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import {getCharacters} from './character_select/character_list';

    interface SelectItem {
        value: number
        text: string
    }

    @Component
    export default class CharacterSelect extends Vue {
        @Prop({required: true})
        readonly value!: number;

        get characters(): SelectItem[] {
            const characterList = getCharacters();
            const characters: SelectItem[] = [];
            for(const character of characterList)
                characters.push({value: character.id, text: character.name});
            return characters;
        }

        emit(evt: Event): void {
            this.$emit('input', parseInt((<HTMLSelectElement>evt.target).value, 10));
        }
    }
</script>