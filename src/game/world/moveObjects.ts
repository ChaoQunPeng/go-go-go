import { GameObjects, Physics } from 'phaser';

export function moveObjects(
    objects: GameObjects.Rectangle[],
    distance: number,
) {
    for (const object of objects) {
        object.x -= distance;

        // 静态刚体不会自动跟随显示对象，需要手动同步位置。
        const body = object.body as Physics.Arcade.StaticBody;
        body.updateFromGameObject();
    }
}
