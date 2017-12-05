<template>
    <div id="friendDialog" tabindex="-1" class="modal" ref="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal"
                        aria-label="Close">&times;
                    </button>
                    <h4 class="modal-title">Friends for {{name}}</h4>
                </div>
                <div class="modal-body">
                    <div v-show="loading" class="alert alert-info">Loading friend information.</div>
                    <div v-show="error" class="alert alert-danger">{{error}}</div>
                    <template v-if="!loading">
                        <div v-if="existing.length" class="well">
                            <h4>Existing Friendships</h4>
                            <hr>
                            <div v-for="friend in existing">
                                <character-link :character="request.source"><img class="character-avatar icon"
                                    :src="avatarUrl(request.source.name)"/>
                                    {{request.source.name}}
                                </character-link>
                                Since:
                                <date-display :time="friend.createdAt"></date-display>
                                <button type="button" class="btn btn-danger"
                                    @click="dissolve(friend)">
                                    Remove
                                </button>
                            </div>
                        </div>
                        <div v-if="pending.length" class="well">
                            <h4>Pending Requests To Character</h4>
                            <hr>
                            <div v-for="request in pending">
                                <character-link :character="request.source"><img class="character-avatar icon"
                                    :src="avatarUrl(request.source.name)"/>
                                    {{request.source.name}}
                                </character-link>
                                Sent:
                                <date-display :time="request.createdAt"></date-display>
                                <button type="button" class="btn btn-danger"
                                    @click="cancel(request)">
                                    Cancel
                                </button>
                            </div>
                        </div>
                        <div v-if="incoming.length" class="well">
                            <h4>Pending Requests From Character</h4>
                            <hr>
                            <div v-for="request in incoming">
                                <character-link :character="request.target"><img class="character-avatar icon"
                                    :src="avatarUrl(request.target.name)"/>
                                    {{request.target.name}}
                                </character-link>
                                Sent:
                                <date-display :time="request.createdAt"></date-display>
                                <button type="button" class="btn btn-success acceptFriend"
                                    @click="accept(request)">
                                    Accept
                                </button>
                                <button type="button" class="btn btn-danger ignoreFriend"
                                    @click="ignore(request)">
                                    Ignore
                                </button>
                            </div>
                        </div>
                        <div class="well">
                            <h4>Request Friendship</h4>
                            <hr>
                            <div class="form-inline">
                                <label class="control-label"
                                    for="friendRequestCharacter">Character: </label>
                                <character-select id="friendRequestCharacter" v-model="ourCharacter"></character-select>
                                <button @click="request" class="btn btn-default" :disable="requesting || !ourCharacter">Request</button>
                            </div>
                        </div>
                    </template>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import * as Utils from '../utils';
    import {methods} from './data_store';
    import {Character, Friend, FriendRequest} from './interfaces';

    @Component
    export default class FriendDialog extends Vue {
        @Prop({required: true})
        private readonly character: Character;

        private ourCharacter = Utils.Settings.defaultCharacter;

        private incoming: FriendRequest[] = [];
        private pending: FriendRequest[] = [];
        private existing: Friend[] = [];

        requesting = false;
        loading = true;
        error = '';

        avatarUrl = Utils.avatarURL;

        get name(): string {
            return this.character.character.name;
        }

        async request(): Promise<void> {
            try {
                this.requesting = true;
                const newRequest = await methods.friendRequest(this.character.character.id, this.ourCharacter);
                this.pending.push(newRequest);
            } catch(e) {
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to send friend request');
            }
            this.requesting = false;
        }

        async dissolve(friendship: Friend): Promise<void> {
            try {
                await methods.friendDissolve(friendship.id);
                this.existing = Utils.filterOut(this.existing, 'id', friendship.id);
            } catch(e) {
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to dissolve friendship');
            }
        }

        async accept(request: FriendRequest): Promise<void> {
            try {
                const friend = await methods.friendRequestAccept(request.id);
                this.existing.push(friend);
            } catch(e) {
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to accept friend request');
            }
        }

        async cancel(request: FriendRequest): Promise<void> {
            try {
                await methods.friendRequestCancel(request.id);
                this.pending = Utils.filterOut(this.pending, 'id', request.id);
            } catch(e) {
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to cancel friend request');
            }
        }

        async ignore(request: FriendRequest): Promise<void> {
            try {
                await methods.friendRequestIgnore(request.id);
                this.incoming = Utils.filterOut(this.incoming, 'id', request.id);
            } catch(e) {
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to ignore friend request');
            }
        }

        async show(): Promise<void> {
            $(this.$refs['dialog']).modal('show');
            try {
                this.loading = true;
                const friendData = await methods.characterFriends(this.character.character.id);
                this.incoming = friendData.incoming;
                this.pending = friendData.pending;
                this.existing = friendData.existing;
            } catch(e) {
                Utils.ajaxError(e, 'Unable to load character friendship information');
            }
            this.loading = false;
        }
    }
</script>