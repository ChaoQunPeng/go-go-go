// 从 Phaser 里导入需要用到的类型和基类。
import { GameObjects, Input, Scene, Math as PhaserMath } from 'phaser';

// 定义一个名叫 Game 的场景类，Phaser 会把它当成一个游戏画面来运行。
export class Game extends Scene {
    // 保存当前还存在于画面中的平台；每个平台都是一个 Phaser 矩形对象。
    private platforms: GameObjects.Rectangle[] = [];
    // 石头数组
    private rocks: GameObjects.Rectangle[] = [];
    // 记录下一块平台应该从哪个 x 坐标开始生成；x 越大，位置越靠右。
    private nextPlatformX = 0;

    // 游戏画布的逻辑宽度；这里要和 src/game/main.ts 里的 width 保持一致。
    private readonly worldWidth = 1024;
    // 平台的 y 坐标；y 越大，位置越靠下，所以 660 接近画面底部。
    // private readonly platformY = 360;
    /**
     * 当前生成平台的高度。
     *
     * 后续每生成一个平台，
     * 都会根据上一块平台进行上下浮动。
     */
    private currentPlatformY = 360;
    // 每块平台的高度；这里只影响平台看起来有多厚。
    private readonly platformHeight = 44;
    // 平台每秒向左移动多少像素；数值越大，游戏节奏越快。
    private readonly platformSpeed = 100;
    // 玩家每秒向右移动多少像素；数值越大，游戏节奏越快。
    private readonly playerSpeed = 300;
    // 玩家跳跃时，每秒向上移动多少像素；数值越大，游戏越快。
    private readonly jumpSpeed = 500;
    // 玩家向下冲刺时每秒向下移动多少像素。
    private readonly dashDownSpeed = 800;

    private readonly dashDistance = 100;

    // 水平冲刺持续时间，单位是毫秒。
    private readonly dashDuration = 150;
    // 玩家按空格水平冲刺时每秒向右移动多少像素。
    private get dashSpeed() {
        return this.dashDistance / (this.dashDuration / 1000);
    }

    private readonly playerSpawnX = 100;
    private readonly playerSpawnY = 300;

    private isDashingDown = false;
    private dashEndTime = 0;

    // 当前还剩多少次可跳。
    private remainingJumpCount = 2;

    // 最大跳跃次数。
    private readonly maxJumpCount = 2;

    private facingDirection = 1;

    /**
     * 是否已经真正离开过地面。
     *
     * 用来避免：
     * 起跳后的1~2帧 blocked.down 仍然为 true，
     * 导致跳跃次数被错误恢复。
     */
    private hasLeftGround = false;

    private player!: GameObjects.Ellipse;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    private get canJump() {
        return this.remainingJumpCount > 0;
    }

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
        this.player = this.add.ellipse(
            this.playerSpawnX,
            this.playerSpawnY,
            40,
            40,
            0xff0000,
        );

        // 场景开始时先生成一批底部平台。
        this.seedPlatforms();
        // this.addRock(600);

        this.physics.add.existing(this.player);

        if (!this.input.keyboard) {
            return;
        }
        this.cursors = this.input.keyboard.createCursorKeys();

        const firstPlatform = this.platforms[0];
        this.physics.add.collider(this.player, firstPlatform);

