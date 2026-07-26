import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { Player } from '../player/player.ts';
import { moveObjects } from '../world/moveObjects.ts';

/**
 * 创建平台时可配置的业务选项。
 */
interface AddPlatformOptions {
    /** 当前地板是否允许生成石头，普通地板默认允许。 */
    allowRock?: boolean;
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
    private floorY = 0;
    private nextFloorX = 0;
    // 难度预留为 0~1，当前从最低难度开始生成。
    private difficulty = 0.8;
    private readonly floorGapChance = 0.2;
    private readonly platformHeight = 44;
    private readonly worldWidth = 1024;
    private scene: Scene;
    private player: Player;
    private onAddRock: (x: number, platformY: number) => void;

    constructor(options: PlatformManagerOptions) {
        this.scene = options.scene;
        this.player = options.player;
        this.onAddRock = options.onAddRock;
    }

    create() {
        this.calculateFloorY();
        this.seedPlatforms();
    }

    update(scrollDistance: number) {
        // 地板移动后，清理离屏部分并补充右侧地板。
        moveObjects(this.platforms, scrollDistance);
        this.nextFloorX -= scrollDistance;
        this.removeOffscreenPlatforms();
        this.extendFloorTrack();
    }

    // 先创建无缺口的出生地板，再向右延伸基础地板。
    private seedPlatforms() {
        this.nextFloorX = 0;

        // 开局地板不生成缺口和石头，给玩家留出安全区域。
        this.addFloorPlatform({
            allowRock: false,
            minWidth: this.worldWidth + 400,
            maxWidth: 2000,
        });

        this.extendFloorTrack();
    }

    // 在画布底部创建地板，并只在少数地板之间生成缺口。
    private addFloorPlatform(options: AddPlatformOptions = {}) {
        const { allowRock = true } = options;
        const width = this.getPlatformWidth(options);
        const hasGap =
            this.nextFloorX !== 0 && Math.random() < this.floorGapChance;
        const gap = hasGap ? this.getPlatformGap() : 0;
        const x = this.nextFloorX + gap;

        const floor = this.scene.add.rectangle(
            x,
            this.floorY,
            width,
            this.platformHeight,
            0x36d399,
        );

        floor.setOrigin(0, 0.5);
        floor.setStrokeStyle(3, 0x0f766e);
        this.scene.physics.add.existing(floor, true);
        this.scene.physics.add.collider(this.player, floor);
        this.platforms.push(floor);

        // 石头只由地板生成，确保所有石头都位于画布底部。
        if (allowRock && Math.random() < 0.8) {
            this.onAddRock(x + width / 2, this.floorY);
        }

        this.nextFloorX = x + width;
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

    private calculateFloorY() {
        const canvasHeight = this.scene.cameras.main.height;

        // 地板底边与画布底边对齐，缺口处仍可掉出画布。
        this.floorY = canvasHeight - this.platformHeight / 2;
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

    // 持续补充右侧地板，形成可无限滚动的基础平台。
    private extendFloorTrack() {
        while (this.nextFloorX < this.worldWidth + 400) {
            this.addFloorPlatform();
        }
    }
}
