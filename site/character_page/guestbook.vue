<template>
    <div class="guestbook">
        <div v-show="loading" class="alert alert-info">Loading guestbook.</div>
        <div class="guestbook-controls">
            <label v-show="canEdit" class="control-label">Unapproved only:
                <input type="checkbox" v-model="unapprovedOnly"/>
            </label>
            <nav>
                <ul class="pager">
                    <li class="previous" v-show="page > 1">
                        <a @click="previousPage">
                            <span aria-hidden="true">&larr;</span>Previous Page
                        </a>
                    </li>
                    <li class="next" v-show="hasNextPage">
                        <a @click="nextPage">
                            Next Page<span aria-hidden="true">&rarr;</span>
                        </a>
                    </li>
                </ul>
            </nav>
        </div>
        <template v-if="!loading">
            <div class="alert alert-info" v-show="posts.length === 0">No guestbook posts.</div>
            <guestbook-post :post="post" :can-edit="canEdit" v-for="post in posts" :key="post.id" @reload="getPage"></guestbook-post>
            <div v-if="authenticated" class="form-horizontal">
                <bbcode-editor v-model="newPost.message" :maxlength="5000" classes="form-control"></bbcode-editor>
                <label class="control-label"
                    for="guestbookPostPrivate">Private(only visible to owner): </label>
                <input type="checkbox"
                    class="form-control"
                    id="guestbookPostPrivate"
                    v-model="newPost.privatePost"/>
                <label class="control-label"
                    for="guestbook-post-character">Character: </label>
                <character-select id="guestbook-post-character" v-model="newPost.character"></character-select>
                <button @click="makePost" class="btn btn-success" :disabled="newPost.posting">Post</button>
            </div>
        </template>
        <div class="guestbook-controls">
            <nav>
                <ul class="pager">
                    <li class="previous" v-show="page > 1">
                        <a @click="previousPage">
                            <span aria-hidden="true">&larr;</span>Previous Page
                        </a>
                    </li>
                    <li class="next" v-show="hasNextPage">
                        <a @click="nextPage">
                            Next Page<span aria-hidden="true">&rarr;</span>
                        </a>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import * as Utils from '../utils';
    import {methods, Store} from './data_store';
    import {Character, GuestbookPost} from './interfaces';

    import GuestbookPostView from './guestbook_post.vue';

    @Component({
        components: {
            'guestbook-post': GuestbookPostView
        }
    })
    export default class GuestbookView extends Vue {
        @Prop({required: true})
        private readonly character: Character;

        loading = true;
        error = '';
        authenticated = Store.authenticated;

        posts: GuestbookPost[] = [];

        private unapprovedOnly = false;
        private page = 1;
        hasNextPage = false;
        canEdit = false;
        private newPost = {
            posting: false,
            privatePost: false,
            character: Utils.Settings.defaultCharacter,
            message: ''
        };

        async nextPage(): Promise<void> {
            this.page += 1;
            return this.getPage();
        }

        async previousPage(): Promise<void> {
            this.page -= 1;
            return this.getPage();
        }

        @Watch('unapprovedOnly')
        async getPage(): Promise<void> {
            try {
                this.loading = true;
                const guestbookState = await methods.guestbookPageGet(this.character.character.id, this.page, this.unapprovedOnly);
                this.posts = guestbookState.posts;
                this.hasNextPage = guestbookState.nextPage;
                this.canEdit = guestbookState.canEdit;
            } catch(e) {
                this.posts = [];
                this.hasNextPage = false;
                this.canEdit = false;
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to load guestbook posts.');
            } finally {
                this.loading = false;
            }
        }

        async makePost(): Promise<void> {
            try {
                this.newPost.posting = true;
                await methods.guestbookPostPost(this.character.character.id, this.newPost.character, this.newPost.message,
                    this.newPost.privatePost);
                this.page = 1;
                await this.getPage();
            } catch(e) {
                Utils.ajaxError(e, 'Unable to post new guestbook post.');
            } finally {
                this.newPost.posting = false;
            }
        }

        async show(): Promise<void> {
            return this.getPage();
        }
    }
</script>