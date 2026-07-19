import { GameObjects, Physics, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { moveObjects } from '../world/moveObjects.ts';

export class RockManager {
    private rocks: GameObjects.Rectangle[] = [];

    constructor(
        private scene: Scene,
        private player: Player,
        private onPlayerDeath: () => void,
    ) { }

    create() {
        // 统一注册玩家与石头的碰撞检测。
        this.scene.physics.add.overlap(
            this.player,
            this.rocks,
            this.hitRock,
            undefined,
            this,
        );
    }

    update(scrollDistance: number) {
        moveObjects(this.rocks, scrollDistance);
        this.updateRockBodies();
        this.removeOffscreenRocks();
    }

    add(x: number, platformY: number) {
        const rock = this.scene.add.rectangle(
            x,
            platformY - 22,
            40,
            40,
            0x555555,
        );

        rock.setOrigin(0, 1);
        this.scene.physics.add.existing(rock, true);
        this.updateRockBody(rock);
        this.rocks.push(rock);
    }

    private hitRock(_player: unknown, rock: unknown) {
        // Phaser 回调参数类型很宽，这里只把石头当成矩形处理。
        const rockObject = rock as GameObjects.Rectangle;

        if (this.player.isDashingDown || this.player.isDashing) {
            console.log('撞碎石头');
            rockObject.destroy();
            const index = this.rocks.indexOf(rockObject);

            if (index !== -1) {
                this.rocks.splice(index, 1);
            }
        } else {
            // 只上报死亡结果，由场景统一处理游戏结束流程。
            this.onPlayerDeath();
        }
    }

    private removeOffscreenRocks() {
        while (this.rocks.length > 0) {
            const rock = this.rocks[0];

            if (rock.x > -100) {
                break;
            }

            rock.destroy();
            this.rocks.shift();
        }
    }

    private updateRockBodies() {
        for (const rock of this.rocks) {
            this.updateRockBody(rock);
        }
    }

    private updateRockBody(rock: GameObjects.Rectangle) {
        const body = rock.body as Physics.Arcade.StaticBody;
        const bodyWidth = rock.width * 0.5;
        const bodyHeight = rock.height * 0.5;
        const offsetX = (rock.width - bodyWidth) / 2;
        const offsetY = (rock.height - bodyHeight) / 2;

        // 静态刚体同步位置后会恢复显示尺寸，这里重新缩小并居中碰撞体。
        body.offset.set(0, 0);
        body.setSize(bodyWidth, bodyHeight, false);
        body.setOffset(offsetX, offsetY);
    }
}
