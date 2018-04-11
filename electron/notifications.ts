import {remote} from 'electron';
import core from '../chat/core';
import {Conversation} from '../chat/interfaces';
//tslint:disable-next-line:match-default-export-name
import BaseNotifications from '../chat/notifications';

const browserWindow = remote.getCurrentWindow();

export default class Notifications extends BaseNotifications {
    notify(conversation: Conversation, title: string, body: string, icon: string, sound: string): void {
        if(!this.shouldNotify(conversation)) return;
        this.playSound(sound);
        browserWindow.flashFrame(true);
        if(core.state.settings.notifications) {
            /*tslint:disable-next-line:no-object-literal-type-assertion*///false positive
            const notification = new Notification(title, <NotificationOptions & {silent: boolean}>{
                body,
                icon: core.state.settings.showAvatars ? icon : undefined,
                silent: true
            });
            notification.onclick = () => {
                browserWindow.webContents.send('show-tab', remote.getCurrentWebContents().id);
                conversation.show();
                browserWindow.focus();
                notification.close();
            };
        }
    }
}