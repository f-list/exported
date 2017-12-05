import Axios from 'axios';
import Vue from 'vue';
import {InlineDisplayMode} from '../bbcode/interfaces';
import {initParser, standardParser} from '../bbcode/standard';
import {registerMethod, Store} from '../site/character_page/data_store';
import {
    Character, CharacterCustom, CharacterFriend, CharacterImage, CharacterImageOld, CharacterInfo, CharacterInfotag, CharacterSettings,
    GuestbookState, KinkChoiceFull, SharedKinks
} from '../site/character_page/interfaces';
import '../site/directives/vue-select'; //tslint:disable-line:no-import-side-effect
import * as Utils from '../site/utils';
import core from './core';

async function characterData(name: string | undefined): Promise<Character> {
    const data = await core.connection.queryApi('character-data.php', {name}) as CharacterInfo & {
        badges: string[]
        customs_first: boolean
        custom_kinks: {[key: number]: {choice: 'fave' | 'yes' | 'maybe' | 'no', name: string, description: string, children: number[]}}
        custom_title: string
        infotags: {[key: string]: string}
        settings: CharacterSettings
    };
    const newKinks: {[key: string]: KinkChoiceFull} = {};
    for(const key in data.kinks)
        newKinks[key] = <KinkChoiceFull>(data.kinks[key] === 'fave' ? 'favorite' : data.kinks[key]);
    const newCustoms: CharacterCustom[] = [];
    for(const key in data.custom_kinks) {
        const custom = data.custom_kinks[key];
        newCustoms.push({
            id: parseInt(key, 10),
            choice: custom.choice === 'fave' ? 'favorite' : custom.choice,
            name: custom.name,
            description: custom.description
        });
        for(const childId of custom.children)
            if(data.kinks[childId] !== undefined)
                newKinks[childId] = parseInt(key, 10);
    }
    const newInfotags: {[key: string]: CharacterInfotag} = {};
    for(const key in data.infotags) {
        const characterInfotag = data.infotags[key];
        const infotag = Store.kinks.infotags[key];
        if(infotag === undefined) continue;

        newInfotags[key] = infotag.type === 'list' ? {list: parseInt(characterInfotag, 10)} : {string: characterInfotag};
    }
    return {
        is_self: false,
        character: {
            id: data.id,
            name: data.name,
            title: data.custom_title,
            description: data.description,
            created_at: data.created_at,
            updated_at: data.updated_at,
            views: data.views,
            image_count: data.images!.length,
            inlines: data.inlines,
            kinks: newKinks,
            customs: newCustoms,
            infotags: newInfotags,
            online_chat: false
        },
        badges: data.badges,
        settings: data.settings,
        bookmarked: false,
        self_staff: false
    };
}

function contactMethodIconUrl(name: string): string {
    return `${Utils.staticDomain}images/social/${name}.png`;
}

async function fieldsGet(): Promise<void> {
    if(Store.kinks !== undefined) return; //tslint:disable-line:strict-type-predicates
    try {
        const fields = (await(Axios.get(`${Utils.siteDomain}json/api/mapping-list.php`))).data as SharedKinks & {
            kinks: {[key: string]: {group_id: number}}
            infotags: {[key: string]: {list: string, group_id: string}}
        };
        const kinks: SharedKinks = {kinks: {}, kink_groups: {}, infotags: {}, infotag_groups: {}, listitems: {}};
        for(const id in fields.kinks) {
            const oldKink = fields.kinks[id];
            kinks.kinks[oldKink.id] = {
                id: oldKink.id,
                name: oldKink.name,
                description: oldKink.description,
                kink_group: oldKink.group_id
            };
        }
        for(const id in fields.kink_groups) {
            const oldGroup = fields.kink_groups[id]!;
            kinks.kink_groups[oldGroup.id] = {
                id: oldGroup.id,
                name: oldGroup.name,
                description: '',
                sort_order: oldGroup.id
            };
        }
        for(const id in fields.infotags) {
            const oldInfotag = fields.infotags[id];
            kinks.infotags[oldInfotag.id] = {
                id: oldInfotag.id,
                name: oldInfotag.name,
                type: oldInfotag.type,
                validator: oldInfotag.list,
                search_field: '',
                allow_legacy: true,
                infotag_group: parseInt(oldInfotag.group_id, 10)
            };
        }
        for(const id in fields.listitems) {
            const oldListItem = fields.listitems[id]!;
            kinks.listitems[oldListItem.id] = {
                id: oldListItem.id,
                name: oldListItem.name,
                value: oldListItem.value,
                sort_order: oldListItem.id
            };
        }
        for(const id in fields.infotag_groups) {
            const oldGroup = fields.infotag_groups[id]!;
            kinks.infotag_groups[oldGroup.id] = {
                id: oldGroup.id,
                name: oldGroup.name,
                description: oldGroup.description,
                sort_order: oldGroup.id
            };
        }
        Store.kinks = kinks;
    } catch(e) {
        Utils.ajaxError(e, 'Error loading character fields');
        throw e;
    }
}

async function friendsGet(id: number): Promise<CharacterFriend[]> {
    return (await core.connection.queryApi<{friends: CharacterFriend[]}>('character-friends.php', {id})).friends;
}

async function imagesGet(id: number): Promise<CharacterImage[]> {
    return (await core.connection.queryApi<{images: CharacterImage[]}>('character-images.php', {id})).images;
}

async function guestbookGet(id: number, page: number): Promise<GuestbookState> {
    return core.connection.queryApi<GuestbookState>('character-guestbook.php', {id, page: page - 1});
}

export function init(): void {
    Utils.setDomains('https://www.f-list.net/', 'https://static.f-list.net/');
    initParser({
        siteDomain: Utils.siteDomain,
        staticDomain: Utils.staticDomain,
        animatedIcons: false,
        inlineDisplayMode: InlineDisplayMode.DISPLAY_ALL
    });

    Vue.directive('bbcode', (el, binding) => {
        while(el.firstChild !== null)
            el.removeChild(el.firstChild);
        el.appendChild(standardParser.parseEverything(<string>binding.value));
    });
    registerMethod('characterData', characterData);
    registerMethod('contactMethodIconUrl', contactMethodIconUrl);
    registerMethod('fieldsGet', fieldsGet);
    registerMethod('friendsGet', friendsGet);
    registerMethod('imagesGet', imagesGet);
    registerMethod('guestbookPageGet', guestbookGet);
    registerMethod('imageUrl', (image: CharacterImageOld) => image.url);
    registerMethod('imageThumbUrl', (image: CharacterImage) => `${Utils.staticDomain}images/charthumb/${image.id}.${image.extension}`);
}