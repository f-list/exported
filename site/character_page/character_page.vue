<template>
    <div class="row character-page" id="pageBody">
        <div class="alert alert-info" v-show="loading" style="margin:0 15px">Loading character information.</div>
        <div class="alert alert-danger" v-show="error" style="margin:0 15px">{{error}}</div>
        <div class="col-sm-3 col-md-2" v-if="!loading">
            <sidebar :character="character" @memo="memo" @bookmarked="bookmarked" :oldApi="oldApi"></sidebar>
        </div>
        <div class="col-sm-9 col-md-10 profile-body" v-if="!loading">
            <div id="characterView">
                <div>
                    <div v-if="character.ban_reason" id="headerBanReason" class="alert alert-warning">
                        This character has been banned and is not visible to the public. Reason:
                        <br/> {{ character.ban_reason }}
                        <template v-if="character.timeout"><br/>Timeout expires:
                            <date :time="character.timeout"></date>
                        </template>
                    </div>
                    <div v-if="character.block_reason" id="headerBlocked" class="alert alert-warning">
                        This character has been blocked and is not visible to the public. Reason:
                        <br/> {{ character.block_reason }}
                    </div>
                    <div v-if="character.memo" id="headerCharacterMemo" class="alert alert-info">Memo: {{ character.memo.memo }}</div>
                    <ul class="nav nav-tabs" role="tablist">
                        <li role="presentation" class="active"><a href="#overview" aria-controls="overview" role="tab" data-toggle="tab">Overview</a>
                        </li>
                        <li role="presentation"><a href="#infotags" aria-controls="infotags" role="tab" data-toggle="tab">Info</a></li>
                        <li role="presentation" v-if="!oldApi"><a href="#groups" aria-controls="groups" role="tab" data-toggle="tab">Groups</a>
                        </li>
                        <li role="presentation"><a href="#images" aria-controls="images" role="tab"
                            data-toggle="tab">Images ({{ character.character.image_count }})</a></li>
                        <li v-if="character.settings.guestbook" role="presentation"><a href="#guestbook" aria-controls="guestbook"
                            role="tab" data-toggle="tab">Guestbook</a></li>
                        <li v-if="character.is_self || character.settings.show_friends" role="presentation"><a href="#friends"
                            aria-controls="friends" role="tab" data-toggle="tab">Friends</a></li>
                    </ul>

                    <div class="tab-content">
                        <div role="tabpanel" class="tab-pane active" id="overview" aria-labeledby="overview-tab">
                            <div v-bbcode="character.character.description" class="well"
                                style="border-top:0;border-top-left-radius:0;border-top-right-radius:0;"></div>
                            <character-kinks :character="character" :oldApi="oldApi"></character-kinks>
                        </div>
                        <div role="tabpanel" class="tab-pane" id="infotags" aria-labeledby="infotags-tab">
                            <character-infotags :character="character"></character-infotags>
                        </div>
                        <div role="tabpanel" class="tab-pane" id="groups" aria-labeledby="groups-tab" v-if="!oldApi">
                            <character-groups :character="character" ref="groups"></character-groups>
                        </div>
                        <div role="tabpanel" class="tab-pane" id="images" aria-labeledby="images-tab">
                            <character-images :character="character" ref="images" :use-preview="imagePreview"></character-images>
                        </div>
                        <div v-if="character.settings.guestbook" role="tabpanel" class="tab-pane" id="guestbook"
                            aria-labeledby="guestbook-tab">
                            <character-guestbook :character="character" ref="guestbook"></character-guestbook>
                        </div>
                        <div v-if="character.is_self || character.settings.show_friends" role="tabpanel" class="tab-pane" id="friends"
                            aria-labeledby="friends-tab">
                            <character-friends :character="character" ref="friends"></character-friends>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import {initCollapse, standardParser} from '../../bbcode/standard';
    import * as Utils from '../utils';
    import {methods, Store} from './data_store';
    import {Character, SharedStore} from './interfaces';

    import DateDisplay from '../../components/date_display.vue';
    import FriendsView from './friends.vue';
    import GroupsView from './groups.vue';
    import GuestbookView from './guestbook.vue';
    import ImagesView from './images.vue';
    import InfotagsView from './infotags.vue';
    import CharacterKinksView from './kinks.vue';
    import Sidebar from './sidebar.vue';

    interface ShowableVueTab extends Vue {
        show?(target: Element): void
    }

    @Component({
        components: {
            sidebar: Sidebar,
            date: DateDisplay,
            'character-friends': FriendsView,
            'character-guestbook': GuestbookView,
            'character-groups': GroupsView,
            'character-infotags': InfotagsView,
            'character-images': ImagesView,
            'character-kinks': CharacterKinksView
        }
    })
    export default class CharacterPage extends Vue {
        //tslint:disable:no-null-keyword
        @Prop()
        private readonly name?: string;
        @Prop()
        private readonly characterid?: number;
        @Prop({required: true})
        private readonly authenticated: boolean;
        @Prop()
        readonly oldApi?: true;
        @Prop()
        readonly imagePreview?: true;
        private shared: SharedStore = Store;
        private character: Character | null = null;
        loading = true;
        error = '';

        beforeMount(): void {
            this.shared.authenticated = this.authenticated;
        }

        async mounted(): Promise<void> {
            if(this.character === null) await this._getCharacter();
        }

        beforeDestroy(): void {
            $('a[data-toggle="tab"]').off('shown.bs.tab', (e) => this.switchTabHook(e));
        }

        switchTabHook(evt: JQuery.Event): void {
            const targetId = (<HTMLElement>evt.target).getAttribute('aria-controls')!;
            //tslint:disable-next-line:strict-type-predicates no-unbound-method
            if(typeof this.$refs[targetId] !== 'undefined' && typeof (<ShowableVueTab>this.$refs[targetId]).show === 'function')
                (<ShowableVueTab>this.$refs[targetId]).show!(<Element>evt.target);
        }

        @Watch('name')
        async onCharacterSet(): Promise<void> {
            return this._getCharacter();
        }

        memo(memo: {id: number, memo: string}): void {
            Vue.set(this.character!, 'memo', memo);
        }

        bookmarked(state: boolean): void {
            Vue.set(this.character!, 'bookmarked', state);
        }

        private async _getCharacter(): Promise<void> {
            if(this.name === undefined || this.name.length === 0)
                return;
            try {
                this.loading = true;
                await methods.fieldsGet();
                this.character = await methods.characterData(this.name, this.characterid);
                standardParser.allowInlines = true;
                standardParser.inlines = this.character.character.inlines;
                this.loading = false;
                this.$nextTick(() => {
                    $('a[data-toggle="tab"]').on('shown.bs.tab', (e) => this.switchTabHook(e));
                    initCollapse();
                });
            } catch(e) {
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Failed to load character information.');
            }
        }
    }
</script>