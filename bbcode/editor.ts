import Vue from 'vue';

export interface EditorButton {
    title: string;
    tag: string;
    icon: string;
    key?: string;
    class?: string;
    startText?: string;
    endText?: string;
    handler?(vm: Vue): void;
}

export interface EditorSelection {
    start: number;
    end: number;
    length: number;
    text: string;
}
/*tslint:disable:max-line-length*/
export let defaultButtons: ReadonlyArray<EditorButton> = [
    {
        title: 'Bold (Ctrl+B)\n\nMakes text appear with a bold weight.',
        tag: 'b',
        icon: 'fa-bold',
        key: 'b'
    },
    {
        title: 'Italic (Ctrl+I)\n\nMakes text appear with an italic style.',
        tag: 'i',
        icon: 'fa-italic',
        key: 'i'
    },
    {
        title: 'Underline (Ctrl+U)\n\nMakes text appear with an underline beneath it.',
        tag: 'u',
        icon: 'fa-underline',
        key: 'u'
    },
    {
        title: 'Strikethrough (Ctrl+S)\n\nPlaces a horizontal line through the text. Usually used to signify a correction or redaction without omitting the text.',
        tag: 's',
        icon: 'fa-strikethrough',
        key: 's'
    },
    {
        title: 'Color (Ctrl+Q)\n\nStyles text with a color. Valid colors are: red, orange, yellow, green, cyan, blue, purple, pink, black, white, gray, primary, secondary, accent, and contrast.',
        tag: 'color',
        startText: '[color=]',
        icon: 'fa-eyedropper',
        key: 'd'
    },
    {
        title: 'Superscript (Ctrl+↑)\n\nLifts text above the text baseline. Makes text slightly smaller. Cannot be nested.',
        tag: 'sup',
        icon: 'fa-superscript',
        key: 'ArrowUp'
    },
    {
        title: 'Subscript (Ctrl+↓)\n\nPushes text below the text baseline. Makes text slightly smaller. Cannot be nested.',
        tag: 'sub',
        icon: 'fa-subscript',
        key: 'ArrowDown'
    },
    {
        title: 'URL (Ctrl+L)\n\nCreates a clickable link to another page of your choosing.',
        tag: 'url',
        startText: '[url=]',
        icon: 'fa-link',
        key: 'l'
    },
    {
        title: 'User (Ctrl+R)\n\nLinks to a character\'s profile.',
        tag: 'user',
        icon: 'fa-user',
        key: 'r'
    },
    {
        title: 'Icon (Ctrl+O)\n\nShows a character\'s profile image, linking to their profile.',
        tag: 'icon',
        icon: 'fa-user-circle',
        key: 'o'
    },
    {
        title: 'EIcon (Ctrl+E)\n\nShows a previously uploaded eicon. If the icon is a gif, it will be shown as animated unless a user has turned this off.',
        tag: 'eicon',
        icon: 'fa-smile-o',
        key: 'e'
    },
    {
        title: 'Noparse (Ctrl+N)\n\nAll BBCode placed within this tag will be ignored and treated as text. Great for sharing structure without it being rendered.',
        tag: 'noparse',
        icon: 'fa-ban',
        key: 'n'
    }
];