import Vue from 'vue';

export type flashMessageType = 'info' | 'success' | 'warning' | 'danger';
let boundHandler;

interface FlashComponent extends Vue {
    lastId: number
    floating: boolean
    messages: {
        id: number
        message: string
        classes: string
    }[]
    removeMessage(id: number)
}

export function addFlashMessage(type: flashMessageType, message: string): void {
    instance.addMessage(type, message);
}

function bindEventHandler(vm): void {
    boundHandler = eventHandler.bind(vm);
    document.addEventListener('scroll', boundHandler);
    document.addEventListener('resize', boundHandler);
}

function removeHandlers(): void {
    document.removeEventListener('scroll', boundHandler);
    document.removeEventListener('resize', boundHandler);
    boundHandler = undefined;
}

function eventHandler(this: FlashComponent): void {
    const isElementVisible = (el: Element): boolean => {
        const rect = el.getBoundingClientRect();
        const vHeight = window.innerWidth || document.documentElement.clientHeight;
        const vWidth = window.innerWidth || document.documentElement.clientWidth;
        const efp = (x, y) => document.elementFromPoint(x, y);
        if(rect.top > vHeight || rect.bottom < 0 || rect.left > vWidth || rect.right < 0)
            return false;
        return true;
        //return (el.contains(efp(rect.left, rect.top)) || el.contains(efp(rect.right, rect.top)));
    };

    this.floating = !isElementVisible(this.$refs['detector'] as Element);
}

function addMessage(this: FlashComponent, type: flashMessageType, message: string): void {
    if(!boundHandler) {
        bindEventHandler(this);
        boundHandler();
    }
    const newId = this.lastId++;
    this.messages.push({id: newId, message, classes: `flash-message alert-${type}`});
    setTimeout(() => {
        this.removeMessage(newId);
    }, 15000);
}

function removeMessage(id: number): void {
    this.messages = this.messages.filter(function(item) {
        return item['id'] !== id;
    });

    if(this.messages.length === 0)
        removeHandlers();
}

interface FlashMessageManager {
    addMessage(type: flashMessageType, message: string): void
    removeMessage(id: number): void
}

const instance: Vue & FlashMessageManager = new Vue({
    template: '#flashMessagesTemplate',
    el: '#flashMessages',
    data() {
        return {
            lastId: 1,
            messages: [],
            floating: false
        };
    },
    computed: {
        containerClasses(this: FlashComponent): string {
            return this.floating ? 'flash-messages-fixed' : 'flash-messages';
        }
    },
    methods: {
        addMessage,
        removeMessage
    }
}) as Vue & FlashMessageManager;