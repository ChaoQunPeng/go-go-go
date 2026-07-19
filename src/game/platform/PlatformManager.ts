import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { moveObjects } from '../world/moveObjects.ts';

/**
 * 创建平台时可配置的业务选项。
 */
interface AddPlatformOptions {
    /** 当前平台是否允许生成石头，普通平台默认允许。 */
    allowRock?: boolean;
    maxWidth?: number;
    minWidth?: number;
}

export class PlatformManager {
    private platforms: GameObjects.Rectangle[] = [];
    private nextPlatformX = 0;
    private currentPlatformY = 360;
    private readonly platformHeight = 44;
    private readonly worldWidth = 1024;

    constructor(
        private scene: Scene,
        private player: Player,
        private onAddRock: (x: number, platformY: number) => void,
    ) { }

    create() {
        this.seedPlatforms();
    }

    update(scrollDistance: number) {
        // 平台移动后，清理离屏平台并补充右侧平台。
        moveObjects(this.platforms, scrollDistance);
        this.removeOffscreenPlatforms();
        this.extendPlatformTrack();
    }

    // 初始化第一批平台，让画面一开始就有路可以显示。
    private seedPlatforms() {
        // 从屏幕最左侧开始安排第一块平台。
        this.nextPlatformX = 0;

        // 出生平台禁止生成石头，避免玩家开局直接碰撞障碍。
        this.addPlatform({ allowRock: false, minWidth: 1000, maxWidth: 1000 });

        // 持续生成平台，直到平台总长度超过屏幕右侧一段距离。
        while (this.nextPlatformX < this.worldWidth + 400) {
            // 每循环一次，就创建一块新的平台。
            this.addPlatform();
        }
    }

    /**
     * 创建一块新平台，并根据业务选项决定是否生成石头。
     */
    private addPlatform(options: AddPlatformOptions = {}) {
        // 普通平台默认允许生成石头，调用方只需声明特殊平台的差异。
        const { allowRock = true } = options;

        // 随机生成平台宽度，让每个平台长短不完全一样。
        const width = PhaserMath.Between(options.minWidth ?? 150, options.maxWidth ?? 300);
        // 第一块平台不留空隙，后面的平台随机留出一段空隙。
        const gap = this.nextPlatformX === 0 ? 0 : PhaserMath.Between(90, 180);
        // 新平台的起点等于“下一块平台位置”加上空隙。
        const x = this.nextPlatformX + gap;

        /**
         * 除了第一块平台以外，
         * 后续平台都会在上一块平台的基础上，
         * 上下浮动一定距离。
         */
        if (this.nextPlatformX !== 0) {
            // 高度变化范围。
            const offset = PhaserMath.Between(-40, 40);

            // 更新当前平台高度。
            this.currentPlatformY += offset;

            // 限制平台不会太高或太低。
            this.currentPlatformY = PhaserMath.Clamp(
                this.currentPlatformY,
                280,
                420,
            );
        }

        // 创建一个矩形作为平台；这里没有使用任何图片素材。
        const platform = this.scene.add.rectangle(
            // 矩形的 x 坐标；因为下面设置了左侧为原点，所以这是平台左边缘。
            x,
            // 矩形的 y 坐标；所有平台都放在同一条水平线上。
            this.currentPlatformY,
            // 矩形宽度；前面随机生成。
            width,
            // 矩形高度；使用固定值。
            this.platformHeight,
            // 矩形填充颜色；0x36d399 是绿色。
            0x36d399,
        );

        // 把平台原点设置为左侧中点，方便用 x 表示平台左边缘。
        platform.setOrigin(0, 0.5);
        // 给平台加一条边框，让平台更容易看清楚。
        platform.setStrokeStyle(3, 0x0f766e);
        this.scene.physics.add.existing(platform, true);
        this.scene.physics.add.collider(this.player, platform);

        // 把新平台保存到数组里，后面滚动和删除都要用到它。
        this.platforms.push(platform);

        /**
         * 允许生成障碍时，按 80% 概率在平台上生成石头。
         */
        if (allowRock && Math.random() < 0.8) {
            this.onAddRock(x + width / 2, this.currentPlatformY);
        }

        // 更新下一块平台的起点：当前平台左边缘加当前平台宽度。
        this.nextPlatformX = x + width;
    }

    // 删除已经完全离开屏幕左侧的平台。
    private removeOffscreenPlatforms() {
        // 只要数组里还有平台，就检查最左边的那一块。
        while (this.platforms.length > 0) {
            // 数组第 0 项就是当前最早生成、也最靠左的平台。
            const firstPlatform = this.platforms[0];

            // 如果平台右边缘还没有完全离开屏幕，就停止清理。
            if (firstPlatform.x + firstPlatform.width > -40) {
                // break 会跳出 while 循环。
                break;
            }

            // 销毁 Phaser 对象，让它从场景里消失。
            firstPlatform.destroy();
            // 从数组里移除这块已经销毁的平台。
            this.platforms.shift();
        }
    }

    // 在屏幕右侧补充新的平台。
    private extendPlatformTrack() {
        // 取出数组最后一项，也就是当前最靠右的平台。
        const lastPlatform = this.platforms[this.platforms.length - 1];

        // 如果数组里没有平台，就重新从 x=0 开始生成一块。
        if (!lastPlatform) {
            // 重置下一块平台的生成起点。
            this.nextPlatformX = 0;
            // 创建一块新平台，避免画面里没有平台。
            this.addPlatform();
            // return 表示当前方法到这里结束。
            return;
        }

        // 根据最右侧平台的位置，计算下一块平台应该接着从哪里生成。
        this.nextPlatformX = lastPlatform.x + lastPlatform.width;

        // 如果右侧预留的平台不够多，就继续补平台。
        while (this.nextPlatformX < this.worldWidth + 400) {
            // 每循环一次，就在右边追加一块平台。
            this.addPlatform();
        }
    }
}
