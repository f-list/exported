import * as electron from 'electron';
import l from '../chat/localize';

export function createContextMenu(props: Electron.ContextMenuParams & {editFlags: {[key: string]: boolean}}):
        Electron.MenuItemConstructorOptions[] {
    const hasText = props.selectionText.trim().length > 0;
    const can = (type: string) => props.editFlags[`can${type}`] && hasText;

    const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
    if(hasText || props.isEditable)
        menuTemplate.push({
            id: 'copy',
            label: l('action.copy'),
            role: can('Copy') ? 'copy' : '',
            enabled: can('Copy')
        });
    if(props.isEditable)
        menuTemplate.push({
            id: 'cut',
            label: l('action.cut'),
            role: can('Cut') ? 'cut' : '',
            enabled: can('Cut')
        }, {
            id: 'paste',
            label: l('action.paste'),
            role: props.editFlags.canPaste ? 'paste' : '',
            enabled: props.editFlags.canPaste
        });
    else if(props.linkURL.length > 0 && props.mediaType === 'none' && props.linkURL.substr(0, props.pageURL.length) !== props.pageURL)
        menuTemplate.push({
            id: 'copyLink',
            label: l('action.copyLink'),
            click(): void {
                if(process.platform === 'darwin')
                    electron.clipboard.writeBookmark(props.linkText, props.linkURL);
                else
                    electron.clipboard.writeText(props.linkURL);
            }
        });
    return menuTemplate;
}

export function createAppMenu(): Electron.MenuItemConstructorOptions[] {
    const viewItem = {
        label: l('action.view'),
        submenu: [
            {role: 'resetzoom'},
            {role: 'zoomin'},
            {role: 'zoomout'},
            {type: 'separator'},
            {role: 'togglefullscreen'}
        ]
    };
    const menu: Electron.MenuItemConstructorOptions[] = [
        {
            label: l('title')
        }, {
            label: l('action.edit'),
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                {role: 'selectall'}
            ]
        }, viewItem, {
            role: 'help',
            submenu: [
                {
                    label: l('help.fchat'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/F-Chat_3.0')
                },
                {
                    label: l('help.rules'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/Rules')
                },
                {
                    label: l('help.faq'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/Frequently_Asked_Questions')
                },
                {
                    label: l('help.report'),
                    click: () => electron.shell.openExternal('https://wiki.f-list.net/How_to_Report_a_User#In_chat')
                },
                {label: l('version', electron.remote.app.getVersion()), enabled: false}
            ]
        }
    ];
    if(process.env.NODE_ENV !== 'production')
        viewItem.submenu.unshift({role: 'reload'}, {role: 'forcereload'}, {role: 'toggledevtools'}, {type: 'separator'});
    return menu;
}