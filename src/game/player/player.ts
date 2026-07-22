import { GameObjects, Input, Physics, Scene, Types } from 'phaser';

export class Player extends GameObjects.Text {
    private readonly sceneRef: Scene;

    // 地面按左时略微放慢世界滚动，用于让玩家相对世界向后调整节奏。
    private readonly groundSlowWorldSpeedMultiplier = 0.9;
    // 地面按右时略微加快世界滚动，用于让玩家相对世界向前调整节奏。
    private readonly groundFastWorldSpeedMultiplier = 1.1;
    // 空中左右只允许更小幅度影响世界速度，避免明显改变跳跃落点和轨迹。
    private readonly airSlowWorldSpeedMultiplier = 0.95;
    private readonly airFastWorldSpeedMultiplier = 1.05;
    // 普通左右输入产生的世界速度倍率，默认不改变跑酷节奏。
    private normalWorldSpeedMultiplier = 1;

    // 跳跃相关
    // 起跳速度，数值越大起跳越有力、跳得越高。
    private readonly jumpSpeed = 600;
    // 上升阶段重力，数值越大上升时间越短。
    private readonly riseGravity = 500;
    // 下落阶段重力，数值越大下落越快。
    private readonly fallGravity = 1500;
    // 最大连续跳跃次数。
    private maxJumpCount = 2;
    // 当前剩余跳跃次数，运行时自动更新。
    private remainingJumpCount = this.maxJumpCount;
    // 是否已经离开地面，用于判断真正落地。
    private hasLeftGround = false;

    // 冲撞/下撞
    // 下撞速度，数值越大向下冲得越快。
    private readonly dashDownSpeed = 800;
    // Dash 只小幅提高世界速度，主要依靠视觉反馈表现冲刺状态。
    private readonly dashWorldSpeedMultiplier = 1.3;
    // 横向冲刺持续时间，单位为毫秒。
    private readonly dashDuration = 320;
    // 当前是否正在下撞，运行时自动更新。
    private dashingDown = false;
    // 横向冲刺结束时间，运行时自动计算。
    private dashEndTime = 0;

    constructor(scene: Scene, x: number, y: number) {
        // 使用 emoji 展示人物，避免依赖外部图片纹理。
        super(scene, x, y, '🏃', {
            fontSize: '48px',
        });
        this.setFlipX(true);
        this.sceneRef = scene;
        this.setOrigin(0.5);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Physics.Arcade.Body;
        const bodyWidth = this.width * 0.5;
        const bodyHeight = this.height * 0.8;

        // 碰撞体横向居中、底部对齐，避免缩小后玩家陷入平台。
        body.setSize(bodyWidth, bodyHeight, false);
        body.setOffset((this.width - bodyWidth) / 2, this.height - bodyHeight);
        // 启用场景配置的世界边界碰撞，底边由场景单独开放。
        body.setCollideWorldBounds(true);
    }

    private get canJump() {
        return this.remainingJumpCount > 0;
    }

    public get isDashing() {
        return this.sceneRef.time.now < this.dashEndTime;
    }

    public get worldSpeedMultiplier() {
        // Dash 是独立技能，冲刺期间不叠加普通左右键的轻微速度修正。
        return this.isDashing
            ? this.dashWorldSpeedMultiplier
            : this.normalWorldSpeedMultiplier;
    }

    public get isDashingDown() {
        return this.dashingDown;
    }

    public get isFacingRight() {
        // Endless Runner 中玩家始终朝向前方，左右键只调整世界相对速度。
        return true;
    }

    public increaseMaxJumpCount() {
        // 本局永久增加上限，并立即补充一次当前可用跳跃。
        this.maxJumpCount++;
        this.remainingJumpCount++;
    }

    update(cursors: Types.Input.Keyboard.CursorKeys) {
        this.updateState(cursors);
    }

    private updateState(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;
        const isGrounded = body.blocked.down;

        if (this.y > 700) {
            // this.respawnPlayer();
            return;
        }

        body.setVelocityX(0);

        this.updateGroundState(isGrounded);

        // 移动
        this.handleMove(cursors);

        // 跳
        this.handleJump(cursors);

        // 下
        this.handleDownDash(cursors, isGrounded);

        // 冲刺
        this.handleDash(cursors);

        // Body 重力会与全局重力叠加：上升不追加，下降时增强重力。
        body.setGravityY(
            body.velocity.y > 0 ? this.fallGravity : this.riseGravity,
        );
    }

