// 从 Phaser 里导入需要用到的类型和基类。
import { GameObjects, Scene } from 'phaser';

// 定义一个名叫 Game 的场景类，Phaser 会把它当成一个游戏画面来运行。
export class Game extends Scene {
    // 保存当前还存在于画面中的平台；每个平台都是一个 Phaser 矩形对象。
    private platforms: GameObjects.Rectangle[] = [];
    // 记录下一块平台应该从哪个 x 坐标开始生成；x 越大，位置越靠右。
    private nextPlatformX = 0;

    // 游戏画布的逻辑宽度；这里要和 src/game/main.ts 里的 width 保持一致。
    private readonly worldWidth = 1024;
    // 平台的 y 坐标；y 越大，位置越靠下，所以 660 接近画面底部。
    private readonly platformY = 360;
    // 每块平台的高度；这里只影响平台看起来有多厚。
    private readonly platformHeight = 44;
    // 平台每秒向左移动多少像素；数值越大，游戏节奏越快。
    private readonly platformSpeed = 0;
    // 玩家每秒向右移动多少像素；数值越大，游戏节奏越快。
    private readonly playerSpeed = 300;


    private player!: GameObjects.Ellipse;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    // 构造函数会在创建这个场景时执行一次。
    constructor() {
        // 调用父类 Scene 的构造函数，并把当前场景命名为 Game。
        super('Game');
    }

    // preload 是 Phaser 的资源预加载阶段，会在 create 之前执行。
    preload() {
        // 当前 demo 暂时不加载图片、音频等外部资源。
    }

    // create 是 Phaser 的场景创建阶段，适合放初始化画面内容的代码。
    create() {
        // 场景开始时先生成一批底部平台。
        this.seedPlatforms();

        this.player = this.add.ellipse(
            0,
            300,
            40,
            40,
            0xff0000
        );

        this.physics.add.existing(this.player);

        if (!this.input.keyboard) {
            return;
        }
        this.cursors = this.input.keyboard.createCursorKeys();

        const firstPlatform = this.platforms[0];
        this.physics.add.collider(this.player, firstPlatform);
    }

    // update 会在游戏运行时不断执行，一般每秒执行很多次。
    update(_: number, delta: number) {
        // Phaser 传进来的 delta 单位是毫秒，这里除以 1000 转成秒。
        this.scrollPlatforms(delta / 1000);

        this.updatePlayer(delta / 1000);
    }

    private updatePlayer(deltaSeconds: number) {
        const body = this.player.body as Phaser.Physics.Arcade.Body;

        body.setVelocityX(0);

        if (this.cursors.left.isDown) {
            body.setVelocityX(-this.playerSpeed);
        }

        if (this.cursors.right.isDown) {
            body.setVelocityX(this.playerSpeed);
        }
    }

    // 初始化第一批平台，让画面一开始就有路可以显示。
    private seedPlatforms() {
        // 从屏幕最左侧开始安排第一块平台。
        this.nextPlatformX = 0;

        // 持续生成平台，直到平台总长度超过屏幕右侧一段距离。
        while (this.nextPlatformX < this.worldWidth + 400) {
            // 每循环一次，就创建一块新的平台。
            this.addPlatform();
        }
    }

    // 创建一块新的平台，并把它放到上一块平台的右边。
    private addPlatform() {
        // 随机生成平台宽度，让每个平台长短不完全一样。
        const width = this.randomBetween(150, 300);
        // 第一块平台不留空隙，后面的平台随机留出一段空隙。
        const gap = this.nextPlatformX === 0 ? 0 : this.randomBetween(90, 180);
        // 新平台的起点等于“下一块平台位置”加上空隙。
        const x = this.nextPlatformX + gap;

        // 创建一个矩形作为平台；这里没有使用任何图片素材。
        const platform = this.add.rectangle(
            // 矩形的 x 坐标；因为下面设置了左侧为原点，所以这是平台左边缘。
            x,
            // 矩形的 y 坐标；所有平台都放在同一条水平线上。
            this.platformY,
            // 矩形宽度；前面随机生成。
            width,
            // 矩形高度；使用固定值。
            this.platformHeight,
            // 矩形填充颜色；0x36d399 是绿色。
            0x36d399
        );

        // 把平台原点设置为左侧中点，方便用 x 表示平台左边缘。
        platform.setOrigin(0, 0.5);
        // 给平台加一条边框，让平台更容易看清楚。
        platform.setStrokeStyle(3, 0x0f766e);
        this.physics.add.existing(platform, true);

        // 把新平台保存到数组里，后面滚动和删除都要用到它。
        this.platforms.push(platform);
        // 更新下一块平台的起点：当前平台左边缘加当前平台宽度。
        this.nextPlatformX = x + width;
    }

    // 根据经过的时间移动所有平台。
    private scrollPlatforms(deltaSeconds: number) {
        // 计算这一帧平台应该移动多少像素：速度乘以时间。
        const moveDistance = this.platformSpeed * deltaSeconds;

        // 遍历当前所有平台，让它们一起向左移动。
        for (const platform of this.platforms) {
            // x 减小表示物体向左移动。
            platform.x -= moveDistance;
        }

        // 清理已经滚出屏幕左侧的平台，避免对象越来越多。
        this.removeOffscreenPlatforms();
        // 在屏幕右侧继续补平台，保证前方一直有新平台出现。
        this.extendPlatformTrack();
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

    // 生成 min 到 max 之间的随机整数，包含 min 和 max。
    private randomBetween(min: number, max: number) {
        // Math.random() 生成 0 到 1 之间的小数，再换算成指定范围的整数。
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
