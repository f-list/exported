<template>
    <div class="character-images">
        <div v-show="loading" class="alert alert-info">Loading images.</div>
        <template v-if="!loading">
            <div class="character-image" v-for="image in images" :key="image.id">
                <a :href="imageUrl(image)" target="_blank">
                    <img :src="thumbUrl(image)" :title="image.description">
                </a>
            </div>
        </template>
        <div v-if="!loading && !images.length" class="alert alert-info">No images.</div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import * as Utils from '../utils';
    import {methods} from './data_store';
    import {Character, CharacterImage} from './interfaces';

    @Component
    export default class ImagesView extends Vue {
        @Prop({required: true})
        private readonly character: Character;
        private shown = false;
        images: CharacterImage[] = [];
        loading = true;
        error = '';

        imageUrl = (image: CharacterImage) => methods.imageUrl(image);
        thumbUrl = (image: CharacterImage) => methods.imageThumbUrl(image);

        async show(): Promise<void> {
            if(this.shown) return;
            try {
                this.error = '';
                this.shown = true;
                this.loading = true;
                this.images = await methods.imagesGet(this.character.character.id);
            } catch(e) {
                this.shown = false;
                if(Utils.isJSONError(e))
                    this.error = <string>e.response.data.error;
                Utils.ajaxError(e, 'Unable to load images.');
            }
            this.loading = false;
        }
    }
</script>