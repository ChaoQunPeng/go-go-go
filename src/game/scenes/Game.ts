// 从 Phaser 里导入需要用到的类型和基类。
import { Types, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { PlatformManager } from '../platform/PlatformManager.ts';
import { RockManager } from '../rock/RockManager.ts';
import { ScoreManager } from '../score/ScoreManager.ts';
import { ItemManager } from '../item/ItemManager.ts';

type GameState = 'waiting' | 'playing' | 'game-over';

interface GameSceneData {
    startImmediately?: boolean;
}

// 定义一个名叫 Game 的场景类，Phaser 会把它当成一个游戏画面来运行。
export class Game extends Scene {
    private player!: Player;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private platformManager!: PlatformManager;
    private rockManager!: RockManager;
    private itemManager!: ItemManager;
    private scoreManager: ScoreManager;
    private gameState: GameState = 'waiting';

    private readonly worldSpeed = 300;

    // 构造函数会在创建这个场景时执行一次。
    constructor() {
        // 调用父类 Scene 的构造函数，并把当前场景命名为 Game。
        super('Game');
    }

    // preload 是 Phaser 的资源预加载阶段，会在 create 之前执行。
    preload() {
        // 当前 demo 暂时不加载图片、音频等外部资源。
    }

    create(data: GameSceneData = {}) {
        this.gameState = 'waiting';
        this.initCursors();

        this.startGame();
        if (data.startImmediately) {
            this.startGame();
            return;
        }

        // this.showStartScreen();
    }

    private startGame() {
        this.gameState = 'playing';
        this.physics.resume();
        // 重新开始后恢复开发阶段使用的物理调试边框。
        this.physics.world.debugGraphic?.setVisible(true);
        // 保留左、右和顶部边界，允许玩家从世界底部掉落。
        this.physics.world.setBoundsCollision(true, true, true, false);

        this.player = new Player(this, 100, 300);
        this.scoreManager = new ScoreManager(this);
        this.itemManager = new ItemManager(this, this.player);
        this.rockManager = new RockManager({
            scene: this,
            player: this.player,
            onPlayerDeath: () => {
                this.gameOver();
            },
            onRockDestroyed: () => {
                this.scoreManager.addScore(100);
            },
        });
        this.platformManager = new PlatformManager({
            scene: this,
            player: this.player,
            onAddRock: (x, platformY) => {
                this.rockManager.add(x, platformY);
            },
            onAddItem: (x, itemY) => {
                this.itemManager.add(x, itemY);
            },
        });

        this.platformManager.create();
        this.rockManager.create();
        this.itemManager.create();
        this.scoreManager.create();
    }

    update(_: number, delta: number) {
        if (this.gameState !== 'playing') {
            return;
        }

        // 先读取本帧输入，确保世界速度立即跟随玩家朝向变化。
        this.player.update(this.cursors);

        // 玩家朝右时，世界移动距离变为原来的两倍。
        const speedMultiplier = 1;
        const scrollDistance =
            this.worldSpeed * speedMultiplier * (delta / 1000);

        // 先更新已有石头和道具，避免新对象在出生帧立即移动。
        this.rockManager.update(scrollDistance);
        this.itemManager.update(scrollDistance);
        this.platformManager.update(scrollDistance);
        this.scoreManager.update(scrollDistance);

        const playerBounds = this.player.getBounds();

        // 玩家整个掉出世界底部后，统一进入游戏结束流程。
        if (playerBounds.top > this.physics.world.bounds.bottom) {
            this.gameOver();
        }
    }

    private showStartScreen() {
        const startButton = this.createButton(
            this.cameras.main.centerY,
            '开始游戏',
        );

        startButton.once('pointerdown', () => {
            startButton.destroy();
            this.startGame();
        });
    }

    private gameOver() {
        if (this.gameState !== 'playing') {
            return;
        }

        this.gameState = 'game-over';
        this.physics.pause();
        // 调试图层层级最高，需要单独隐藏才能展示完整结算画面。
        this.physics.world.debugGraphic?.setVisible(false);

        // 只在画面中央展示结算弹框，保留玩家死亡时的游戏场景。
        this.add
            .rectangle(
                this.cameras.main.centerX + 8,
                this.cameras.main.centerY + 8,
                480,
                300,
                0x000000,
                0.2,
            )
            .setDepth(2000);

        this.add
            .rectangle(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                480,
                300,
                0xffffff,
                0.96,
            )
            .setStrokeStyle(3, 0x0f766e)
            .setDepth(2000);

        this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.centerY - 80,
                '游戏结束',
                {
                    fontSize: '48px',
                    color: '#000000',
                },
            )
            .setOrigin(0.5)
            .setDepth(2001);

        // 读取 ScoreManager 中的最终分数并展示在结算页。
        this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.centerY - 10,
                `本局分数：${this.scoreManager.getScore()}`,
                {
                    fontSize: '32px',
                    color: '#000000',
                },
            )
            .setOrigin(0.5)
            .setDepth(2001);

        const restartButton = this.createButton(
            this.cameras.main.centerY + 70,
            '重新开始',
        );

        restartButton.once('pointerdown', () => {
            // 重启场景，让玩家、平台、石头和分数统一回到初始状态。
            this.scene.restart({ startImmediately: true });
        });
    }

    private createButton(y: number, label: string) {
        return this.add
            .text(this.cameras.main.centerX, y, label, {
                fontSize: '32px',
                color: '#ffffff',
                backgroundColor: '#0f766e',
                padding: {
                    x: 24,
                    y: 12,
                },
            })
            .setOrigin(0.5)
            .setDepth(2001)
            .setInteractive({ useHandCursor: true });
    }

    initCursors() {
        if (!this.input.keyboard) {
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
    }
}
