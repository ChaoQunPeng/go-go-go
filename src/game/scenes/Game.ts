// 从 Phaser 里导入需要用到的类型和基类。
import { Types, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { WorldManager } from '../world/WorldManager.ts';
import { PlatformManager } from '../platform/PlatformManager.ts';
import { RockManager } from '../rock/RockManager.ts';

// 定义一个名叫 Game 的场景类，Phaser 会把它当成一个游戏画面来运行。
export class Game extends Scene {
    private player!: Player;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private worldManager!: WorldManager;
    private platformManager!: PlatformManager;
    private rockManager!: RockManager;

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
        this.worldManager = new WorldManager();
        this.platformManager = new PlatformManager(
            this,
            this.player,
            // 平台只决定石头位置，RockManager 负责石头生命周期。
            (x, platformY) => this.rockManager.add(x, platformY),
        );

        // 场景开始时先生成一批底部平台。
        this.platformManager.create();

        if (!this.input.keyboard) {
            return;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.rockManager.create();
    }

    update(_: number, delta: number) {
        // 先移动平台和石头。
        this.worldManager.update(
            delta / 1000,
            this.platformManager.getPlatforms(),
            this.rockManager.getRocks(),
        );

        // 移动后再清理并补充平台。
        this.platformManager.update();
        this.rockManager.update();

        this.player.update(this.cursors);
    }
}
