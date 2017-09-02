<template>
    <modal :action="l('characterSearch.action')" @submit.prevent="submit" :disabled="!data.kinks.length"
        :buttonText="results ? l('characterSearch.again') : undefined" class="character-search">
        <div v-if="options && !results">
            <div v-show="error" class="alert alert-danger">{{error}}</div>
            <filterable-select v-model="data.kinks" :multiple="true" :placeholder="l('filter')"
                :title="l('characterSearch.kinks')" :filterFunc="filterKink" :options="options.kinks">
                <template scope="s">{{s.option.name}}</template>
            </filterable-select>
            <filterable-select v-for="item in ['genders', 'orientations', 'languages', 'furryprefs', 'roles', 'positions']" :multiple="true"
                v-model="data[item]" :placeholder="l('filter')" :title="l('characterSearch.' + item)" :options="options[item]" :key="item">
            </filterable-select>
            <div v-show="!data.kinks.length" class="alert alert-warning">{{l('characterSearch.kinkNotice')}}</div>
        </div>
        <div v-else-if="results">
            <h5>{{l('characterSearch.results')}}</h5>
            <div v-for="character in results">
                <user :character="character"></user>
            </div>
        </div>
    </modal>
</template>

<script lang="ts">
    import Axios from 'axios';
    import Component from 'vue-class-component';
    import CustomDialog from '../components/custom_dialog';
    import FilterableSelect from '../components/FilterableSelect.vue';
    import Modal from '../components/Modal.vue';
    import core from './core';
    import {Character, Connection} from './interfaces';
    import l from './localize';
    import UserView from './user_view';

    type Options = {
        kinks: {id: number, name: string, description: string}[],
        listitems: {id: string, name: string, value: string}[]
    };

    let options: Options | undefined;

    type Kink = {id: number, name: string, description: string};

    @Component({
        components: {modal: Modal, user: UserView, 'filterable-select': FilterableSelect}
    })
    export default class CharacterSearch extends CustomDialog {
        //tslint:disable:no-null-keyword
        l = l;
        kinksFilter = '';
        error = '';
        results: Character[] | null = null;
        options: {
            kinks: Kink[]
            genders: string[]
            orientations: string[]
            languages: string[]
            furryprefs: string[]
            roles: string[]
            positions: string[]
        } | null = null;
        data: {[key: string]: (string | Kink)[]} = {
            kinks: <Kink[]>[],
            genders: <string[]>[],
            orientations: <string[]>[],
            languages: <string[]>[],
            furryprefs: <string[]>[],
            roles: <string[]>[],
            positions: <string[]>[]
        };

        async created(): Promise<void> {
            if(options === undefined)
                options = <Options | undefined>(await Axios.get('https://www.f-list.net/json/api/mapping-list.php')).data;
            if(options === undefined) return;
            this.options = {
                kinks: options.kinks.sort((x, y) => (x.name < y.name ? -1 : (x.name > y.name ? 1 : 0))),
                genders: options.listitems.filter((x) => x.name === 'gender').map((x) => x.value),
                orientations: options.listitems.filter((x) => x.name === 'orientation').map((x) => x.value),
                languages: options.listitems.filter((x) => x.name === 'languagepreference').map((x) => x.value),
                furryprefs: options.listitems.filter((x) => x.name === 'furrypref').map((x) => x.value),
                roles: options.listitems.filter((x) => x.name === 'subdom').map((x) => x.value),
                positions: options.listitems.filter((x) => x.name === 'position').map((x) => x.value)
            };
            this.$nextTick(() => (<Modal>this.$children[0]).fixDropdowns());
        }

        mounted(): void {
            core.connection.onMessage('ERR', (data) => {
                switch(data.number) {
                    case 18:
                        this.error = l('characterSearch.error.noResults');
                        break;
                    case 50:
                        this.error = l('characterSearch.error.throttle');
                        break;
                    case 72:
                        this.error = l('characterSearch.error.tooManyResults');
                }
            });
            core.connection.onMessage('FKS', (data) => this.results = data.characters.map((x: string) => core.characters.get(x)));
        }

        filterKink(filter: RegExp, kink: Kink): boolean {
            if(this.data.kinks.length >= 5)
                return this.data.kinks.indexOf(kink) !== -1;
            return filter.test(kink.name);
        }

        submit(): void {
            if(this.results !== null) {
                this.results = null;
                return;
            }
            this.error = '';
            const data: Connection.ClientCommands['FKS'] & {[key: string]: (string | number)[]} = {kinks: []};
            for(const key in this.data)
                if(this.data[key].length > 0)
                    data[key] = key === 'kinks' ? (<Kink[]>this.data[key]).map((x) => x.id) : (<string[]>this.data[key]);
            core.connection.send('FKS', data);
        }
    }
</script>

<style>
    .character-search .dropdown {
        margin-bottom: 10px;
    }
</style>