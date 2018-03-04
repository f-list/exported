import Vue from 'vue';

export default abstract class ContextMenu extends Vue {
    //tslint:disable:no-null-keyword
    abstract propName: string;
    showMenu = false;
    private position = {left: 0, top: 0};
    private selectedItem: HTMLElement | null = null;
    private touchTimer = 0;

    abstract itemSelected(element: HTMLElement): void;

    shouldShowMenu(_: HTMLElement): boolean {
        return true;
    }

    hideMenu(): void {
        this.showMenu = false;
        this.selectedItem = null;
    }

    bindOffclick(): void {
        document.body.addEventListener('click', () => this.hideMenu());
    }

    private fixPosition(e: MouseEvent | Touch): void {
        const getMenuPosition = (input: number, direction: string): number => {
            const win = (<Window & {[key: string]: number}>window)[`inner${direction}`];
            const menu = (<HTMLElement & {[key: string]: number}>this.$refs['menu'])[`offset${direction}`];
            let position = input;

            if(input + menu > win)
                position = win - menu - 5;

            return position;
        };

        const left = getMenuPosition(e.clientX, 'Width');
        const top = getMenuPosition(e.clientY, 'Height');
        this.position = {left, top};
    }

    protected innerClick(): void {
        this.itemSelected(this.selectedItem!);
        this.hideMenu();
    }

    outerClick(event: MouseEvent | TouchEvent): void {
        // Provide an opt-out
        if(event.ctrlKey) return;
        if(event.type === 'touchend') window.clearTimeout(this.touchTimer);
        const targetingEvent = event instanceof TouchEvent ? event.touches[0] : event;
        const findTarget = (): HTMLElement | undefined => {
            let element = <HTMLElement>targetingEvent.target;
            while(element !== document.body) {
                if(typeof element.dataset[this.propName] !== 'undefined' || element.parentElement === null) break;
                element = element.parentElement;
            }
            return typeof element.dataset[this.propName] === 'undefined' ? undefined : element;
        };
        const target = findTarget();
        if(target === undefined) {
            this.hideMenu();
            return;
        }
        switch(event.type) {
            case 'click':
            case 'contextmenu':
                this.openMenu(targetingEvent, target);
                break;
            case 'touchstart':
                this.touchTimer = window.setTimeout(() => this.openMenu(targetingEvent, target), 500);
        }
        event.preventDefault();
    }

    private openMenu(event: MouseEvent | Touch, element: HTMLElement): void {
        if(!this.shouldShowMenu(element))
            return;
        this.showMenu = true;
        this.selectedItem = element;
        this.$nextTick(() => {
            this.fixPosition(event);
        });
    }

    get positionText(): string {
        return `left: ${this.position.left}px; top: ${this.position.top}px;`;
    }

}