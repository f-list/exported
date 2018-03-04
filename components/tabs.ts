import Vue, {CreateElement, VNode} from 'vue';

//tslint:disable-next-line:variable-name
const Tabs = Vue.extend({
    props: ['value', 'tabs'],
    render(this: Vue & {readonly value?: string, tabs: {readonly [key: string]: string}}, createElement: CreateElement): VNode {
        let children: {[key: string]: string | VNode | undefined};
        if(<VNode[] | undefined>this.$slots['default'] !== undefined) {
            children = {};
            this.$slots['default'].forEach((child, i) => {
                if(child.context !== undefined) children[child.key !== undefined ? child.key : i] = child;
            });
        } else children = this.tabs;
        const keys = Object.keys(children);
        if(this.value === undefined || children[this.value] === undefined) this.$emit('input', keys[0]);
        return createElement('ul', {staticClass: 'nav nav-tabs'}, keys.map((key) => createElement('li', {staticClass: 'nav-item'},
            [createElement('a', {
                staticClass: 'nav-link', class: {active: this.value === key}, on: {
                    click: () => {
                        this.$emit('input', key);
                    }
                }
            }, [children[key]!])])));
    }
});

export default Tabs;