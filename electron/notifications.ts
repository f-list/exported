import {remote} from 'electron';
import core from '../chat/core';
import {Conversation} from '../chat/interfaces';
//tslint:disable-next-line:match-default-export-name
import BaseNotifications from '../chat/notifications';

export default class Notifications extends BaseNotifications {
    notify(conversation: Conversation, title: string, body: string, icon: string, sound: string): void {
        if(!this.isInBackground && conversation === core.conversations.selectedConversation && !core.state.settings.alwaysNotify) return;
        this.playSound(sound);
        remote.getCurrentWindow().flashFrame(true);
        if(core.state.settings.notifications) {
            /*tslint:disable-next-line:no-object-literal-type-assertion*///false positive
            const notification = new Notification(title, <NotificationOptions & {silent: boolean}>{
                body,
                icon: core.state.settings.showAvatars ? icon : undefined,
                silent: true
            });
            notification.onclick = () => {
                conversation.show();
                remote.getCurrentWindow().focus();
                notification.close();
            };
        }
    }
}