<template>
    <div class="guestbook">
        <div v-show="loading" class="alert alert-info">Loading guestbook.</div>
        <div class="guestbook-controls">
            <label v-show="canEdit" class="control-label">Unapproved only:
                <input type="checkbox" v-model="unapprovedOnly"/>
            </label>
            <simple-pager :next="hasNextPage" :prev="page > 1" @next="++page" @prev="--page"></simple-pager>
        </div>
        <template v-if="!loading">
            <div class="alert alert-info" v-show="posts.length === 0">No guestbook posts.</div>
            <guestbook-post :character="character" :post="post" :can-edit="canEdit" v-for="post in posts" :key="post.id"
                @reload="getPage"></guestbook-post>
            <div v-if="authenticated && !oldApi" class="form-horizontal">
                <bbcode-editor v-model="newPost.message" :maxlength="5000" classes="form-control"></bbcode-editor>
                <input type="checkbox" id="guestbookPostPrivate" v-model="newPost.privatePost"/>
                <label class="control-label" for="guestbookPostPrivate">Private(only visible to owner)</label><br/>
                <label class="control-label" for="guestbook-post-character">Character: </label>
                <character-select id="guestbook-post-character" v-model="newPost.character"></character-select>
                <button @click="makePost" class="btn btn-success" :disabled="newPost.posting">Post</button>
            </div>
        </template>
        <div class="guestbook-controls">
            <simple-pager :next="hasNextPage" :prev="page > 1" @next="++page" @prev="--page"></simple-pager>
        </div>
    </div>
</template>

<script lang="ts">
    import {Component, Prop, Watch} from '@f-list/vue-ts';
    import Vue from 'vue';
    import * as Utils from '../utils';
    import {methods, Store} from './data_store';
    import {Character, GuestbookPost} from './interfaces';

    import GuestbookPostView from './guestbook_post.vue';

    @Component({
        components: {'guestbook-post': GuestbookPostView}
    })
    export default class GuestbookView extends Vue {
        @Prop({required: true})
        readonly character!: Character;
        @Prop
        readonly oldApi?: true;
        loading = true;
        error = '';
        authenticated = Store.authenticated;
        posts: GuestbookPost[] = [];
        unapprovedOnly = false;
        page = 1;
        hasNextPage = false;
        canEdit = false;
        newPost = {
            posting: false,
            privatePost: false,
            character: Utils.settings.defaultCharacter,
            message: ''
        };

        @Watch('unapprovedOnly')
        @Watch('page')
        async getPage(): Promise<void> {
            try {
                this.loading = true;
                const guestbook = await methods.guestbookPageGet(this.character.character.id, (this.page - 1) * 10, 10, this.unapprovedOnly);
                this.posts = guestbook.posts;
                this.hasNextPage = (this.page + 1) * 10 < guestbook.total;
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