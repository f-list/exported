import core from './core';
import {Conversation, Notifications as Interface} from './interfaces';

const codecs: {[key: string]: string} = {mpeg: 'mp3', wav: 'wav', ogg: 'ogg'};

export default class Notifications implements Interface {
    isInBackground = false;

    notify(conversation: Conversation, title: string, body: string, icon: string, sound: string): void {
        if(!this.isInBackground && conversation === core.conversations.selectedConversation && !core.state.settings.alwaysNotify) return;
        this.playSound(sound);
        if(core.state.settings.notifications) {
            /*tslint:disable-next-line:no-object-literal-type-assertion*///false positive
            const notification = new Notification(title, <NotificationOptions & {silent: boolean}>{body, icon, silent: true});
            notification.onclick = () => {
                conversation.show();
                window.focus();
                notification.close();
            };
        }
    }

    playSound(sound: string): void {
        if(!core.state.settings.playSound) return;
        const id = `soundplayer-${sound}`;
        let audio = <HTMLAudioElement | null>document.getElementById(id);
        if(audio === null) {
            audio = document.createElement('audio');
            audio.id = id;
            //tslint:disable-next-line:forin
            for(const name in codecs) {
                const src = document.createElement('source');
                src.type = `audio/${name}`;
                //tslint:disable-next-line:no-require-imports
                src.src = <string>require(`./assets/${sound}.${codecs[name]}`);
                audio.appendChild(src);
            }
        }
        //tslint:disable-next-line:no-floating-promises
        audio.play();
    }
}