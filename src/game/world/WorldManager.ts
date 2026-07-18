import { GameObjects } from 'phaser';

export class WorldManager {
    private platformSpeed = 100;

    constructor() {
    }

    update(
        deltaSeconds: number,
        platforms: GameObjects.Rectangle[],
        rocks: GameObjects.Rectangle[],
    ) {
        const distance = this.platformSpeed * deltaSeconds;

        this.moveObjects(platforms, distance);
        this.moveObjects(rocks, distance);
    }

    private moveObjects(objects: GameObjects.Rectangle[], distance: number) {
        for (const object of objects) {
            object.x -= distance;

            const body = object.body as Phaser.Physics.Arcade.StaticBody;

            body.updateFromGameObject();
        }
    }
}