        this.physics.add.overlap(
            this.player,
            this.rocks,
            this.hitRock,
            undefined,
            this,
        );
    }

    // update 会在游戏运行时不断执行，一般每秒执行很多次。
    update(_: number, delta: number) {
        // Phaser 传进来的 delta 单位是毫秒，这里除以 1000 转成秒。
        this.scrollPlatforms(delta / 1000);

        this.updatePlayer();
    }

    private hitRock(_player: unknown, rock: unknown) {
        return;
        // Phaser 回调参数类型很宽，这里只把石头当成矩形处理。
        const rockObject = rock as GameObjects.Rectangle;

        if (this.isDashingDown) {
            console.log('撞碎石头');
            rockObject.destroy();
            const index = this.rocks.indexOf(rockObject);

            if (index !== -1) {
                this.rocks.splice(index, 1);
            }
        } else {
            console.log('撞到石头，死亡');

            this.respawnPlayer();
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

    private updatePlayer() {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const isGrounded = body.blocked.down;

        if (this.player.y > 700) {
            this.respawnPlayer();
            return;
        }

        if (Input.Keyboard.JustDown(this.cursors.space)) {
            this.dashEndTime = this.time.now + this.dashDuration;
        }

        const isDashing = this.time.now < this.dashEndTime;

        // body.setCollideWorldBounds(true);
        body.setVelocityX(0);

        // 上
        // if (this.cursors.up.isDown && isGrounded) {
        //     body.setVelocityY(-this.jumpSpeed);
        // }

        // 玩家真正进入空中
        if (!isGrounded) {
            this.hasLeftGround = true;
        }

        // 真正落地恢复跳跃次数
        if (isGrounded && this.hasLeftGround) {
            this.remainingJumpCount = this.maxJumpCount;

            this.hasLeftGround = false;
        }

        // 二段跳
        if (Input.Keyboard.JustDown(this.cursors.up) && this.canJump) {
            body.setVelocityY(-this.jumpSpeed);

            this.remainingJumpCount--;
        }

        // 下
        if (this.cursors.down.isDown && !isGrounded) {
            this.isDashingDown = true;
            body.setVelocityY(this.dashDownSpeed);
        } else {
            this.isDashingDown = false;
        }

        // 左
        if (this.cursors.left.isDown) {
            this.facingDirection = -1;
            body.setVelocityX(-this.playerSpeed);
        }

        // 右
        if (this.cursors.right.isDown) {
            this.facingDirection = 1;
            body.setVelocityX(this.playerSpeed);
        }

        // 冲刺期间每帧保持速度，避免被每帧重置速度抵消。
        if (isDashing) {
            body.setVelocityX(this.dashSpeed * this.facingDirection);
        }
    }

    private respawnPlayer() {
        const body = this.player.body as Phaser.Physics.Arcade.Body;

        // 停止所有速度
        body.setVelocity(0, 0);

        this.remainingJumpCount = this.maxJumpCount;

        this.hasLeftGround = false;

        // 回到出生点
        this.player.setPosition(this.playerSpawnX, this.playerSpawnY);
    }

    /**
     * 添加石头
     */
    private addRock(x: number, platformY: number) {
        const rock = this.add.rectangle(x, platformY - 40, 40, 40, 0x555555);

        rock.setOrigin(0, 1);

        this.physics.add.existing(rock, true);

        this.rocks.push(rock);
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

        /**
         * 除了第一块平台以外，
         * 后续平台都会在上一块平台的基础上，
         * 上下浮动一定距离。
         */
        if (this.nextPlatformX !== 0) {
            // 高度变化范围。
            const offset = this.randomBetween(-40, 40);

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
        const platform = this.add.rectangle(
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
        this.physics.add.existing(platform, true);
        this.physics.add.collider(this.player, platform);

        // 把新平台保存到数组里，后面滚动和删除都要用到它。
        this.platforms.push(platform);

        /**
         * 30% 概率在平台上生成石头。
         */
        if (Math.random() < 0.8) {
            this.addRock(x + width / 2, this.currentPlatformY);
        }

        // 更新下一块平台的起点：当前平台左边缘加当前平台宽度。
        this.nextPlatformX = x + width;
    }

    // 根据经过的时间移动所有平台。
    private scrollPlatforms(deltaSeconds: number) {
        // 计算这一帧平台应该移动多少像素：速度乘以时间。
        const moveDistance = this.platformSpeed * deltaSeconds;

        // 遍历当前所有平台，让它们一起向左移动。
        for (const platform of this.platforms) {
            platform.x -= moveDistance;

            const body = platform.body as Phaser.Physics.Arcade.StaticBody;
            // 更新刚体位置
            body.updateFromGameObject();
        }

        // 石头移动
        for (const rock of this.rocks) {
            rock.x -= moveDistance;

            const body = rock.body as Phaser.Physics.Arcade.StaticBody;

            body.updateFromGameObject();
        }

        // 清理已经滚出屏幕左侧的平台，避免对象越来越多。
        this.removeOffscreenPlatforms();
        // 在屏幕右侧继续补平台，保证前方一直有新平台出现。
        this.extendPlatformTrack();
        // 清理已经滚出屏幕左侧的石头
        this.removeOffscreenRocks();
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