import core from '../chat/core';
import {Conversation} from '../chat/interfaces';
import BaseNotifications from '../chat/notifications'; //tslint:disable-line:match-default-export-name

//tslint:disable
declare global {
    interface Options {
        id?: number
        title?: string
        text?: string
        every?: string
        at?: Date | null
        badge?: number
        sound?: string
        data?: any
        icon?: string
        smallIcon?: string
        ongoing?: boolean
        led?: string
    }

    interface CordovaPlugins {
        notification: {
            local: {
                getDefaults(): Options
                setDefaults(options: Options): void
                schedule(notification: Options, callback?: Function, scope?: Object, args?: {skipPermissions: boolean}): void
                update(notification: Options, callback?: Function, scope?: Object, args?: {skipPermissions: boolean}): void
                clear(ids: string, callback?: Function, scope?: Object): void
                clearAll(callback?: Function, scope?: Object): void
                cancel(ids: string, callback?: Function, scope?: Object): void
                cancelAll(callback?: Function, scope?: Object): void
                isPresent(id: string, callback?: Function, scope?: Object): void
                isTriggered(id: string, callback?: Function, scope?: Object): void
                getAllIds(callback?: Function, scope?: Object): void
                getScheduledIds(callback?: Function, scope?: Object): void
                getTriggeredIds(callback?: Function, scope?: Object): void
                get(ids?: number[], callback?: Function, scope?: Object): void
                getScheduled(ids?: number[], callback?: Function, scope?: Object): void
                getTriggered(ids?: number[], callback?: Function, scope?: Object): void
                hasPermission(callback?: Function, scope?: Object): void
                registerPermission(callback?: Function, scope?: Object): void
                on(event: 'schedule' | 'update' | 'click' | 'trigger', handler: (notification: Options) => void): void
                un(event: 'schedule' | 'update' | 'click' | 'trigger', handler: (notification: Options) => void): void
            }
        }
    }
}
//tslint:enable
document.addEventListener('deviceready', () => {
    cordova.plugins.notification.local.on('click', (notification) => {
        const conv = core.conversations.byKey((<{conversation: string}>notification.data).conversation);
        if(conv !== undefined) conv.show();
    });
});

export default class Notifications extends BaseNotifications {
    notify(conversation: Conversation, title: string, body: string, icon: string, sound: string): void {
        if(!this.isInBackground && conversation === core.conversations.selectedConversation && !core.state.settings.alwaysNotify) return;
        this.playSound(sound);
        if(core.state.settings.notifications)
            cordova.plugins.notification.local.schedule({
                title, text: body, sound, icon, smallIcon: icon, data: {conversation: conversation.key}
            });
    }
}