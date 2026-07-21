import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { moveObjects } from '../world/moveObjects.ts';

/**
 * 创建平台时可配置的业务选项。
 */
interface AddPlatformOptions {
    /** 当前平台是否允许生成石头，普通平台默认允许。 */
    allowRock?: boolean;
    /** 当前平台是否允许生成道具，普通平台默认允许。 */
    allowItem?: boolean;
    /** 固定平台的左侧起点，未指定时接在主路线后方。 */
    startX?: number;
    maxWidth?: number;
    minWidth?: number;
}

// 使用具名参数明确平台管理器需要的依赖和对象创建回调。
interface PlatformManagerOptions {
    scene: Scene;
    player: Player;
    onAddRock: (x: number, platformY: number) => void;
    onAddItem: (x: number, itemY: number) => void;
}

export class PlatformManager {
    private platforms: GameObjects.Rectangle[] = [];
    private platformRows: number[] = [];
    private platformRowGap = 0;
    private readonly platformRowCount = 3;
    private nextPlatformX = 0;
    private currentPlatformRow = 1;
    // 记录上一块平台的换层方向，避免相邻平台连续同向换层。
    private lastRowDirection = 0;
    // 难度预留为 0~1，当前从最低难度开始生成。
    private difficulty = 0.8;
    private readonly platformHeight = 44;
    private readonly worldWidth = 1024;
    private scene: Scene;
    private player: Player;
    private onAddRock: (x: number, platformY: number) => void;
    private onAddItem: (x: number, itemY: number) => void;

    constructor(options: PlatformManagerOptions) {
        this.scene = options.scene;
        this.player = options.player;
        this.onAddRock = options.onAddRock;
        this.onAddItem = options.onAddItem;
    }

    create() {
        this.calculatePlatformRows();
        this.seedPlatforms();
    }

    update(scrollDistance: number) {
        // 平台移动后，清理离屏平台并补充右侧平台。
        moveObjects(this.platforms, scrollDistance);
        this.nextPlatformX -= scrollDistance;
        this.removeOffscreenPlatforms();
        this.extendPlatformTrack();
    }

    // 先创建中间行的长出生平台，再向右延伸一条上下切换的路线。
    private seedPlatforms() {
        this.nextPlatformX = 0;
        this.currentPlatformRow = 1;
        this.lastRowDirection = 0;

        // 出生平台不生成石头和道具，给玩家留出开局准备时间。
        this.addPlatform(this.currentPlatformRow, {
            allowRock: false,
            allowItem: false,
            minWidth: 1000,
            maxWidth: 2000,
        });

        this.currentPlatformRow = 0;
        this.lastRowDirection = -1;

        this.extendPlatformTrack();
    }

    /**
     * 创建一块新平台，并根据业务选项决定是否生成石头。
     */
    private addPlatform(rowIndex: number, options: AddPlatformOptions = {}) {
        // 普通平台默认允许生成石头，调用方只需声明特殊平台的差异。
        const { allowRock = true, allowItem = true } = options;

        // 平台宽度由当前难度控制，特殊平台仍可指定固定范围。
        const width = this.getPlatformWidth(options);
        // 第一块平台不留空隙，后面的平台随机留出一段空隙。
        const gap = this.nextPlatformX === 0 ? 0 : this.getPlatformGap();
        // 新平台的起点等于“下一块平台位置”加上空隙。
        const x = options.startX ?? this.nextPlatformX + gap;
        const platformY = this.platformRows[rowIndex];

        // 创建一个矩形作为平台；这里没有使用任何图片素材。
        const platform = this.scene.add.rectangle(
            // 矩形的 x 坐标；因为下面设置了左侧为原点，所以这是平台左边缘。
            x,
            // 矩形的 y 坐标；同行平台保持在固定高度。
            platformY,
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
        // 平台使用实体碰撞，玩家无法从底部或侧面穿过。
        this.scene.physics.add.collider(this.player, platform);

        // 把新平台保存到数组里，后面滚动和删除都要用到它。
        this.platforms.push(platform);

        /**
         * 允许生成障碍时，按 80% 概率在平台上生成石头。
         */
        if (allowRock && Math.random() < 0.8) {
            this.onAddRock(x + width / 2, platformY);
        }

        // 道具独立生成，并悬浮在平台中部，避免与同平台石头重叠。
        if (allowItem && Math.random() < 0.3) {
            // 放在相邻平台行的中间，避免道具嵌入上一行平台。
            const itemY = platformY - this.platformRowGap / 2;
            this.onAddItem(x + width / 2, itemY);
        }

        // 更新下一块平台的起点：当前平台左边缘加当前平台宽度。
        this.nextPlatformX = x + width;
    }

    private getNextPlatformRow(): number {
        // 大部分平台保持同一高度，让路线有稳定的跑酷节奏。
        if (Math.random() < 0.6) {
            // 同层平台提供缓冲，之后允许重新选择换层方向。
            this.lastRowDirection = 0;
            return this.currentPlatformRow;
        }

        const directions = [-1, 1].filter((direction) => {
            const nextRow = this.currentPlatformRow + direction;
            const isInsideRows =
                nextRow >= 0 && nextRow < this.platformRowCount;

            return isInsideRows && direction !== this.lastRowDirection;
        });
        const direction =
            directions[PhaserMath.Between(0, directions.length - 1)];

        this.lastRowDirection = direction;
        return this.currentPlatformRow + direction;
    }

    private getPlatformGap() {
        const minGap = 80;
        const maxGap = Math.round(160 + this.difficulty * 80);

        return PhaserMath.Between(minGap, maxGap);
    }

    private getPlatformWidth(options: AddPlatformOptions) {
        const minWidth = Math.round(
            options.minWidth ?? 220 - this.difficulty * 50,
        );
        const maxWidth = Math.round(
            options.maxWidth ?? 400 - this.difficulty * 80,
        );

        return PhaserMath.Between(minWidth, maxWidth);
    }

    private calculatePlatformRows() {
        const canvasHeight = this.scene.cameras.main.height;
        const middlePlatformY = canvasHeight * 0.55;

        // 行距小于普通跳跃高度，保证玩家不依赖二段跳也能向上一层。
        this.platformRowGap = 100;
        this.platformRows = Array.from(
            { length: this.platformRowCount },
            (_, index) =>
                middlePlatformY +
                this.platformRowGap * (index - (this.platformRowCount - 1) / 2),
        );
    }

    // 删除已经完全离开屏幕左侧的平台。
    private removeOffscreenPlatforms() {
        // 倒序遍历，避免删除元素后影响尚未检查的数组索引。
        for (let index = this.platforms.length - 1; index >= 0; index--) {
            const platform = this.platforms[index];

            if (platform.x + platform.width <= -40) {
                platform.destroy();
                this.platforms.splice(index, 1);
            }
        }
    }

    // 在屏幕右侧补充平台，形成一条会在三行间切换的路线。
    private extendPlatformTrack() {
        while (this.nextPlatformX < this.worldWidth + 400) {
            const nextRow = this.getNextPlatformRow();
            const isMovingUp = nextRow < this.currentPlatformRow;

            // 向上换层的平台不放石头，保留安全的落脚区域。
            this.addPlatform(nextRow, { allowRock: !isMovingUp });
            this.currentPlatformRow = nextRow;
        }
    }
}
