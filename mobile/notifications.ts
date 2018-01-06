import core from '../chat/core';
import {Conversation} from '../chat/interfaces';
import BaseNotifications from '../chat/notifications'; //tslint:disable-line:match-default-export-name

declare global {
    const NativeNotification: {
        notify(notify: boolean, title: string, text: string, icon: string, sound: string | undefined, data: string): void
        requestPermission(): void
    };
}

document.addEventListener('notification-clicked', (e: Event) => {
    const conv = core.conversations.byKey((<Event & {detail: {data: string}}>e).detail.data);
    if(conv !== undefined) conv.show();
});

export default class Notifications extends BaseNotifications {
    notify(conversation: Conversation, title: string, body: string, icon: string, sound: string): void {
        if(!this.isInBackground && conversation === core.conversations.selectedConversation && !core.state.settings.alwaysNotify) return;
        NativeNotification.notify(core.state.settings.notifications && this.isInBackground, title, body, icon,
            core.state.settings.playSound ? sound : undefined, conversation.key);
    }

    async requestPermission(): Promise<void> {
        NativeNotification.requestPermission();
    }
}