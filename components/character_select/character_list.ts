export interface CharacterItem {
    readonly name: string
    readonly id: number
}

let characterList: ReadonlyArray<CharacterItem> = [];

export function setCharacters(characters: ReadonlyArray<CharacterItem>): void {
    characterList = characters;
}

export function getCharacters(): ReadonlyArray<CharacterItem> {
    return characterList;
}