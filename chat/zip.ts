let crcTable!: number[];

export default class Zip {
    private blob: (object | string)[] = [];
    private files: {header: object[], offset: number, name: string}[] = [];
    private offset = 0;

    constructor() {
        if(crcTable !== undefined!) return;
        crcTable = [];
        for(let c, n = 0; n < 256; n++) {
            c = n;
            for(let k = 0; k < 8; k++)
                c = ((c & 1) ? ((c >>> 1) ^ 0xEDB88320) : (c >>> 1)); //tslint:disable-line:strict-boolean-expressions
            crcTable[n] = c;
        }
    }

    addFile(name: string, content: string): void {
        let crc = -1;
        let length = 0;
        for(let i = 0, strlen = content.length; i < strlen; ++i) {
            let c = content.charCodeAt(i);
            if(c > 0xD800 && c < 0xD8FF) //surrogate pairs
                c = (c - 0xD800) * 0x400 + content.charCodeAt(++i) - 0xDC00 + 0x10000;
            let l = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : c < 0x200000 ? 4 : c < 0x4000000 ? 5 : 6;
            length += l;
            let byte = l === 1 ? c : ((0xFF00 >> l) % 256) | (c >>> (l - 1) * 6);
            --l;
            while(true) {
                crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xFF];
                if(--l >= 0) byte = ((c >>> (l * 6)) & 0x3F) | 0x80;
                else break;
            }
        }
        crc = (crc ^ (-1)) >>> 0;
        const file = {
            header: [Uint16Array.of(0, 0, 0, 0, 0), Uint32Array.of(crc, length, length), Uint16Array.of(name.length, 0)],
            offset: this.offset, name
        };
        this.blob.push(Uint32Array.of(0x04034B50));
        this.blob.push(...file.header);
        this.blob.push(name, content);
        this.offset += name.length + length + 30;
        this.files.push(file);
    }

    build(): Blob {
        const start = this.offset;
        for(const file of this.files) {
            this.blob.push(Uint16Array.of(0x4B50, 0x0201, 0));
            this.blob.push(...file.header);
            this.blob.push(Uint16Array.of(0, 0, 0, 0, 0), Uint32Array.of(file.offset), file.name);
            this.offset += file.name.length + 46;
        }
        this.blob.push(Uint16Array.of(0x4B50, 0x0605, 0, 0, this.files.length, this.files.length),
            Uint32Array.of(this.offset - start, start), Uint16Array.of(0));
        return new Blob(this.blob);
    }
}