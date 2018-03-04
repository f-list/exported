<template>
    <div class="dropdown">
        <button class="btn btn-secondary dropdown-toggle" aria-haspopup="true" :aria-expanded="isOpen" @click="isOpen = true"
            @blur="isOpen = false" style="width:100%;text-align:left;display:flex;align-items:center">
            <div style="flex:1">
                <slot name="title" style="flex:1"></slot>
            </div>
        </button>
        <div class="dropdown-menu" :style="isOpen ? 'display:block' : ''" @mousedown.stop.prevent @click="isOpen = false">
            <slot></slot>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';

    @Component
    export default class Dropdown extends Vue {
        isOpen = false;
    }
</script>