    private handleMove(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;

        if (this.isDashing) {
            // Dash 是独立技能，冲刺期间由 Dash 接管横向位移和世界速度倍率。
            this.normalWorldSpeedMultiplier = 1;
            return;
        }

        if (cursors.left.isDown && !cursors.right.isDown) {
            // 左键表示相对世界轻微减速，不给玩家本体水平速度，也不改变朝向。
            this.normalWorldSpeedMultiplier = body.blocked.down
                ? this.groundSlowWorldSpeedMultiplier
                : this.airSlowWorldSpeedMultiplier;
            return;
        }

        if (cursors.right.isDown && !cursors.left.isDown) {
            // 右键表示相对世界轻微提速，只调整跑酷节奏，不扩展跳跃距离。
            this.normalWorldSpeedMultiplier = body.blocked.down
                ? this.groundFastWorldSpeedMultiplier
                : this.airFastWorldSpeedMultiplier;
            return;
        }

        // 未按左右或左右同时按下时保持基础世界速度，避免产生额外站位漂移。
        this.normalWorldSpeedMultiplier = 1;
    }

    private handleJump(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;
        if (Input.Keyboard.JustDown(cursors.up) && this.canJump) {
            body.setVelocityY(-this.jumpSpeed);

            this.remainingJumpCount--;
        }
    }

    private handleDash(cursors: Types.Input.Keyboard.CursorKeys) {
        // 地面和空中都可以无限次冲刺。
        if (Input.Keyboard.JustDown(cursors.space)) {
            this.dashEndTime = this.sceneRef.time.now + this.dashDuration;
            this.playDashEffects();
        }
    }

    private playDashEffects() {
        // 压缩拉伸只改变玩家显示，不影响物理碰撞体和固定站位。
        this.sceneRef.tweens.killTweensOf(this);
        this.setScale(1.32, 0.78);
        this.sceneRef.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: this.dashDuration,
            ease: 'Back.easeOut',
        });

        this.createDashAfterimages();
        this.createDashSpeedLines();
        this.sceneRef.cameras.main.shake(90, 0.002);
    }

    private createDashAfterimages() {
        for (let index = 1; index <= 3; index++) {
            // 残影向玩家后方消散，强化向前冲刺的方向感。
            const afterimage = this.sceneRef.add
                .text(this.x - index * 14, this.y, this.text, {
                    fontSize: '48px',
                })
                .setOrigin(0.5)
                .setFlipX(true)
                .setAlpha(0.32 / index)
                .setDepth(this.depth - 1);

            this.sceneRef.tweens.add({
                targets: afterimage,
                x: afterimage.x - 30,
                alpha: 0,
                duration: 140 + index * 35,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    afterimage.destroy();
                },
            });
        }
    }

    private createDashSpeedLines() {
        const speedLines = this.sceneRef.add
            .graphics()
            .setDepth(this.depth + 1);

        // 使用固定分布避免每次 Dash 的视觉强度随机变化。
        for (let index = 0; index < 7; index++) {
            const startX = 180 + (index % 3) * 70;
            const y = 100 + index * 88;

            speedLines.lineStyle(index % 2 === 0 ? 3 : 2, 0x0f766e, 0.4);
            speedLines.beginPath();
            speedLines.moveTo(startX, y);
            speedLines.lineTo(startX + 180 + index * 14, y);
            speedLines.strokePath();
        }

        this.sceneRef.tweens.add({
            targets: speedLines,
            x: -120,
            alpha: 0,
            duration: this.dashDuration,
            ease: 'Quad.easeOut',
            onComplete: () => {
                speedLines.destroy();
            },
        });
    }

    private handleDownDash(
        cursors: Types.Input.Keyboard.CursorKeys,
        isGrounded: boolean,
    ) {
        const body = this.body as Physics.Arcade.Body;
        // 下
        if (cursors.down.isDown && !isGrounded) {
            this.dashingDown = true;
            body.setVelocityY(this.dashDownSpeed);
        } else {
            this.dashingDown = false;
        }
    }

    private updateGroundState(isGrounded: boolean) {
        // 玩家离开地面
        if (!isGrounded) {
            this.hasLeftGround = true;
        }

        // 玩家真正落地
        if (isGrounded && this.hasLeftGround) {
            this.remainingJumpCount = this.maxJumpCount;

            this.hasLeftGround = false;
        }
    }
}
