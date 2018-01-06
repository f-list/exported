<template>
    <div class="bbcodeEditorContainer">
        <slot></slot>
        <a tabindex="0" class="btn bbcodeEditorButton bbcode-btn" role="button" @click="showToolbar = true" @blur="showToolbar = false">
            <span class="fa fa-code"></span></a>
        <div class="bbcode-toolbar" role="toolbar" :style="showToolbar ? 'display:block' : ''" @mousedown.stop.prevent>
            <button type="button" class="close" aria-label="Close" style="margin-left:10px" @click="showToolbar = false">&times;</button>
            <div class="bbcodeEditorButton btn" v-for="button in buttons" :title="button.title" @click.prevent.stop="apply(button)">
                <span :class="'fa ' + button.icon"></span>
            </div>
            <div @click="previewBBCode" class="bbcodeEditorButton btn" :class="preview ? 'active' : ''"
                :title="preview ? 'Close Preview' : 'Preview'">
                <span class="fa fa-eye"></span>
            </div>
        </div>
        <div class="bbcodeEditorTextarea">
            <textarea ref="input" v-model="text" @input="onInput" v-show="!preview" :maxlength="maxlength"
                :class="'bbcodeTextAreaTextArea ' + classes" @keyup="onKeyUp" :disabled="disabled" @paste="onPaste"
                :placeholder="placeholder" @keypress="$emit('keypress', $event)" @keydown="onKeyDown"></textarea>
            <div class="bbcodePreviewArea" v-show="preview">
                <div class="bbcodePreviewHeader">
                    <ul class="bbcodePreviewWarnings" v-show="previewWarnings.length">
                        <li v-for="warning in previewWarnings">{{warning}}</li>
                    </ul>
                </div>
                <div class="bbcode" ref="preview-element"></div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from 'vue';
    import Component from 'vue-class-component';
    import {Prop, Watch} from 'vue-property-decorator';
    import {BBCodeElement} from '../chat/bbcode';
    import {getKey} from '../chat/common';
    import {CoreBBCodeParser, urlRegex} from './core';
    import {defaultButtons, EditorButton, EditorSelection} from './editor';
    import {BBCodeParser} from './parser';

    @Component
    export default class Editor extends Vue {
        @Prop()
        readonly extras?: EditorButton[];
        @Prop({default: 1000})
        readonly maxlength: number;
        @Prop()
        readonly classes?: string;
        @Prop()
        readonly value?: string;
        @Prop()
        readonly disabled?: boolean;
        @Prop()
        readonly placeholder?: string;
        preview = false;
        previewWarnings: ReadonlyArray<string> = [];
        previewResult = '';
        text = this.value !== undefined ? this.value : '';
        element: HTMLTextAreaElement;
        maxHeight: number;
        minHeight: number;
        showToolbar = false;
        protected parser: BBCodeParser;
        protected defaultButtons = defaultButtons;
        private isShiftPressed = false;
        private undoStack: string[] = [];
        private undoIndex = 0;
        private lastInput = 0;

        created(): void {
            this.parser = new CoreBBCodeParser();
        }

        mounted(): void {
            this.element = <HTMLTextAreaElement>this.$refs['input'];
            const $element = $(this.element);
            this.maxHeight = parseInt($element.css('max-height'), 10);
            //tslint:disable-next-line:strict-boolean-expressions
            this.minHeight = parseInt($element.css('min-height'), 10) || $element.outerHeight() || 50;
            setInterval(() => {
                if(Date.now() - this.lastInput >= 500 && this.text !== this.undoStack[0] && this.undoIndex === 0) {
                    if(this.undoStack.length >= 30) this.undoStack.pop();
                    this.undoStack.unshift(this.text);
                }
            }, 500);
        }

        get buttons(): EditorButton[] {
            const buttons = this.defaultButtons.slice();
            if(this.extras !== undefined)
                for(let i = 0, l = this.extras.length; i < l; i++)
                    buttons.push(this.extras[i]);
            return buttons;
        }

        @Watch('value')
        watchValue(newValue: string): void {
            this.$nextTick(() => this.resize());
            if(this.text === newValue) return;
            this.text = newValue;
            this.lastInput = 0;
            this.undoIndex = 0;
            this.undoStack = [];
        }

        getSelection(): EditorSelection {
            const length = this.element.selectionEnd - this.element.selectionStart;
            return {
                start: this.element.selectionStart,
                end: this.element.selectionEnd,
                length,
                text: this.element.value.substr(this.element.selectionStart, length)
            };
        }

        replaceSelection(replacement: string): string {
            const selection = this.getSelection();
            const start = this.element.value.substr(0, selection.start) + replacement;
            const end = this.element.value.substr(selection.end);
            this.element.value = start + end;
            this.element.dispatchEvent(new Event('input'));
            return start + end;
        }

        setSelection(start: number, end?: number): void {
            if(end === undefined)
                end = start;
            this.element.focus();
            this.element.setSelectionRange(start, end);
        }

        applyText(startText: string, endText: string): void {
            const selection = this.getSelection();
            if(selection.length > 0) {
                const replacement = startText + selection.text + endText;
                this.text = this.replaceSelection(replacement);
                this.setSelection(selection.start, selection.start + replacement.length);
            } else {
                const start = this.text.substr(0, selection.start) + startText;
                const end = endText + this.text.substr(selection.start);
                this.text = start + end;
                this.$nextTick(() => this.setSelection(start.length));
            }
            this.$emit('input', this.text);
        }

        apply(button: EditorButton): void {
            // Allow emitted variations for custom buttons.
            this.$once('insert', (startText: string, endText: string) => this.applyText(startText, endText));
            if(button.handler !== undefined)
                return <void>button.handler.call(this, this);
            if(button.startText === undefined)
                button.startText = `[${button.tag}]`;
            if(button.endText === undefined)
                button.endText = `[/${button.tag}]`;
            this.applyText(button.startText, button.endText);
            this.lastInput = Date.now();
        }

        onInput(): void {
            if(this.undoIndex > 0) {
                this.undoStack = this.undoStack.slice(this.undoIndex);
                this.undoIndex = 0;
            }
            this.$emit('input', this.text);
            this.lastInput = Date.now();
        }

        onKeyDown(e: KeyboardEvent): void {
            const key = getKey(e);
            if((e.metaKey || e.ctrlKey) && !e.shiftKey && key !== 'control' && key !== 'meta') {
                if(key === 'z') {
                    e.preventDefault();
                    if(this.undoIndex === 0 && this.undoStack[0] !== this.text) this.undoStack.unshift(this.text);
                    if(this.undoStack.length > this.undoIndex + 1) {
                        this.text = this.undoStack[++this.undoIndex];
                        this.lastInput = Date.now();
                    }
                } else if(key === 'y') {
                    e.preventDefault();
                    if(this.undoIndex > 0) {
                        this.text = this.undoStack[--this.undoIndex];
                        this.lastInput = Date.now();
                    }
                }
                for(const button of this.buttons)
                    if(button.key === key) {
                        e.stopPropagation();
                        e.preventDefault();
                        this.apply(button);
                        break;
                    }
            } else if(key === 'shift') this.isShiftPressed = true;
            this.$emit('keydown', e);
        }

        onKeyUp(e: KeyboardEvent): void {
            if(getKey(e) === 'shift') this.isShiftPressed = false;
            this.$emit('keyup', e);
        }

        resize(): void {
            if(this.maxHeight > 0) {
                this.element.style.height = 'auto';
                this.element.style.height = `${Math.max(Math.min(this.element.scrollHeight + 5, this.maxHeight), this.minHeight)}px`;
            }
        }

        onPaste(e: ClipboardEvent): void {
            const data = e.clipboardData.getData('text/plain');
            if(!this.isShiftPressed && urlRegex.test(data)) {
                e.preventDefault();
                this.applyText(`[url=${data}]`, '[/url]');
            }
        }

        focus(): void {
            this.element.focus();
        }

        previewBBCode(): void {
            this.doPreview();
        }

        protected doPreview(): void {
            const targetElement = <HTMLElement>this.$refs['preview-element'];
            if(this.preview) {
                this.preview = false;
                this.previewWarnings = [];
                this.previewResult = '';
                const previewElement = (<BBCodeElement>targetElement.firstChild);
                if(previewElement.cleanup !== undefined) previewElement.cleanup();
                if(targetElement.firstChild !== null) targetElement.removeChild(targetElement.firstChild);
            } else {
                this.preview = true;
                this.parser.storeWarnings = true;
                targetElement.appendChild(this.parser.parseEverything(this.text));
                this.previewWarnings = this.parser.warnings;
                this.parser.storeWarnings = false;
            }
        }
    }
</script>