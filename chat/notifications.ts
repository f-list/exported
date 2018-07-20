import core from './core';
import {Conversation, Notifications as Interface} from './interfaces';

const codecs: {[key: string]: string} = {mpeg: 'mp3', wav: 'wav', ogg: 'ogg'};

export default class Notifications implements Interface {
    isInBackground = false;

    protected shouldNotify(conversation: Conversation): boolean {
        return core.characters.ownCharacter.status !== 'dnd' && (this.isInBackground ||
            conversation !== core.conversations.selectedConversation || core.state.settings.alwaysNotify);
    }

    async notify(conversation: Conversation, title: string, body: string, icon: string, sound: string): Promise<void> {
        if(!this.shouldNotify(conversation)) return;
        await this.playSound(sound);
        if(core.state.settings.notifications && (<any>Notification).permission === 'granted') { //tslint:disable-line:no-any
            const notification = new Notification(title, this.getOptions(conversation, body, icon));
            notification.onclick = () => {
                conversation.show();
                window.focus();
                notification.close();
            };
            window.setTimeout(() => {
                notification.close();
            }, 5000);
        }
    }

    getOptions(conversation: Conversation, body: string, icon: string):
        NotificationOptions & {badge: string, silent: boolean, renotify: boolean} {
        const badge = <string>require(`./assets/ic_notification.png`); //tslint:disable-line:no-require-imports
        return {
            body, icon: core.state.settings.showAvatars ? icon : undefined, badge, silent: true,  data: {key: conversation.key},
            tag: conversation.key, renotify: true
        };
    }

    async playSound(sound: string): Promise<void> {
        if(!core.state.settings.playSound) return;
        const audio = <HTMLAudioElement>document.getElementById(`soundplayer-${sound}`);
        audio.volume = 1;
        audio.muted = false;
        return audio.play();
    }

    initSounds(sounds: ReadonlyArray<string>): Promise<void> { //tslint:disable-line:promise-function-async
        const promises = [];
        for(const sound of sounds) {
            const id = `soundplayer-${sound}`;
            if(document.getElementById(id) !== null) continue;
            const audio = document.createElement('audio');
            audio.id = id;
            for(const name in codecs) {
                const src = document.createElement('source');
                src.type = `audio/${name}`;
                //tslint:disable-next-line:no-require-imports
                src.src = <string>require(`./assets/${sound}.${codecs[name]}`);
                audio.appendChild(src);
            }
            document.body.appendChild(audio);
            audio.volume = 0;
            audio.muted = true;
            const promise = audio.play();
            if(promise instanceof Promise)
                promises.push(promise);
        }
        return <any>Promise.all(promises); //tslint:disable-line:no-any
    }

    async requestPermission(): Promise<void> {
        await Notification.requestPermission();
    }
}