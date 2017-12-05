<template>
    <div class="infotags">
        <div class="infotag-group" v-for="group in groupedInfotags" :key="group.id">
            <div class="col-xs-2">
                <div class="infotag-title">{{group.name}}</div>
                <hr>
                <infotag :infotag="infotag" v-for="infotag in group.infotags" :key="infotag.id"></infotag>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import * as Utils from '../utils';
    import {Store} from './data_store';
    import {Character, CONTACT_GROUP_ID, DisplayInfotag} from './interfaces';

    import InfotagView from './infotag.vue';

    interface DisplayInfotagGroup {
        name: string
        sortOrder: number
        infotags: DisplayInfotag[]
    }

    @Component({
        components: {
            infotag: InfotagView
        }
    })
    export default class InfotagsView extends Vue {
        @Prop({required: true})
        private readonly character: Character;

        get groupedInfotags(): DisplayInfotagGroup[] {
            const groups = Store.kinks.infotag_groups;
            const infotags = Store.kinks.infotags;
            const characterTags = this.character.character.infotags;
            const outputGroups: DisplayInfotagGroup[] = [];
            const groupedTags = Utils.groupObjectBy(infotags, 'infotag_group');
            for(const groupId in groups) {
                const group = groups[groupId]!;
                const groupedInfotags = groupedTags[groupId];
                if(groupedInfotags === undefined) continue;
                const collectedTags: DisplayInfotag[] = [];
                for(const infotag of groupedInfotags) {
                    const characterInfotag = characterTags[infotag.id];
                    if(typeof characterInfotag === 'undefined')
                        continue;
                    const newInfotag: DisplayInfotag = {
                        id: infotag.id,
                        isContact: infotag.infotag_group === CONTACT_GROUP_ID,
                        string: characterInfotag.string,
                        number: characterInfotag.number,
                        list: characterInfotag.list
                    };
                    collectedTags.push(newInfotag);
                }
                collectedTags.sort((a, b): number => {
                    const infotagA = infotags[a.id]!;
                    const infotagB = infotags[b.id]!;
                    return infotagA.name < infotagB.name ? -1 : 1;
                });
                outputGroups.push({
                    name: group.name,
                    sortOrder: group.sort_order,
                    infotags: collectedTags
                });
            }

            outputGroups.sort((a, b) => a.sortOrder < b.sortOrder ? -1 : 1);

            return outputGroups.filter((a) => a.infotags.length > 0);
        }
    }
</script>