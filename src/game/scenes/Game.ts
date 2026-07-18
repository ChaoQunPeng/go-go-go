// 从 Phaser 里导入需要用到的类型和基类。
import { Types, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { PlatformManager } from '../platform/PlatformManager.ts';
import { RockManager } from '../rock/RockManager.ts';
import { ScoreManager } from '../score/ScoreManager.ts';

// 定义一个名叫 Game 的场景类，Phaser 会把它当成一个游戏画面来运行。
export class Game extends Scene {
    private player!: Player;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private platformManager!: PlatformManager;
    private rockManager!: RockManager;
    private scoreManager: ScoreManager;

    private readonly worldSpeed = 200;

    // 构造函数会在创建这个场景时执行一次。
    constructor() {
        // 调用父类 Scene 的构造函数，并把当前场景命名为 Game。
        super('Game');
    }

    // preload 是 Phaser 的资源预加载阶段，会在 create 之前执行。
    preload() {
        // 当前 demo 暂时不加载图片、音频等外部资源。
    }

    create() {
        this.player = new Player(this, 100, 300);
        this.rockManager = new RockManager(this, this.player);
        this.scoreManager = new ScoreManager(this);
        this.platformManager = new PlatformManager(
            this,
            this.player,
            (x, platformY) => {
                return this.rockManager.add(x, platformY);
            },
        );

        this.platformManager.create();
        this.rockManager.create();
        this.scoreManager.create();

        this.initCursors();
    }

    update(_: number, delta: number) {
        // delta 是毫秒，统一换算成本帧滚动距离。
        const scrollDistance = this.worldSpeed * (delta / 1000);

        // 先更新已有石头，避免新平台生成的石头在出生帧立即移动。
        this.rockManager.update(scrollDistance);
        this.platformManager.update(scrollDistance);
        this.scoreManager.update(scrollDistance);
        this.player.update(this.cursors);
    }

    initCursors() {
        if (!this.input.keyboard) {
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
    }
}
