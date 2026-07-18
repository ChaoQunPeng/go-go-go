import { GameObjects, Scene } from 'phaser';
import { Player } from '../player/player.ts';

export class RockManager {
    private rocks: GameObjects.Rectangle[] = [];

    constructor(
        private scene: Scene,
        private player: Player,
    ) {}

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

    update() {
        this.removeOffscreenRocks();
    }

    add(x: number, platformY: number) {
        const rock = this.scene.add.rectangle(
            x,
            platformY - 40,
            40,
            40,
            0x555555,
        );

        rock.setOrigin(0, 1);
        this.scene.physics.add.existing(rock, true);
        this.rocks.push(rock);
    }

    // WorldManager 调整前，暂时提供现有石头集合。
    getRocks(): GameObjects.Rectangle[] {
        return this.rocks;
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
            console.log('撞到石头，死亡');
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
}
