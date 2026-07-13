import { Scene } from 'phaser';

export class Game extends Scene {
    constructor() {
        super('Game');
    }

    preload() {
        this.load.setPath('assets');
        this.load.image('background', 'bg.png');
        this.load.image('logo', 'logo.png');
    }

    create() {

    }
}
