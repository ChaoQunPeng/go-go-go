import { GameObjects, Physics, Scene } from 'phaser';
import { Player } from '../player/player.ts';

// 使用具名参数明确场景依赖和碰撞后的业务回调。
interface RockManagerOptions {
    scene: Scene;
    player: Player;
    onPlayerDeath: () => void;
    onRockDestroyed: () => void;
}

export class RockManager {
    private rocks: GameObjects.Text[] = [];
    private readonly rockVisualOffsetY = 6;
    private scene: Scene;
    private player: Player;
    private onPlayerDeath: () => void;
    private onRockDestroyed: () => void;

    constructor(options: RockManagerOptions) {
        this.scene = options.scene;
        this.player = options.player;
        this.onPlayerDeath = options.onPlayerDeath;
        this.onRockDestroyed = options.onRockDestroyed;
    }

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
        for (const rock of this.rocks) {
            rock.x -= scrollDistance;

            // 静态刚体需要在石头移动后同步显示位置。
            const body = rock.body as Physics.Arcade.StaticBody;
            body.updateFromGameObject();
        }

        this.updateRockBodies();
        this.removeOffscreenRocks();
    }

    add(x: number, platformY: number) {
        // 使用 emoji 展示石头，保留原有静态碰撞逻辑。
        const rock = this.scene.add
            // platformY 是平台中心，减去半高后才是平台顶面。
            .text(x, platformY - 22 + this.rockVisualOffsetY, '🪨', {
                fontSize: '42px',
            })
            .setOrigin(0.5, 1);

        this.scene.physics.add.existing(rock, true);
        this.updateRockBody(rock);
        this.rocks.push(rock);
    }

    private hitRock(_player: unknown, rock: unknown) {
        // Phaser 回调参数类型很宽，这里只把石头当成文字对象处理。
        const rockObject = rock as GameObjects.Text;

        if (this.player.isDashingDown || this.player.isDashing) {
            console.log('撞碎石头');
            rockObject.destroy();
            const index = this.rocks.indexOf(rockObject);

            if (index !== -1) {
                this.rocks.splice(index, 1);
                // 只在石头实际从列表移除时结算一次击碎奖励。
                this.onRockDestroyed();
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

    private updateRockBody(rock: GameObjects.Text) {
        const body = rock.body as Physics.Arcade.StaticBody;
        const bodyWidth = rock.width * 0.5;
        const bodyHeight = rock.height * 0.7;
        const offsetX = (rock.width - bodyWidth) / 2;
        // 抵消 emoji 的视觉下移，让刚体底部仍贴住平台顶面。
        const offsetY = rock.height - bodyHeight - this.rockVisualOffsetY;

        // 缩小后的碰撞体横向居中、底部对齐，避免石头陷入平台。
        body.offset.set(0, 0);
        body.setSize(bodyWidth, bodyHeight, false);
        body.setOffset(offsetX, offsetY);
    }
}
