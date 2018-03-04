<template>
    <div>
        <ul class="dropdown-menu" role="menu" @click="innerClick($event)" @touchstart="innerClick($event)" @touchend="innerClick($event)"
            style="position: fixed; display: block;" :style="positionText" ref="menu" v-show="showMenu">
            <li><a class="dropdown-item" href="#">Copy Custom</a></li>
        </ul>
        <copy-dialog ref="copy-dialog"></copy-dialog>
    </div>
</template>

<script lang="ts">
    import Component from 'vue-class-component';
    import {Prop} from 'vue-property-decorator';
    import ContextMenu from './context_menu';
    import CopyCustomDialog from './copy_custom_dialog.vue';

    @Component({
        components: {
            'copy-dialog': CopyCustomDialog
        }
    })
    export default class CopyCustomMenu extends ContextMenu {
        @Prop({required: true})
        readonly propName!: string;

        itemSelected(element: HTMLElement): void {
            const getName = (children: ReadonlyArray<HTMLElement>): string => {
                for(const child of children)
                    if(child.className === 'kink-name')
                        return child.textContent!;
                return 'Unknown';
            };
            const name = getName(<any>element.children); //tslint:disable-line:no-any
            const description = element.title;
            (<CopyCustomDialog>this.$refs['copy-dialog']).showDialog(name, description);
        }

        mounted(): void {
            this.bindOffclick();
        }
    }
</script>