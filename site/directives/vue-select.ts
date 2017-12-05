import Vue, {VNodeDirective} from 'vue';
//tslint:disable:strict-boolean-expressions
type Option = { value: string | null, disabled: boolean, text: string, label: string, options: Option[]} | string | number;

function rebuild(e: HTMLElement, binding: VNodeDirective): void {
    const el = <HTMLSelectElement>e;
    if(binding.oldValue === binding.value) return;
    if(!binding.value) console.error('Must provide a value');
    const value = <Option[]>binding.value;

    function _isObject(val: any): val is object { //tslint:disable-line:no-any
        return val !== null && typeof val === 'object';
    }

    function clearOptions(): void {
        let i = el.options.length;
        while(i--) {
            const opt = el.options[i];
            const parent = opt.parentNode!;
            if(parent === el) parent.removeChild(opt);
            else {
                el.removeChild(parent);
                i = el.options.length;
            }
        }
    }

    function buildOptions(parent: HTMLElement, options: Option[]): void {
        let newEl: (HTMLOptionElement & {'_value'?: string | null});
        for(let i = 0, l = options.length; i < l; i++) {
            const op = options[i];
            if(!_isObject(op) || !op.options) {
                newEl = document.createElement('option');
                if(typeof op === 'string' || typeof op === 'number')
                    newEl.text = newEl.value = op as string;
                else {
                    if(op.value !== null && !_isObject(op.value))
                        newEl.value = op.value;
                    newEl['_value'] = op.value;
                    newEl.text = op.text || '';
                    if(op.disabled)
                        newEl.disabled = true;
                }
            } else {
                newEl = document.createElement('optgroup');
                newEl.label = op.label;
                buildOptions(newEl, op.options);
            }
            parent.appendChild(newEl);
        }
    }

    clearOptions();
    buildOptions(el, value);
}

export default Vue.directive('select', {
    inserted: rebuild,
    update: rebuild
});